import { MeshBuilder, Rgb, mixRgb, rgb, scaleRgb } from "../kernel/build";
import { smoothstep } from "../kernel/noise";
import type { Shape, Vec3 } from "../kernel/sdf";
import { FaceSpec, SkinField, lidFrame } from "./skinField";

export interface EyeStyle {
    iris: string;
    irisLight: string;
    pupil: string;
    white: string;
    /** Iris radius in metres on the eyeball. */
    irisRadius: number;
    /** Degrees the gaze turns to the avatar's left, and down. */
    gaze: [number, number];
    lash: string;
    /** Thickness of the upper lash line, and how far its wing flicks out. */
    lashWidth: number;
    lashWing: number;
}

export interface BrowStyle {
    colour: string;
    /** Points from inner to outer end, as [x, y] in head space. */
    path: [number, number][];
    /** Thickness at the inner end, the middle and the tail. */
    width: [number, number, number];
}

const add = (a: Vec3, b: Vec3, s = 1): Vec3 => [
    a[0] + b[0] * s,
    a[1] + b[1] * s,
    a[2] + b[2] * s,
];

/** Move a point straight back from in front of the face onto the head. */
export function ontoFace(head: Shape, x: number, y: number, lift = 0): Vec3 {
    let z = 0.14;
    for (let i = 0; i < 48; i++) {
        const d = head.eval(x, y, z) - lift;
        if (d < 0.00005) break;
        z -= d * 0.9;
    }
    return [x, y, z];
}

/** Eyeballs, catchlights, lash lines and brows, in reference head space. */
export function buildFaceDetails(
    skin: SkinField,
    eyes: EyeStyle,
    brows: BrowStyle,
    /**
     * Which details to build. The studio look shades eyes and facial hair
     * differently, so it asks for them apart and lights the eyes itself.
     */
    which: "all" | "eyes" | "hairs" = "all",
    studio = false
) {
    const face = skin.face;
    const out = new MeshBuilder();
    for (const s of [1, -1]) {
        if (which !== "hairs") eyeball(out, face, eyes, s, studio);
        if (which !== "eyes") {
            lashes(out, face, eyes, s);
            brow(out, skin.head, brows, s);
        }
    }
    // Head space to avatar space.
    for (let i = 0; i < out.positions.length; i += 3) {
        const p = skin.toHead([
            out.positions[i],
            out.positions[i + 1],
            out.positions[i + 2],
        ]);
        out.positions[i] = p[0];
        out.positions[i + 1] = p[1];
        out.positions[i + 2] = p[2];
    }
    return out;
}

