import * as T from "three/webgpu";
import { Drawing, frontOfLoft } from "./drawing";
import type { Point } from "./sculpt";

const mix = T.MathUtils.lerp;

/** Four sewn quadrants connect the neck opening to chest and shoulder sockets.
 * The socket and the tube that starts there have identical positions and bones. */
export function streetYoke(
    d: Drawing,
    neck: Point[],
    chest: Point[],
    socket: (side: number) => Point[],
    color: string,
    shoulder?: number
) {
    const fronts: ReturnType<typeof frontOfLoft>[] = [];
    const n = chest.length - 1;
    for (const side of [-1, 1])
        for (const face of [1, -1]) {
            const sleeve = socket(side),
                steps = (sleeve.length - 1) / 2;
            const sideJoint = (side < 0 ? "right" : "left") + "UpperArm";
            const panels = Array.from({ length: steps + 1 }, (_, j) => {
                const t = j / steps;
                const edge =
                    sleeve[(face > 0 ? j : 2 * steps - j) % (steps * 2)];
                const path = Array.from({ length: n / 4 + 1 }, (_, k) => {
                    const i = (n + side * (face > 0 ? k : n / 2 - k)) % n;
                    const a = neck[i],
                        b = chest[i],
                        u = k / (n / 4);
                    const point = a.map((v, c) => mix(v, b[c], t)) as Point;
                    // The front and back roll around a deltoid or a dropped sleeve.
                    const wrap = Math.sin(t * Math.PI) * u * u;
                    point[2] = mix(point[2], edge[2], wrap * 0.79);
                    if (shoulder)
                        point[2] +=
                            face *
                            10 *
                            Math.sin(t * Math.PI) *
                            Math.sin((u * Math.PI) / 2);
                    return point;
                });
                const root = path.at(-1);
                path.push(
                    root.map((v, c) => mix(v, edge[c], 0.55)) as Point,
                    edge
                );
                return path;
            });
            // The inner columns meet the spine-weighted torso. The outer boundary
            // transfers completely to the upper arm. Keep two influences per vertex
            // for the shared crowd palette as well as the hero.
            const outerX = Math.abs(sleeve[0][0]);
            d.bind("chest");
            d.s.drape = {
                name: sideJoint,
                matrix: d.matrixFor(sideJoint),
                start: 0,
                end: 1,
                weight: (x, y) => {
                    const t = T.MathUtils.clamp(
                        (y - neck[n / 4][1]) /
                            (chest[n / 4][1] - neck[n / 4][1]),
                        0,
                        1
                    );
                    const inner = Math.abs(
                        mix(neck[n / 4][0], chest[n / 4][0], t)
                    );
                    const end = shoulder
                        ? mix(
                              shoulder + 14,
                              outerX,
                              T.MathUtils.smoothstep(t, 0.3, 0.88)
                          )
                        : outerX;
                    return T.MathUtils.smoothstep(
                        Math.abs(x),
                        inner,
                        Math.max(inner + 1, end)
                    );
                },
            };
            const wound = side * face > 0 ? panels : panels.slice().reverse();
            d.s.surface(wound, color, false, "perimeter");
            if (face > 0) fronts.push(frontOfLoft(panels));
        }
    return (x: number, y: number) => Math.max(...fronts.map((f) => f(x, y)));
}
