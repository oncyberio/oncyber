import {
    MeshBuilder,
    Rgb,
    localise,
    mixRgb,
    occlusion,
    rgb,
    skyShade,
} from "../kernel/build";
import { meshField } from "../kernel/mesher";
import { fbm, smoothstep } from "../kernel/noise";
import { Vec3, field, sphere } from "../kernel/sdf";
import type { SkinField } from "./skinField";

export interface SkinPalette {
    /** Lit skin, shaded skin, and the flush on knees, knuckles and ears. */
    base: string;
    shade: string;
    flush: string;
    /** The plain base layer worn under the clothes. */
    underTop: string;
    underBottom: string;
}

export interface SkinMeshes {
    body: MeshBuilder;
    head: MeshBuilder;
}

/** Where the head mesh takes over from the body mesh. */
export const neckCut = (skin: SkinField) => skin.rig.body.head[1] - 0.028;

/**
 * Half-face texture coordinates for the head: `u` runs from the nose round
 * to the back, `v` from the neck to the crown. Both sides of the face share
 * the texture, so painted features are always symmetrical and seamless.
 */
export const FACE_UV = {
    axisZ: -0.01,
    maxAngle: 0.62 * Math.PI,
    minY: 1.42,
    maxY: 1.65,
};
export function faceUv(p: Vec3): [number, number] {
    const angle = Math.atan2(Math.abs(p[0]), p[2] - FACE_UV.axisZ);
    return [
        Math.min(1, angle / FACE_UV.maxAngle),
        Math.min(
            1,
            Math.max(0, (p[1] - FACE_UV.minY) / (FACE_UV.maxY - FACE_UV.minY))
        ),
    ];
}

/**
 * Mesh the skin field as three overlapping pieces at different detail: a
 * coarse body, fine hands, and a head whose face is finer than its skull.
 * The pieces follow the same surface where they overlap, so no seam shows.
 */
