import type { SkinFn } from "../assemble";
import { MeshBuilder, Rgb, mixRgb, rgb } from "../kernel/build";
import { fbm, noise3, smoothstep } from "../kernel/noise";
import type { Rig } from "../rig";
import type { Waist } from "./shirt";

export interface SkirtStyle {
    kind: "skirt";
    cloth: string;
    /** Colour inside the pleats. */
    shadow: string;
    /** Colour where the folds catch the light. */
    edge: string;
    lining: string;
    hemY: number;
    /** Half-width and half-depth at the hem. */
    hem: [number, number];
    pleats: number;
    /** Depth of a pleat at the hem, in metres. */
    depth: number;
}

/**
 * A knife-pleated skirt. Each pleat is a sawtooth in the cross-section: a
 * broad face, a sharp fold, and a tuck back under the next pleat. Pleats are
 * stitched flat at the waistband and open towards the hem.
 */
export function buildSkirt(waist: Waist, style: SkirtStyle) {
    const out = new MeshBuilder();
    const cloth = rgb(style.cloth);
    const shadow = rgb(style.shadow);
    const edge = rgb(style.edge);
    const lining = rgb(style.lining);
    const top = waist.y;
    const bandBottom = top - 0.034;
    const pleats = style.pleats;
    // Across one pleat: [fraction of its width, depth -1..1, light 0..1].
    const profile: [number, number, number][] = [
        [0, 1, 1],
        [0.06, 0.92, 0.9],
        [0.5, 0.3, 0.62],
        [0.84, -0.35, 0.4],
        [0.93, -1, 0.08],
        [0.975, -0.2, 0.2],
    ];
    const columns = pleats * profile.length;
    const rows = 18;
    const ellipse = (angle: number, rx: number, rz: number) => {
        // Radius of an ellipse along a direction; keeps pleats evenly spaced.
        const c = Math.cos(angle) / rz;
        const s = Math.sin(angle) / rx;
        return 1 / Math.sqrt(c * c + s * s);
    };
    const surface = (
        row: number,
        column: number,
        inset: number,
        drop: number,
        tint: (base: Rgb, light: number, v: number) => Rgb
    ) => {
        const v = row / (rows - 1);
        const pleat = Math.floor(column / profile.length);
        const [fraction, depthSign, light] = profile[column % profile.length];
        const angle = ((pleat + fraction) / pleats) * Math.PI * 2 + 0.11;
        // Row 0-2 form the waistband; pleats open below it.
        const band = Math.min(1, row / 2);
        const y =
            row <= 2
                ? top - (top - bandBottom) * band
                : bandBottom -
                  (bandBottom - style.hemY) * ((row - 2) / (rows - 3)) -
                  drop;
        const fall = row <= 2 ? 0 : (row - 2) / (rows - 3);
        // A bell: out over the hips quickly, then falling straighter.
        const flare = 1 - Math.pow(1 - fall, 1.9);
        const rx = waist.rx + 0.005 + (style.hem[0] - waist.rx) * flare;
        const rz = waist.rz + 0.005 + (style.hem[1] - waist.rz) * flare;
        const sway =
            1 +
            0.035 *
                fall *
                (noise3(Math.cos(angle) * 1.7, Math.sin(angle) * 1.7, 3) -
                    0.5) *
                2;
        const depth =
            style.depth * smoothstep(0, 0.55, fall) * (0.35 + 0.65 * fall);
        const radius =
            ellipse(angle, rx, rz) * sway + depthSign * depth - inset;
        const flutter = fall * fall * 0.006 * Math.sin(angle * pleats + 1.3);
        const p: [number, number, number] = [
            Math.sin(angle) * radius,
            y + flutter,
            waist.z * (1 - fall) + Math.cos(angle) * radius - 0.012 * flare,
        ];
        return {
            p,
            color: tint(
                cloth,
                row <= 2
                    ? 0.7
                    : light * (0.25 + 0.75 * smoothstep(0, 0.4, fall)) +
                          0.75 * (1 - smoothstep(0, 0.4, fall)),
                v
            ),
        };
    };
    const weave = (p: number[]) =>
        0.92 + 0.16 * fbm(p[0] * 70, p[1] * 22, p[2] * 70, 2);
    // Outside.
    out.grid(
        rows,
        columns,
        true,
        (row, column) => {
            const s = surface(row, column, 0, 0, (base, light) =>
                light > 0.8
                    ? mixRgb(base, edge, ((light - 0.8) / 0.2) * 0.55)
                    : mixRgb(shadow, base, smoothstep(0, 0.8, light))
            );
            const k = weave(s.p);
            return {
                p: s.p,
                color: [s.color[0] * k, s.color[1] * k, s.color[2] * k],
            };
        },
        true
    );
    // Inside of the cloth, seen from below.
    out.grid(
        rows,
        columns,
        true,
        (row, column) => {
            const s = surface(row, column, 0.0025, 0, (base) =>
                mixRgb(shadow, base, 0.25)
            );
            return { p: s.p, color: s.color };
        },
        false
    );
    // A dark lining that hangs a little below the hem.
    out.grid(
        6,
        pleats * 2,
        true,
        (row, column) => {
            const fall = 0.45 + (row / 5) * 0.55;
            const angle = (column / (pleats * 2)) * Math.PI * 2;
            const flare = 1 - Math.pow(1 - fall, 1.9);
            const rx = waist.rx + (style.hem[0] - waist.rx) * flare - 0.022;
            const rz = waist.rz + (style.hem[1] - waist.rz) * flare - 0.022;
            const ripple =
                0.006 * fall * Math.sin(angle * 9 + 0.6) +
                0.004 * fall * Math.sin(angle * 23);
            const radius = ellipse(angle, rx, rz) + ripple;
            const y =
                bandBottom -
                (bandBottom -
                    style.hemY +
                    0.014 +
                    0.006 * Math.sin(angle * 3 + 1)) *
                    fall;
            const p: [number, number, number] = [
                Math.sin(angle) * radius,
                y,
                waist.z * (1 - fall) + Math.cos(angle) * radius - 0.012 * flare,
            ];
            return {
                p,
                color: [
                    lining[0] * (0.7 + 0.5 * fall),
                    lining[1] * (0.7 + 0.5 * fall),
                    lining[2] * (0.7 + 0.5 * fall),
                ],
            };
        },
        true
    );
    return out;
}

/**
 * Skin a skirt: it hangs from the hips, and each thigh carries the cloth in
 * front of and behind it, more so towards the hem.
 */
export function skirtSkin(rig: Rig, waist: Waist, hemY: number): SkinFn {
    const hips = rig.index.hips;
    const spine = rig.index.spine;
    const left = rig.index.leftUpperLeg;
    const right = rig.index.rightUpperLeg;
    const hipY = rig.body.upperLeg[1];
    return (x, y, _z, out) => {
        const fall = smoothstep(hipY + 0.02, hemY, y);
        const legs = 0.78 * fall;
        const l = smoothstep(-0.11, 0.11, x);
        const up = smoothstep(waist.y - 0.04, waist.y + 0.01, y) * 0.4;
        out.clear()
            .add(spine, up)
            .add(hips, (1 - legs) * (1 - up))
            .add(left, legs * l)
            .add(right, legs * (1 - l))
            .finish();
    };
}
