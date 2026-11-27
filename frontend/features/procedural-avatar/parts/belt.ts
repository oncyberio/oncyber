import { MeshBuilder, mixRgb, rgb } from "../kernel/build";
import { box } from "../kernel/solids";
import { Basis, euler } from "../kernel/sdf";
import type { Waist } from "./shirt";

export interface BeltStyle {
    leather: string;
    buckle: string;
    /** Colour of the loops, normally the cloth they are sewn to. */
    loops: string;
    height: number;
}

/** Radius of the waist ellipse along an angle measured from the front. */
export function waistRadius(waist: Waist, angle: number, grow = 0) {
    const c = Math.cos(angle) / (waist.rz + grow);
    const s = Math.sin(angle) / (waist.rx + grow);
    return 1 / Math.sqrt(c * c + s * s);
}

/** A point on the waistband, `grow` metres outside it. */
export function waistPoint(
    waist: Waist,
    angle: number,
    y: number,
    grow = 0
): [number, number, number] {
    const r = waistRadius(waist, angle, grow);
    return [Math.sin(angle) * r, y, waist.z + Math.cos(angle) * r];
}

/** A leather belt through cloth loops, with a plain frame buckle. */
export function buildBelt(waist: Waist, style: BeltStyle) {
    const out = new MeshBuilder();
    const leather = rgb(style.leather);
    const buckle = rgb(style.buckle);
    const loops = rgb(style.loops);
    const y = waist.y - 0.006 - style.height / 2;
    const half = style.height / 2;
    const thick = 0.0042;
    const off = 0.0065;
    // Strap cross-section: a flat face with rounded edges, then the back.
    const profile: [number, number, number][] = [
        [-half, 0.001, 0.55],
        [-half + 0.002, thick, 0.85],
        [-half * 0.4, thick + 0.0004, 1.25],
        [half * 0.4, thick + 0.0004, 1],
        [half - 0.002, thick, 0.8],
        [half, 0.001, 0.5],
    ];
    const segments = 56;
    out.grid(
        profile.length,
        segments,
        true,
        (row, column) => {
            const [dy, grow, light] = profile[row];
            const angle = (column / segments) * Math.PI * 2;
            return {
                p: waistPoint(waist, angle, y + dy, off + grow),
                color: [
                    leather[0] * light,
                    leather[1] * light,
                    leather[2] * light,
                ],
            };
        },
        false
    );
    const facing = (angle: number): Basis => euler(0, angle, 0);
    // Loops the belt runs through.
    for (const angle of [0.52, -0.52, 1.75, -1.75, Math.PI]) {
        const p = waistPoint(waist, angle, y, off + thick + 0.0012);
        box(
            out,
            p,
            [0.0055, half + 0.0055, 0.0012],
            loops,
            facing(angle),
            0.0006
        );
    }
    // Buckle: a frame and a prong, front and centre.
    const centre = waistPoint(waist, 0, y, off + thick + 0.002);
    const basis = facing(0);
    const w = 0.02;
    const h = half + 0.004;
    const bar = 0.0024;
    const metal = (n: readonly number[]) =>
        mixRgb(buckle, [1, 1, 1], n[1] > 0.5 ? 0.35 : 0);
    box(
        out,
        [centre[0], centre[1] + h, centre[2]],
        [w, bar, bar],
        metal,
        basis
    );
    box(
        out,
        [centre[0], centre[1] - h, centre[2]],
        [w, bar, bar],
        metal,
        basis
    );
    box(
        out,
        [centre[0] - w, centre[1], centre[2]],
        [bar, h, bar],
        metal,
        basis
    );
    box(
        out,
        [centre[0] + w, centre[1], centre[2]],
        [bar, h, bar],
        metal,
        basis
    );
    box(
        out,
        [centre[0] + 0.004, centre[1], centre[2] + 0.001],
        [w * 0.8, 0.0014, 0.0014],
        metal,
        basis
    );
    return out;
}
