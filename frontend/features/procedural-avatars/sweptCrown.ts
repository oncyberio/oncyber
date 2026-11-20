import { MathUtils } from "three/webgpu";
import type { CartoonDesign } from "./cartoonCast";

/** A circumference can go down, up around a pointed lock, then down again.
 * Walk its traced meridian by distance to keep both sides of that cut. */
export function sweptCrown(
    edges: NonNullable<NonNullable<CartoonDesign["household"]>["crownEdges"]>
) {
    const rails = edges.map((path) => {
        const stations = [0];
        for (let i = 1; i < path.length; i++) {
            const [x, y] = path[i],
                [previousX, previousY] = path[i - 1];
            stations.push(
                stations[i - 1] +
                    Math.hypot((x - previousX) * 0.24, y - previousY)
            );
        }
        const total = stations.at(-1);
        return { path, stations: stations.map((v) => (0.44 * v) / total) };
    });
    function sample(side: number, t: number) {
        const { path, stations } = rails[side];
        if (t >= 0.44) return path.at(-1);
        const i = Math.max(
            1,
            stations.findIndex((v) => v >= t)
        );
        const u = (t - stations[i - 1]) / (stations[i] - stations[i - 1]);
        return [
            MathUtils.lerp(path[i - 1][0], path[i][0], u),
            MathUtils.lerp(path[i - 1][1], path[i][1], u),
        ];
    }
    return {
        project(
            sine: number,
            t: number,
            x: number,
            y: number
        ): [number, number] {
            const l = sample(0, t),
                r = sample(1, t);
            const fade = 1 - MathUtils.smoothstep(t, 0.44, 0.54);
            const side = (1 + sine) / 2;
            const edgeY = MathUtils.lerp(l[1], r[1], side);
            const lift =
                (edgeY - Math.min(0.44, t)) *
                Math.max(sine * sine, 1 - MathUtils.smoothstep(t, 0, 0.065));
            return [
                MathUtils.lerp(x, MathUtils.lerp(l[0], r[0], side), fade),
                y + fade * lift,
            ];
        },
        /** Redistribute existing rings so a tip and the notch beside it both
         * have a vertex on the silhouette. No extra band runs around the skull. */
        knots(angle: number, end: number, count: number) {
            const sine = Math.sin(angle);
            const side = sine >= 0 ? 1 : 0;
            const values = rails[side].stations.filter((t) => t < end - 1e-5);
            if (end > 0.55) {
                const intervals = Math.ceil((end - 0.54) / 0.11);
                for (let i = 0; i < intervals; i++)
                    values.push(0.54 + ((end - 0.54) * i) / intervals);
            }
            values.push(end);
            // Keep tight changes of direction before flat stretches. The lower
            // transition and the fringe endpoint also belong to this budget.
            while (values.length > count + 1) {
                let least = Infinity,
                    remove = 1;
                for (let i = 1; i < values.length - 1; i++) {
                    if (values[i] >= 0.44) continue;
                    const a = sample(side, values[i - 1]);
                    const b = sample(side, values[i]);
                    const c = sample(side, values[i + 1]);
                    const f =
                        (values[i] - values[i - 1]) /
                        (values[i + 1] - values[i - 1]);
                    const error = Math.hypot(
                        b[0] - MathUtils.lerp(a[0], c[0], f),
                        b[1] - MathUtils.lerp(a[1], c[1], f)
                    );
                    if (error < least) {
                        least = error;
                        remove = i;
                    }
                }
                values.splice(remove, 1);
            }
            while (values.length < count + 1) {
                let widest = 1;
                for (let i = 2; i < values.length; i++)
                    if (
                        values[i] - values[i - 1] >
                        values[widest] - values[widest - 1]
                    )
                        widest = i;
                values.splice(
                    widest,
                    0,
                    (values[widest - 1] + values[widest]) / 2
                );
            }
            return values.map((t, i) =>
                MathUtils.lerp(
                    end * (0.5 - 0.5 * Math.cos((Math.PI * i) / count)),
                    t,
                    Math.abs(sine) ** 3
                )
            );
        },
    };
}
