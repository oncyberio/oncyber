import type { ToonAvatarRecipe } from "../recipe";
import type { ToonLayout } from "../skeleton";
import { blob, REGION, tube, type Row } from "./builder";
import { rigid, type ToonContext } from "./context";
import {
    add,
    addScaled,
    clamp,
    cross,
    lerp,
    normalize,
    sub,
    type Vec3,
} from "./vec";

const HEAD_SEGMENTS = 36;
const HEAD_RINGS = 22;

/**
 * The skull as a function, so everything that sits on it (eyes, nose, ears,
 * hair, glasses) can ask where the surface is instead of guessing.
 */
export type HeadShape = {
    center: Vec3;
    size: number;
    /** Surface point for a latitude and longitude in radians (0, 0 is the nose). */
    at(latitude: number, longitude: number, lift?: number): Vec3;
    /** Front surface point above face coordinates (head sizes from the centre). */
    front(x: number, y: number, lift?: number): Vec3;
    /** Outward direction at a front surface point. */
    frontNormal(x: number, y: number): Vec3;
    /** Half width of the head at face height `y`, in head sizes. */
    halfWidthAt(y: number): number;
};

export function createHeadShape(
    recipe: ToonAvatarRecipe,
    layout: ToonLayout
): HeadShape {
    const shape = recipe.head;
    const { center, size, halfWidth, halfDepth, up, down } = layout.head;
    const power = lerp(2, 4.6, shape.square);
    const e = 2 / power;
    const jaw = lerp(-0.14, 0.52, shape.jaw);
    const crown = lerp(-0.08, 0.42, shape.crown);
    const cheeks = lerp(0, 0.16, shape.cheeks);

    /** Width multiplier at height `s` (-1 chin, 0 widest, 1 crown). */
    const widthProfile = (s: number) => {
        const below = Math.max(0, -s);
        const above = Math.max(0, s);
        return (
            1 -
            jaw * Math.pow(below, 1.6) -
            crown * above * above +
            cheeks * Math.exp(-Math.pow((s + 0.42) / 0.3, 2))
        );
    };
    const depthProfile = (s: number) => {
        const below = Math.max(0, -s);
        const above = Math.max(0, s);
        return (
            1 - jaw * 0.45 * Math.pow(below, 1.6) - crown * 0.5 * above * above
        );
    };
    const pow = (c: number) => Math.sign(c) * Math.pow(Math.abs(c), e);
    const place = (d: Vec3, lift: number): Vec3 => {
        const s = d[1];
        const local: Vec3 = [
            d[0] * halfWidth * widthProfile(s),
            s >= 0 ? s * up : s * down,
            d[2] * halfDepth * depthProfile(s) * (d[2] < 0 ? 1.06 : 1),
        ];
        if (lift) {
            const out = normalize([
                local[0] / (halfWidth * halfWidth),
                local[1] / (up * up),
                local[2] / (halfDepth * halfDepth),
            ]);
            return add(center, addScaled(local, out, lift));
        }
        return add(center, local);
    };
    const at = (latitude: number, longitude: number, lift = 0): Vec3 => {
        const cl = pow(Math.cos(latitude));
        return place(
            [
                cl * pow(Math.sin(longitude)),
                pow(Math.sin(latitude)),
                cl * pow(Math.cos(longitude)),
            ],
            lift
        );
    };
    const direction = (x: number, y: number): Vec3 => {
        const s = clamp((y * size) / (y >= 0 ? up : down), -0.999, 0.999);
        const dx = clamp(
            (x * size) / (halfWidth * widthProfile(s)),
            -0.999,
            0.999
        );
        const rest =
            1 - Math.pow(Math.abs(dx), power) - Math.pow(Math.abs(s), power);
        return [dx, s, Math.pow(Math.max(rest, 0), 1 / power)];
    };
    const front = (x: number, y: number, lift = 0) =>
        place(direction(x, y), lift);
    const frontNormal = (x: number, y: number): Vec3 => {
        const h = 0.02;
        const px = sub(front(x + h, y), front(x - h, y));
        const py = sub(front(x, y + h), front(x, y - h));
        const n = normalize(cross(px, py));
        return n[2] < 0 ? [-n[0], -n[1], -n[2]] : n;
    };
    const halfWidthAt = (y: number) => {
        const s = clamp((y * size) / (y >= 0 ? up : down), -0.999, 0.999);
        return (
            (halfWidth *
                widthProfile(s) *
                Math.pow(1 - Math.pow(Math.abs(s), power), 1 / power)) /
            size
        );
    };
    return { center, size, at, front, frontNormal, halfWidthAt };
}

