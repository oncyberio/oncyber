import { MathUtils } from "three/webgpu";
import { frontOfLoft, type Drawing, type XY } from "./drawing";
import type { Point } from "./sculpt";

export type Pinna = {
    side: -1 | 1;
    radii: number[];
    ink: string;
    inkWidth: number;
    folds?: { outline: XY[]; ink: string }[];
};

/** A closed pinna joins the measured temple at its anterior root. The outer
 * rim turns back towards the sagittal station inherited from the family. */
export function drawFrontalPinna(
    d: Drawing,
    pinna: Pinna,
    [cx, y, rx, ry]: number[],
    z: number,
    depth: number,
    skin: string
) {
    const side = pinna.side;
    const inner = z + depth * 1.22;
    const outer = z + 0.03 * depth;
    const at = (u: number, v: number, back = false): Point => {
        const plane = MathUtils.lerp(
            inner,
            outer,
            MathUtils.clamp((u + 1) / 2, 0, 1)
        );
        const dome = Math.max(0, 1 - u * u - v * v);
        const relief = back
            ? -depth * (0.35 + 0.94 * dome)
            : depth * (0.13 + 0.34 * dome);
        const root = back
            ? u - 0.36 * MathUtils.smoothstep(-u, -0.12, 0.78)
            : u;
        return [cx + side * rx * root, y + ry * v, plane + relief];
    };
    const boundary: XY[] = pinna.radii.map((r, i) => {
        const a = (2 * Math.PI * i) / pinna.radii.length;
        return [r * Math.cos(a), r * Math.sin(a)];
    });
    const loop = (points: Point[]) => [...points, points[0]];
    const rim = boundary.map(([u, v]) => at(u, v));
    const inside = boundary.map(([u, v]) => {
        const r = Math.hypot(u, v);
        const width = pinna.inkWidth * MathUtils.smoothstep(u / r, -0.56, 0.15);
        return at(u * (1 - width / r), v * (1 - width / r));
    });
    const center = loop(boundary.map(() => at(0, 0)));
    const middle = loop(boundary.map(([u, v]) => at(0.51 * u, 0.51 * v)));
    const front = [center, middle, loop(inside)];
    d.s.surface(front, skin, true, "end", 0.16);
    // Sew the painted edge into the front. The rim tapers to zero width at
    // the cheek and shares both sets of vertices with the neighboring skin.
    d.s.surface([loop(inside), loop(rim)], pinna.ink, true, "both");
    const rear = loop(
        boundary.map(([u, v]) => {
            const r = Math.hypot(u, v);
            const weight = (0.93 * Math.max(0.94, r)) / r;
            return at(u * weight, v * weight, true);
        })
    );
    d.s.surface(
        [loop(rim), rear, loop(boundary.map(() => at(0, 0, true)))],
        skin,
        true,
        "both",
        0.2
    );
    if (!pinna.folds) return;
    const surface = frontOfLoft(front);
    for (const fold of pinna.folds) {
        const outline: XY[] = fold.outline.map(([u, v]) => [
            cx + side * rx * u,
            y + ry * v,
        ]);
        d.decal(
            outline,
            (x, py) => {
                const z = surface(x, py);
                return Number.isFinite(z)
                    ? z + 0.24
                    : at((side * (x - cx)) / rx, (py - y) / ry)[2];
            },
            fold.ink
        );
    }
}
