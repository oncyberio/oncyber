import { MeshBuilder, Rgb, rgb } from "../kernel/build";
import { sheet } from "../kernel/sheet";
import type { Shape, Vec3 } from "../kernel/sdf";
import type { PaintedTexture } from "../paint/faceTexture";
import { ontoFront, Waist } from "./shirt";

export interface TieStyle {
    colour: string;
    stripe: string;
    /** The narrow end, seen behind the blade. */
    back: string;
    /** Knot to tip, in metres. */
    length: number;
    /** Half-width at the widest point. */
    width: number;
    /** How far the knot is pulled down from the collar, in metres. */
    loosen: number;
    /** Sideways drift over the tie's length, in metres. */
    skew: number;
    /** Stripes per repeat: 1 single, 2 paired. */
    paired: boolean;
}

const toSrgb = (c: number) =>
    c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

/** Diagonal stripes, tiling in both directions. */
export function tieTexture(style: TieStyle, size = 128): PaintedTexture {
    const base = rgb(style.colour);
    const stripe = rgb(style.stripe);
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            const t = ((x + y) / size) % 1;
            const line = (centre: number, half: number) => {
                const d = Math.min(
                    Math.abs(t - centre),
                    1 - Math.abs(t - centre)
                );
                return Math.min(1, Math.max(0, (half - d) * size * 0.9 + 0.5));
            };
            const amount = style.paired
                ? Math.max(line(0.42, 0.05), line(0.62, 0.05))
                : line(0.5, 0.11);
            // A fine silk rib across the weave.
            const rib =
                0.94 + 0.06 * Math.sin(((x - y) / size) * Math.PI * 2 * 16);
            const at = (x + y * size) * 4;
            for (let k = 0; k < 3; k++)
                data[at + k] = Math.round(
                    toSrgb((base[k] + (stripe[k] - base[k]) * amount) * rib) *
                        255
                );
            data[at + 3] = 255;
        }
    return { data, width: size, height: size };
}

/**
 * A necktie hanging down the shirt front: knot, blade, and the narrow end
 * showing behind. It lies on the cloth where the cloth is in the way and
 * hangs straight where it is not.
 */
export function buildTie(
    shirt: Shape,
    knot: Vec3,
    waist: Waist,
    style: TieStyle
) {
    const out = new MeshBuilder();
    const white: Rgb = [1, 1, 1];
    const top = knot[1] - style.loosen;
    const scale = 1 / 0.07;
    // The line the tie hangs along: it follows the shirt outwards, never back in.
    const rows = 26;
    const line: Vec3[] = [];
    let furthest = -Infinity;
    for (let i = 0; i < rows; i++) {
        const t = i / (rows - 1);
        const y = top - 0.012 - (style.length - 0.012) * t;
        const x = knot[0] + style.skew * t;
        let z =
            y > waist.y - 0.015
                ? ontoFront(shirt, x, y, 0.0035)[2]
                : waist.z + waist.rz + 0.014;
        furthest = Math.max(furthest, z);
        // Below the fullest point it hangs free, swinging in a little.
        z = Math.max(z, furthest - 0.02 * Math.max(0, t - 0.4));
        line.push([x, y, z]);
    }
    const lean = Math.atan2(style.skew, style.length);
    const blade = (
        halfWidth: (t: number) => number,
        dz: number,
        dx: number,
        colour: Rgb,
        from = 0,
        to = 1
    ) =>
        sheet(
            out,
            5,
            rows,
            (u, v) => {
                const t = from + (to - from) * v;
                const f = t * (rows - 1);
                const k = Math.min(rows - 2, Math.floor(f));
                const a = line[k];
                const b = line[k + 1];
                const w = halfWidth(t);
                const across = (u - 0.5) * 2;
                const centre: Vec3 = [
                    a[0] + (b[0] - a[0]) * (f - k) + dx * t,
                    a[1] + (b[1] - a[1]) * (f - k),
                    a[2] + (b[2] - a[2]) * (f - k) + dz,
                ];
                // A slight roll across the blade, as pressed silk has.
                const p: Vec3 = [
                    centre[0] + across * w * Math.cos(lean),
                    centre[1] - across * w * Math.sin(lean),
                    centre[2] + 0.0018 * (1 - across * across),
                ];
                return {
                    p,
                    colour,
                    uv: [across * w * scale, (top - centre[1]) * scale],
                };
            },
            0.0026,
            true
        );
    const point = 0.9;
    blade(
        (t) =>
            t < point
                ? 0.0125 + (style.width - 0.0125) * Math.pow(t / point, 1.25)
                : style.width * (1 - (t - point) / (1 - point)),
        0,
        0,
        white
    );
    // The narrow end: darker, a little to one side.
    const dark = rgb(style.back);
    const tone: Rgb = [dark[0] * 4, dark[1] * 4, dark[2] * 4];
    blade(
        (t) => (t < 0.93 ? 0.012 : 0.012 * (1 - (t - 0.93) / 0.07)),
        -0.0035,
        0.02,
        tone,
        0.5,
        0.985
    );
    // Knot: a wedge, wider at the top.
    const knotY = top;
    sheet(
        out,
        4,
        4,
        (u, v) => {
            const across = (u - 0.5) * 2;
            const w = 0.0165 - 0.0055 * v;
            const y = knotY + 0.013 - 0.03 * v;
            const p: Vec3 = [
                knot[0] + across * w,
                y,
                line[0][2] + 0.006 + 0.004 * (1 - across * across) - 0.003 * v,
            ];
            return {
                p,
                colour: white,
                uv: [across * w * scale + 0.3, v * 0.4],
            };
        },
        0.011,
        true
    );
    // The band running up under the collar on each side.
    for (const s of [1, -1])
        sheet(
            out,
            3,
            6,
            (u, v) => {
                const along = v;
                const x = knot[0] + s * (0.012 + 0.04 * along);
                const y = knotY + 0.01 + 0.05 * along * (1 - 0.3 * along);
                const z0 = ontoFront(
                    shirt,
                    x * 0.7,
                    Math.min(y, knot[1] + 0.02),
                    0.002
                )[2];
                const p: Vec3 = [
                    x,
                    y + (u - 0.5) * 0.02,
                    z0 - 0.03 * along * along - 0.002,
                ];
                return { p, colour: white, uv: [u * 0.3, along] };
            },
            0.002,
            s > 0
        );
    return out;
}