/**
 * Where the features sit on the face, in head sizes from the head centre.
 * The mesh places eyes, nose and glasses from this; the material paints the
 * mouth, brows and marks from the same numbers, so they always line up.
 */
export type FaceLayout = {
    eye: { x: number; y: number; radius: number; aspect: number };
    nose: { y: number; size: number };
    mouth: { y: number; halfWidth: number };
    brow: { y: number };
    ear: { y: number };
    /** Ink line width in head sizes. */
    line: number;
};

export function layoutFace(
    recipe: ToonAvatarRecipe,
    layout: ToonLayout,
    head: HeadShape
): FaceLayout {
    const { eyes, mouth, head: shape } = recipe;
    const downUnits = layout.head.down / layout.head.size;
    const upUnits = layout.head.up / layout.head.size;
    let radius = lerp(0.2, 0.43, eyes.size);
    const aspect = lerp(0.9, 1.4, eyes.tall);
    const y =
        lerp(-0.12, 0.42, eyes.height) * lerp(0.9, 1.15, clamp(upUnits - 0.9));
    // Keep both eyes on the face, however narrow the head.
    const room = head.halfWidthAt(y) * 0.88;
    radius = Math.min(radius, room / 1.9);
    const x = Math.min(radius * lerp(0.9, 1.85, eyes.spacing), room - radius);
    const eye = { x, y, radius, aspect };
    const eyeBottom = y - radius * aspect;
    const noseY = lerp(
        eyeBottom + radius * 0.5,
        eyeBottom - 0.22,
        shape.noseHeight
    );
    const mouthY = lerp(
        -downUnits * 0.84,
        Math.min(noseY - 0.2, -downUnits * 0.3),
        mouth.height
    );
    const mouthRoom = head.halfWidthAt(mouthY) * 0.8;
    return {
        eye,
        nose: { y: noseY, size: lerp(0.6, 1.7, shape.noseSize) },
        mouth: {
            y: mouthY,
            halfWidth: Math.min(lerp(0.12, 0.62, mouth.width), mouthRoom),
        },
        brow: { y: y + radius * aspect + lerp(-0.04, 0.2, eyes.browHeight) },
        ear: { y: y - radius * 0.3 },
        line: layout.ink / layout.head.size,
    };
}

function buildSkull(ctx: ToonContext, head: HeadShape) {
    const { builder, colors } = ctx;
    const style = {
        color: colors.skin,
        weights: rigid("head"),
        // Only the front half is face: the back keeps plain skin under hair.
        region: (point: Vec3) =>
            point[2] - head.center[2] > -1e-4 ? REGION.face : REGION.plain,
        paint: (point: Vec3): [number, number] => [
            (point[0] - head.center[0]) / head.size,
            (point[1] - head.center[1]) / head.size,
        ],
    };
    const rows: Row[] = [];
    for (let i = 1; i < HEAD_RINGS; i++) {
        const latitude = -Math.PI / 2 + (i / HEAD_RINGS) * Math.PI;
        const points: Vec3[] = [];
        for (let j = 0; j < HEAD_SEGMENTS; j++)
            points.push(head.at(latitude, (j / HEAD_SEGMENTS) * Math.PI * 2));
        rows.push({ ...style, points });
    }
    builder.loft(rows, head.at(-Math.PI / 2, 0), head.at(Math.PI / 2, 0));
}

function buildEye(
    ctx: ToonContext,
    head: HeadShape,
    face: FaceLayout,
    sign: 1 | -1
) {
    const { builder, colors, layout } = ctx;
    const { x, y, radius, aspect } = face.eye;
    const cx = x * sign;
    const normal = head.frontNormal(cx, y);
    const bulge = radius * head.size * 0.3;
    const rings = [0.22, 0.45, 0.66, 0.84, 0.95, 1.0, 1.08];
    const segments = 24;
    const style = {
        color: colors.white,
        weights: rigid("head"),
        // The rim is painted, so the dome needs no ink hull of its own.
        outline: 0,
        region: sign > 0 ? REGION.eye : REGION.eye + 1,
    };
    const row = (r: number): Row => {
        const points: Vec3[] = [];
        // Buried rim: the last ring dips under the skin so the dome is sealed.
        const lift =
            r > 1
                ? -layout.ink
                : bulge * Math.sqrt(Math.max(0, 1 - r * r)) + layout.ink * 0.6;
        const coords: [number, number][] = [];
        for (let j = 0; j < segments; j++) {
            const angle = (j / segments) * Math.PI * 2;
            const ox = Math.cos(angle) * r * radius;
            const oy = Math.sin(angle) * r * radius * aspect;
            points.push(addScaled(head.front(cx + ox, y + oy), normal, lift));
            coords.push([Math.cos(angle) * r, Math.sin(angle) * r * aspect]);
        }
        return { ...style, points, paints: coords };
    };
    // x cross y = +z: rings shrink toward the viewer.
    const rows = rings
        .slice()
        .reverse()
        .map((r) => row(r));
    const apex = addScaled(head.front(cx, y), normal, bulge + layout.ink * 0.6);
    const { last } = builder.loft(rows, null, null);
    const center = builder.vertex(apex, style, [0, 0]);
    for (let j = 0; j < segments; j++)
        builder.triangle(center, last[j], last[(j + 1) % segments]);
}

