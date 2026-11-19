import type { Point } from "./sculpt";
import * as T from "three/webgpu";

/** Bend the original two-sided cross-section from the lining around a
 * measured front opening. The back and upper shoulder keep the OBJ contour. */
export function fitCoatRow(
    row: Point[],
    level: number,
    mirror: number,
    opening: number[]
): Point[] {
    const heights = [217, 245, 292, 340, 395, 453, 484];
    const hi = heights.findIndex((y) => y >= level);
    const a = hi < 0 ? 6 : Math.max(0, hi - 1),
        b = hi < 0 ? 6 : hi;
    const t = a === b ? 0 : (level - heights[a]) / (heights[b] - heights[a]);
    const ratio = T.MathUtils.lerp(opening[a], opening[b], t);
    const width = Math.max(...row.map((p) => p[0] - mirror));
    const depth = row.map((p) => p[2]);
    const back = Math.min(...depth);
    const foremost = Math.max(...depth);
    const lip = depth.indexOf(foremost);
    const blend = T.MathUtils.smoothstep(level, 190, 233);
    const fall = T.MathUtils.smoothstep(level, 470, 511);
    return Array.from({ length: 17 }, (_, i) => {
        const inner = i <= 8;
        const u = (inner ? i : 16 - i) / 8;
        const index = inner
            ? u * lip
            : row.length - 1 - u * (row.length - 1 - lip);
        const j = Math.floor(index),
            k = Math.min(row.length - 1, j + 1);
        const p = row[j].map((value, axis) =>
            T.MathUtils.lerp(value, row[k][axis], index - j)
        );
        const thickness =
            (inner ? -1 : 1) * 0.92 * (1 - T.MathUtils.smoothstep(u, 0.85, 1));
        const edge = width * ratio;
        const front =
            Math.max(17, foremost + 3) +
            5 * T.MathUtils.smoothstep(level, 240, 315);
        const angle = u <= 0.5 ? u * Math.PI : (u - 0.5) * Math.PI;
        const sin = Math.sin(angle),
            cos = Math.cos(angle);
        const x = u <= 0.5 ? width * sin : edge + (width - edge) * cos;
        const z = u <= 0.5 ? back * cos : front * sin;
        const dx = u <= 0.5 ? width * cos : -(width - edge) * sin;
        const dz = u <= 0.5 ? -back * sin : front * cos;
        const normal = thickness / Math.hypot(dx, dz);
        return [
            T.MathUtils.lerp(p[0], mirror + x + dz * normal, blend),
            p[1] + fall * (13 * u * u - 5),
            T.MathUtils.lerp(p[2], z - dx * normal, blend),
        ];
    });
}