function eyeball(
    out: MeshBuilder,
    face: FaceSpec,
    style: EyeStyle,
    s: number,
    studio = false
) {
    const centre: Vec3 = [face.eye[0] * s, face.eye[1], face.eye[2]];
    const R = face.eyeRadius;
    const yaw = (style.gaze[0] * Math.PI) / 180;
    const pitch = (style.gaze[1] * Math.PI) / 180;
    // Gaze frame: `fwd` through the pupil, `right` and `up` across the iris.
    const fwd: Vec3 = [
        Math.sin(yaw) * Math.cos(pitch),
        -Math.sin(pitch),
        Math.cos(yaw) * Math.cos(pitch),
    ];
    const right: Vec3 = [Math.cos(yaw), 0, -Math.sin(yaw)];
    const up: Vec3 = [
        fwd[1] * right[2] - fwd[2] * right[1],
        fwd[2] * right[0] - fwd[0] * right[2],
        fwd[0] * right[1] - fwd[1] * right[0],
    ];
    const iris = rgb(style.iris);
    const irisLight = rgb(style.irisLight);
    const pupil = rgb(style.pupil);
    const white = rgb(style.white);
    const irisAngle = style.irisRadius / R;
    const pupilAngle = irisAngle * 0.47;
    const lidY = centre[1] + Math.sin((face.upperLid * Math.PI) / 180) * R;
    // Rings from the pupil outwards; a repeated angle makes a crisp edge.
    const rings: { angle: number; colour: (az: number) => Rgb }[] = [
        { angle: 0, colour: () => pupil },
        { angle: pupilAngle, colour: () => pupil },
        {
            angle: pupilAngle,
            colour: () => scaleRgb(iris, 0.55),
        },
        {
            angle: irisAngle * 0.72,
            // A lighter crescent low in the iris, where light pools.
            colour: (az) =>
                mixRgb(iris, irisLight, smoothstep(0.1, -0.9, Math.sin(az))),
        },
        { angle: irisAngle * 0.93, colour: () => scaleRgb(iris, 0.5) },
        { angle: irisAngle, colour: () => scaleRgb(iris, 0.3) },
        { angle: irisAngle, colour: () => scaleRgb(white, 0.9) },
        { angle: irisAngle * 1.25, colour: () => white },
        { angle: 0.95, colour: () => scaleRgb(white, 0.93) },
        { angle: 1.45, colour: () => scaleRgb(white, 0.8) },
    ];
    const segments = studio ? 56 : 32;
    const base = out.count;
    for (const ring of rings)
        for (let i = 0; i < segments; i++) {
            const az = (i / segments) * Math.PI * 2;
            const sin = Math.sin(ring.angle);
            const dir: Vec3 = [
                fwd[0] * Math.cos(ring.angle) +
                    (right[0] * Math.cos(az) + up[0] * Math.sin(az)) * sin,
                fwd[1] * Math.cos(ring.angle) +
                    (right[1] * Math.cos(az) + up[1] * Math.sin(az)) * sin,
                fwd[2] * Math.cos(ring.angle) +
                    (right[2] * Math.cos(az) + up[2] * Math.sin(az)) * sin,
            ];
            const p = add(centre, dir, R);
            // The lid casts a soft shadow across the top of the eye.
            const lidShadow =
                0.5 + 0.5 * smoothstep(lidY + 0.0005, lidY - 0.0065, p[1]);
            if (studio) {
                // The shader lights the eye and adds its wet highlight; it
                // needs the true surface and the lid's shadow on its own.
                // Position on the iris plane, in iris radii: the shader
                // draws pupil, iris and white from it at any zoom.
                const r = ring.angle / irisAngle;
                out.auxNext = [lidShadow, 1, 0, 1];
                out.vertex(
                    p,
                    dir,
                    [1, 1, 1],
                    r * Math.cos(az),
                    r * Math.sin(az)
                );
                continue;
            }
            // Nearly flat normals: the eye is lit evenly, like a painted one.
            const nx = dir[0] * 0.22;
            const ny = dir[1] * 0.22 + 0.2;
            const nz = dir[2] * 0.22 + 0.78;
            const nl = Math.hypot(nx, ny, nz);
            out.vertex(
                p,
                [nx / nl, ny / nl, nz / nl],
                scaleRgb(ring.colour(az), lidShadow)
            );
        }
    for (let r = 0; r + 1 < rings.length; r++)
        for (let i = 0; i < segments; i++) {
            const a = base + r * segments + i;
            const b = base + r * segments + ((i + 1) % segments);
            const c = base + (r + 1) * segments + ((i + 1) % segments);
            const d = base + (r + 1) * segments + i;
            out.quad(a, d, c, b);
        }
    // Catchlights: a main one up and to one side, a small one opposite.
    const light = (
        azimuth: number,
        polar: number,
        radius: number,
        glow: number
    ) => {
        const sin = Math.sin(polar);
        const dir: Vec3 = [
            fwd[0] * Math.cos(polar) +
                (right[0] * Math.cos(azimuth) + up[0] * Math.sin(azimuth)) *
                    sin,
            fwd[1] * Math.cos(polar) +
                (right[1] * Math.cos(azimuth) + up[1] * Math.sin(azimuth)) *
                    sin,
            fwd[2] * Math.cos(polar) +
                (right[2] * Math.cos(azimuth) + up[2] * Math.sin(azimuth)) *
                    sin,
        ];
        const c = add(centre, dir, R + 0.00018);
        // Tangent axes of the disc.
        const tx: Vec3 = [
            right[0] -
                dir[0] *
                    (right[0] * dir[0] + right[1] * dir[1] + right[2] * dir[2]),
            right[1] -
                dir[1] *
                    (right[0] * dir[0] + right[1] * dir[1] + right[2] * dir[2]),
            right[2] -
                dir[2] *
                    (right[0] * dir[0] + right[1] * dir[1] + right[2] * dir[2]),
        ];
        const ty: Vec3 = [
            dir[1] * tx[2] - dir[2] * tx[1],
            dir[2] * tx[0] - dir[0] * tx[2],
            dir[0] * tx[1] - dir[1] * tx[0],
        ];
        const colour: Rgb = [glow, glow, glow];
        const mid = out.vertex(c, dir, colour);
        const n = 12;
        const first = out.count;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            out.vertex(
                add(
                    add(c, tx, Math.cos(a) * radius),
                    ty,
                    Math.sin(a) * radius * 0.85
                ),
                dir,
                colour
            );
        }
        for (let i = 0; i < n; i++)
            out.tri(mid, first + i, first + ((i + 1) % n));
    };
    if (studio) return;
    light(0.35, irisAngle * 0.5, style.irisRadius * 0.21, 1.6);
    light(Math.PI + 0.5, irisAngle * 0.62, style.irisRadius * 0.1, 1.2);
}