export function buildSkin(
    skin: SkinField,
    palette: SkinPalette,
    /** Mesh density, or [body, face and hands] when they differ. */
    density: number | [number, number] = 1,
    /**
     * For the studio look: the face's paint, applied to the vertices in
     * place of a texture. Colour and shading inputs are then kept apart.
     */
    studio?: { tint: (x: number, y: number, z: number) => number[] }
): SkinMeshes {
    const { rig, all } = skin;
    const bodyDetail = typeof density === "number" ? density : density[0];
    const detail = typeof density === "number" ? density : density[1];
    const b = rig.body;
    const base = rgb(palette.base);
    const shade = rgb(palette.shade);
    const flush = rgb(palette.flush);
    const underTop = rgb(palette.underTop);
    const underBottom = rgb(palette.underBottom);
    const cut = neckCut(skin);
    // For shading, the eye sockets are full: the eyeballs sit in them.
    const shaded = field().add(all);
    for (const s of [1, -1])
        shaded.add(
            sphere(
                skin.toHead([
                    skin.face.eye[0] * s,
                    skin.face.eye[1],
                    skin.face.eye[2],
                ]),
                (skin.face.eyeRadius + 0.0012) * b.headScale
            )
        );
    const local = localise(shaded, 0.016, 0.031);

    const hands = (["left", "right"] as const).map((side) => {
        const s = side === "left" ? 1 : -1;
        const joint = rig.joint(`${side}Hand`);
        const dir = rig.direction(`${side}Hand`, [s, 0, 0]);
        const centre = rig.at(`${side}Hand`, [
            0.08 * s * b.handScale,
            0,
            0.005,
        ]);
        const knuckles = rig.at(`${side}Hand`, [
            0.085 * s * b.handScale,
            0.01,
            0,
        ]);
        return { joint, dir, centre, knuckles, side, s };
    });
    /** Signed distance past a wrist, or -Infinity away from both hands. */
    const pastWrist = (x: number, y: number, z: number) => {
        for (const hand of hands) {
            if (x * hand.s < 0) continue;
            if (
                Math.hypot(
                    x - hand.centre[0],
                    y - hand.centre[1],
                    z - hand.centre[2]
                ) >
                0.2 * b.handScale
            )
                return -Infinity;
            return (
                (x - hand.joint[0]) * hand.dir[0] +
                (y - hand.joint[1]) * hand.dir[1] +
                (z - hand.joint[2]) * hand.dir[2] +
                0.03
            );
        }
        return -Infinity;
    };

    const knee = b.lowerLeg;
    const elbows = (["left", "right"] as const).map((side) =>
        rig.at(`${side}LowerArm`, [0, 0, -0.03])
    );
    const paint = (p: Vec3, n: Vec3): Rgb => {
        const near = local(p[0], p[1], p[2]);
        const open = occlusion(near, p, n, 0.03, 2);
        const tight = occlusion(near, p, n, 0.008, 1);
        const ao = 0.35 * open + 0.65 * Math.min(open, tight);
        let colour = base;
        let rosy = 0;
        // Knees, elbows, knuckles, fingertips, ears and heels run pink.
        const kx = Math.abs(p[0]) - knee[0];
        rosy +=
            0.55 *
            Math.exp(-(kx * kx + (p[1] - knee[1] - 0.01) ** 2) / 0.0011) *
            smoothstep(-0.2, 0.5, n[2]);
        for (const e of elbows)
            rosy +=
                0.45 *
                Math.exp(
                    -(
                        (p[0] - e[0]) ** 2 +
                        (p[1] - e[1]) ** 2 +
                        (p[2] - e[2]) ** 2
                    ) / 0.0009
                );
        for (const hand of hands) {
            const d = Math.hypot(
                p[0] - hand.knuckles[0],
                p[1] - hand.knuckles[1],
                p[2] - hand.knuckles[2]
            );
            rosy += 0.35 * Math.exp(-(d * d) / 0.0007);
            const along =
                (p[0] - hand.joint[0]) * hand.dir[0] +
                (p[1] - hand.joint[1]) * hand.dir[1] +
                (p[2] - hand.joint[2]) * hand.dir[2];
            if (Math.abs(p[0] - hand.joint[0]) < 0.25)
                rosy += 0.3 * smoothstep(0.125, 0.165, along / b.handScale);
        }
        colour = mixRgb(colour, flush, Math.min(0.7, rosy));
        // The base layer: a fitted top and shorts.
        const hy = b.hips[1];
        const armLine = b.upperArm[1];
        if (pastWrist(p[0], p[1], p[2]) < 0 && p[1] < cut) {
            const shorts =
                smoothstep(hy - 0.19, hy - 0.18, p[1]) *
                smoothstep(hy + 0.035, hy + 0.025, p[1]);
            const strap = smoothstep(
                0.03,
                0.022,
                Math.abs(Math.abs(p[0]) - 0.07)
            );
            const top =
                smoothstep(b.chest[1] - 0.005, b.chest[1] + 0.005, p[1]) *
                Math.max(
                    smoothstep(armLine - 0.07, armLine - 0.08, p[1]),
                    strap * smoothstep(armLine + 0.03, armLine + 0.02, p[1])
                ) *
                smoothstep(
                    b.upperArm[0] - 0.012,
                    b.upperArm[0] - 0.02,
                    Math.abs(p[0])
                );
            colour = mixRgb(colour, underBottom, shorts);
            colour = mixRgb(colour, underTop, top);
        }
        // Painterly mottling, and warm shadows where skin folds in.
        const mottle = 0.94 + 0.12 * fbm(p[0] * 38, p[1] * 38, p[2] * 38, 3);
        const lit = mixRgb(
            [
                colour[0] * shade[0] * 1.7,
                colour[1] * shade[1] * 1.7,
                colour[2] * shade[2] * 1.7,
            ],
            colour,
            smoothstep(-0.25, 0.8, ao)
        );
        if (studio) {
            // Thickness: step inwards and see how soon the far side arrives.
            const inwards: Vec3 = [-n[0], -n[1], -n[2]];
            shading[0] = ao;
            shading[1] = 1 - occlusion(near, p, inwards, 0.016, 2);
            if (p[1] < cut - 0.02) return colour;
            const h = skin.fromHead(p);
            const t = studio.tint(h[0], h[1], h[2]);
            return [colour[0] * t[0], colour[1] * t[1], colour[2] * t[2]];
        }
        const k = mottle * skyShade(n, 0.16);
        return [lit[0] * k, lit[1] * k, lit[2] * k];
    };
    const shading: [number, number, number, number] = [1, 1, 0, 1];

    const cell = 0.0105 / bodyDetail;
    // Each piece runs 1.6 of its own cells past a cut, so neighbours overlap.
    const overlapBody = cell * 1.6;
    const reach = rig.at("leftHand", [b.handLength, 0, 0]);
    const body = new MeshBuilder();
    body.auxNext = shading;
    body.addRaw(
        meshField(all, {
            min: [-reach[0] - 0.04, b.foot[1] - 0.085, -0.17],
            max: [reach[0] + 0.04, cut + 0.02, 0.24],
            cell,
            keep: (x, y, z) =>
                y < cut + overlapBody && pastWrist(x, y, z) < overlapBody,
        }),
        paint
    );
    // Hands, sculpted once per side at fine detail.
    const handCell = (0.0027 * b.handScale) / detail;
    for (const hand of hands) {
        const c = hand.centre;
        const r = 0.125 * b.handScale;
        body.addRaw(
            meshField(all, {
                min: [c[0] - r, c[1] - r, c[2] - r],
                max: [c[0] + r, c[1] + r, c[2] + r],
                cell: handCell,
                keep: (x, y, z) => pastWrist(x, y, z) > -handCell * 1.6,
            }),
            paint
        );
    }

    // Head: a fine face (with ears) and a coarser skull behind it.
    const head = new MeshBuilder();
    head.auxNext = shading;
    const joint = b.head;
    const hs = b.headScale;
    const faceBack = joint[2] - 0.036 * hs;
    const fine = (0.0023 * hs) / detail;
    const coarse = (0.0052 * hs) / bodyDetail;
    const top = joint[1] + 0.25 * hs;
    const uv = (p: Vec3) => faceUv(skin.fromHead(p));
    head.addRaw(
        meshField(all, {
            min: [-0.1 * hs, cut - 0.008, faceBack - 0.006],
            max: [0.1 * hs, top, joint[2] + 0.125 * hs],
            cell: fine,
            keep: (_x, y, z) =>
                y > cut - fine * 1.6 && z > faceBack - fine * 1.6,
        }),
        paint,
        uv
    );
    head.addRaw(
        meshField(all, {
            min: [-0.1 * hs, cut - 0.012, joint[2] - 0.13 * hs],
            max: [0.1 * hs, top, faceBack + 0.012],
            cell: coarse,
            keep: (_x, y, z) =>
                y > cut - coarse * 1.6 && z < faceBack + coarse * 1.6,
        }),
        paint,
        uv
    );
    return { body, head };
}
