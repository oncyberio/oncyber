import type { Point } from "./sculpt";

/** Protect bends that define a visible outline on a turn. Flat runs between
 * bends remain available for edge collapse regardless of their ring density. */
export function turnContours(rings: Point[][], tolerance: number) {
    const retained = new Set<string>();
    const stamp = (p: Point) => p.map(Math.fround).join("/");
    for (const degrees of [0, 35, 90, 145]) {
        const angle = (degrees * Math.PI) / 180;
        const c = Math.cos(angle),
            s = Math.sin(angle);
        const project = (p: Point) => p[0] * c + p[2] * s;
        for (const sign of [-1, 1]) {
            const edge = rings.map((row) =>
                row.reduce((a, b) =>
                    sign * project(b) > sign * project(a) ? b : a
                )
            );
            const trace = (lo: number, hi: number) => {
                const a = edge[lo],
                    b = edge[hi];
                const dx = project(b) - project(a),
                    dy = b[1] - a[1];
                const length = dx * dx + dy * dy;
                let split = lo,
                    worst = tolerance * tolerance;
                for (let i = lo + 1; i < hi; i++) {
                    const x = project(edge[i]) - project(a),
                        y = edge[i][1] - a[1];
                    const u = length
                        ? Math.max(0, Math.min(1, (x * dx + y * dy) / length))
                        : 0;
                    const error = (x - u * dx) ** 2 + (y - u * dy) ** 2;
                    if (error > worst) {
                        worst = error;
                        split = i;
                    }
                }
                if (split === lo) return;
                retained.add(stamp(edge[split]));
                trace(lo, split);
                trace(split, hi);
            };
            retained.add(stamp(edge[0]));
            retained.add(stamp(edge.at(-1)));
            trace(0, edge.length - 1);
        }
    }
    return (x: number, y: number, z: number) =>
        retained.has([x, y, z].join("/"));
}