/** Lash lines: tapered tubes laid along the lid edges. */
function lashes(out: MeshBuilder, face: FaceSpec, style: EyeStyle, s: number) {
    const colour = rgb(style.lash);
    const arc = (upper: boolean, from: number, to: number, samples: number) => {
        const frame = lidFrame(face, s, upper);
        const R =
            (upper
                ? face.lidRadius
                : face.eyeRadius +
                  (face.lidRadius - face.eyeRadius) *
                      0.45 *
                      Math.max(0.3, face.lowerLid_rim)) + 0.0002;
        const path: Vec3[] = [];
        const normals: Vec3[] = [];
        for (let i = 0; i < samples; i++) {
            const t = i / (samples - 1);
            const a = ((from + (to - from) * t) * Math.PI) / 180;
            const dir: Vec3 = [
                frame.across[0] * Math.sin(a) + frame.forward[0] * Math.cos(a),
                frame.across[1] * Math.sin(a) + frame.forward[1] * Math.cos(a),
                frame.across[2] * Math.sin(a) + frame.forward[2] * Math.cos(a),
            ];
            path.push(add(frame.centre, dir, R));
            normals.push(dir);
        }
        return { path, normals, frame };
    };
    // Upper line: thickest past the middle, flicking up at the outer corner.
    const top = arc(true, -58, 62, 22);
    const wing = style.lashWing;
    if (wing > 0) {
        const last = top.path[top.path.length - 1];
        const before = top.path[top.path.length - 2];
        const dir: Vec3 = [
            last[0] - before[0],
            last[1] - before[1],
            last[2] - before[2],
        ];
        const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
        for (let i = 1; i <= 3; i++) {
            const t = i / 3;
            top.path.push([
                last[0] + (dir[0] / l) * wing * t,
                last[1] + (dir[1] / l) * wing * t + wing * 0.42 * t * t,
                last[2] + (dir[2] / l) * wing * t,
            ]);
            top.normals.push(top.normals[top.normals.length - 1]);
        }
    }
    out.tube(
        top.path,
        6,
        (t) =>
            style.lashWidth *
            (0.3 + 0.7 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.62)) *
            smoothstep(1, 0.8, t),
        () => colour,
        { normals: top.normals, flatten: 0.55 }
    );
    // Lower line: only a hint, on the outer half.
    const low = arc(false, 2, 56, 10);
    out.tube(
        low.path,
        5,
        (t) =>
            style.lashWidth *
            0.32 *
            Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.85)),
        () => mixRgb(colour, [0.25, 0.12, 0.09], 0.5),
        { normals: low.normals, flatten: 0.5 }
    );
}

/** A brow: a flat tapered ribbon lying on the brow bone. */
function brow(out: MeshBuilder, head: Shape, style: BrowStyle, s: number) {
    const colour = rgb(style.colour);
    const samples = 14;
    const path: Vec3[] = [];
    const normals: Vec3[] = [];
    const pts = style.path;
    for (let i = 0; i < samples; i++) {
        const u = (i / (samples - 1)) * (pts.length - 1);
        const k = Math.min(pts.length - 2, Math.floor(u));
        const t = u - k;
        const x = (pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t) * s;
        const y = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t;
        const p = ontoFace(head, x, y, 0.0003);
        const px = ontoFace(head, x + 0.001, y, 0.0003);
        const py = ontoFace(head, x, y + 0.001, 0.0003);
        // Surface normal from two neighbours.
        const ax: Vec3 = [px[0] - p[0], px[1] - p[1], px[2] - p[2]];
        const ay: Vec3 = [py[0] - p[0], py[1] - p[1], py[2] - p[2]];
        const n: Vec3 = [
            ax[1] * ay[2] - ax[2] * ay[1],
            ax[2] * ay[0] - ax[0] * ay[2],
            ax[0] * ay[1] - ax[1] * ay[0],
        ];
        const l = Math.hypot(n[0], n[1], n[2]) || 1;
        path.push(p);
        normals.push([n[0] / l, n[1] / l, n[2] / l]);
    }
    const [w0, w1, w2] = style.width;
    out.tube(
        path,
        6,
        (t) =>
            (t < 0.45
                ? w0 + (w1 - w0) * smoothstep(0, 0.45, t)
                : w1 + (w2 - w1) * smoothstep(0.45, 1, t)) *
            0.5 *
            smoothstep(0, 0.08, t),
        (t) => scaleRgb(colour, 0.85 + 0.3 * t),
        { normals, flatten: 0.22 }
    );
}