function buildNose(ctx: ToonContext, head: HeadShape, face: FaceLayout) {
    const { builder, colors, recipe } = ctx;
    const style = recipe.head.nose;
    if (style === "none") return;
    const size = head.size * face.nose.size;
    const base = head.front(0, face.nose.y);
    const part = { color: colors.skin, weights: rigid("head") };
    switch (style) {
        case "button":
            blob(builder, {
                ...part,
                center: add(base, [0, 0, size * 0.05]),
                radii: [size * 0.1, size * 0.1, size * 0.11],
            });
            break;
        case "bulb":
            blob(builder, {
                ...part,
                center: add(base, [0, 0, size * 0.09]),
                radii: [size * 0.17, size * 0.15, size * 0.17],
            });
            break;
        case "snub":
            blob(builder, {
                ...part,
                center: add(base, [0, size * 0.03, size * 0.03]),
                radii: [size * 0.09, size * 0.07, size * 0.12],
                deform: (d) => [d[0], d[1] + Math.max(0, d[2]) * 0.5, d[2]],
            });
            break;
        case "long":
            // Droops from between the eyes toward the mouth.
            tube(
                builder,
                [0, 0.35, 0.7, 1].map((f) => ({
                    ...part,
                    at: add(base, [
                        0,
                        size * lerp(0.16, -0.12, f),
                        size * lerp(-0.04, 0.2, Math.sin(f * Math.PI * 0.6)),
                    ]),
                    ru: size * lerp(0.06, 0.1, f),
                    rv: size * lerp(0.07, 0.11, f),
                })),
                { segments: 10, bulge: 0.9 }
            );
            break;
        case "pointed":
            tube(
                builder,
                [0, 0.5, 1].map((f) => ({
                    ...part,
                    at: add(base, [
                        0,
                        -size * 0.03 * f,
                        size * lerp(-0.05, 0.3, f),
                    ]),
                    ru: size * lerp(0.1, 0.025, f),
                })),
                { segments: 10, bulge: 0.6 }
            );
            break;
    }
}

function buildEars(ctx: ToonContext, head: HeadShape, face: FaceLayout) {
    const { builder, colors, recipe, layout } = ctx;
    const style = recipe.head.ears;
    if (style === "none") return;
    const k =
        lerp(0.65, 1.5, recipe.head.earSize) * (style === "big" ? 1.45 : 1);
    const size = head.size * k;
    const halfWidth = head.halfWidthAt(face.ear.y) * head.size;
    for (const sign of [1, -1] as const) {
        const center: Vec3 = [
            head.center[0] + sign * (halfWidth + size * 0.03),
            head.center[1] + face.ear.y * head.size,
            head.center[2] - layout.head.halfDepth * 0.12,
        ];
        blob(builder, {
            color: colors.skin,
            weights: rigid("head"),
            center,
            radii: [size * 0.075, size * 0.17, size * 0.11],
            deform:
                style === "pointed"
                    ? (d) => [
                          d[0],
                          d[1] + Math.max(0, d[1]) * 0.9,
                          d[2] - Math.max(0, d[1]) * 0.7,
                      ]
                    : undefined,
        });
        const lobe: Vec3 = [
            center[0] + sign * size * 0.02,
            center[1] - size * 0.17,
            center[2],
        ];
        const earrings = recipe.extras.earrings;
        if (earrings === "studs")
            blob(builder, {
                color: colors.metal,
                weights: rigid("head"),
                outline: 0.5,
                center: lobe,
                radii: [
                    head.size * 0.035,
                    head.size * 0.035,
                    head.size * 0.035,
                ],
                rings: 5,
                segments: 8,
            });
        else if (earrings === "hoops") {
            const r = head.size * 0.1;
            const stations = [];
            for (let i = 0; i <= 14; i++) {
                const angle = (i / 14) * Math.PI * 2;
                stations.push({
                    color: colors.metal,
                    weights: rigid("head"),
                    outline: 0.5,
                    at: [
                        lobe[0],
                        lobe[1] - r + Math.cos(angle) * r,
                        lobe[2] + Math.sin(angle) * r,
                    ] as Vec3,
                    ru: head.size * 0.014,
                });
            }
            tube(builder, stations, {
                segments: 6,
                start: "open",
                end: "open",
                side: [1, 0, 0],
            });
        }
    }
}

function buildGlasses(ctx: ToonContext, head: HeadShape, face: FaceLayout) {
    const { builder, colors, recipe, layout } = ctx;
    const style = recipe.extras.glasses;
    if (style === "none") return;
    const { x, y, radius, aspect } = face.eye;
    const part = { color: colors.glasses, weights: rigid("head") };
    const wire = Math.max(layout.ink * 0.9, head.size * 0.022);
    // One flat lens plane, just in front of the eye domes.
    const z =
        head.front(x, y)[2] +
        radius * head.size * 0.3 +
        layout.ink +
        wire * 1.5;
    const toWorld = (fx: number, fy: number): Vec3 => [
        head.center[0] + fx * head.size,
        head.center[1] + fy * head.size,
        z,
    ];
    const rx = radius * 1.08;
    const ry = style === "round" ? radius * aspect * 1.08 : radius * 0.86;
    const power = style === "round" ? 2 : 4.5;
    const loop = (cx: number) => {
        const points: Vec3[] = [];
        for (let i = 0; i <= 24; i++) {
            const angle = (i / 24) * Math.PI * 2;
            const c =
                Math.sign(Math.cos(angle)) *
                Math.pow(Math.abs(Math.cos(angle)), 2 / power);
            const s =
                Math.sign(Math.sin(angle)) *
                Math.pow(Math.abs(Math.sin(angle)), 2 / power);
            points.push(toWorld(cx + c * rx, y + s * ry));
        }
        return points;
    };
    if (style === "visor") {
        const half = x + rx;
        blob(builder, {
            ...part,
            center: toWorld(0, y),
            radii: [
                half * 1.04 * head.size,
                radius * aspect * 1.08 * head.size,
                wire * 2.6,
            ],
            deform: (d) => [
                Math.sign(d[0]) * Math.pow(Math.abs(d[0]), 0.6),
                Math.sign(d[1]) * Math.pow(Math.abs(d[1]), 0.6),
                d[2] - Math.pow(Math.abs(d[0]), 2) * 6,
            ],
            rings: 8,
            segments: 20,
        });
    } else {
        for (const sign of [1, -1]) {
            const points = loop(x * sign);
            tube(
                builder,
                points.map((at) => ({ ...part, outline: 0.35, at, ru: wire })),
                { segments: 6, start: "open", end: "open", side: [0, 0, 1] }
            );
            if (style === "shades")
                blob(builder, {
                    ...part,
                    outline: 0,
                    center: toWorld(x * sign, y),
                    radii: [rx * head.size, ry * head.size, wire * 0.8],
                    deform: (d) => [
                        Math.sign(d[0]) * Math.pow(Math.abs(d[0]), 2 / power),
                        Math.sign(d[1]) * Math.pow(Math.abs(d[1]), 2 / power),
                        d[2],
                    ],
                    rings: 6,
                    segments: 20,
                });
        }
        if (x - rx > 0.01)
            tube(
                builder,
                [-1, 0, 1].map((f) => ({
                    ...part,
                    outline: 0.35,
                    at: toWorld(f * (x - rx), y + (1 - f * f) * 0.03),
                    ru: wire,
                })),
                { segments: 6, start: "open", end: "open" }
            );
    }
    // Temples run back to the ears.
    const earX = head.halfWidthAt(face.ear.y) + 0.02;
    for (const sign of [1, -1]) {
        const hinge = toWorld((x + rx) * sign, y);
        const ear: Vec3 = [
            head.center[0] + earX * head.size * sign,
            head.center[1] + face.ear.y * head.size + head.size * 0.1,
            head.center[2] - layout.head.halfDepth * 0.1,
        ];
        const mid: Vec3 = [
            head.center[0] + Math.max(earX, x + rx) * head.size * sign,
            lerp(hinge[1], ear[1], 0.5),
            lerp(hinge[2], ear[2], 0.35),
        ];
        tube(
            builder,
            [hinge, mid, ear].map((at) => ({
                ...part,
                outline: 0.35,
                at,
                ru: wire * 0.85,
            })),
            { segments: 6 }
        );
    }
}

export function buildHead(ctx: ToonContext, head: HeadShape, face: FaceLayout) {
    buildSkull(ctx, head);
    buildEye(ctx, head, face, 1);
    buildEye(ctx, head, face, -1);
    buildNose(ctx, head, face);
    buildEars(ctx, head, face);
    buildGlasses(ctx, head, face);
}
