import * as T from "three/webgpu";
import type { Drawing, XY } from "./drawing";
import type { Point } from "./sculpt";

export interface JerseySleeve {
    /** Distance from sternum to cuff in the registered family drawing. */
    span: number;
    /** Upper and lower edges relative to arm height at five chest-to-cuff stations. */
    rows: XY[];
    /** Exposed arm edges at the cuff, in elbow radii. */
    armhole?: XY;
    tilt: number;
    bands: { start: number; end: number; color: string }[];
}

/** Wrap the observed front cut around the arm. The fabric and its bindings
 * meet at identical rings even when a stripe crosses the slanted opening. */
export function drawJerseySleeve(
    d: Drawing,
    bone: string,
    cut: JerseySleeve,
    cloth: string
) {
    const center = d.sourceJoints.get("upperChest").point[0];
    const shoulder = d.sourceJoints.get(bone).point;
    const sign = Math.sign(shoulder[0] - center);
    const span = cut.span;
    const armY = shoulder[1],
        armZ = shoulder[2];
    const sides = d.s.detail === "crowd" ? 8 : 12;
    const stations = [0.52, 0.62, 0.72, 0.82, 0.92];
    const section = (t: number) => {
        const range = T.MathUtils.clamp((t - stations[0]) * 10, 0, 4);
        const i = Math.min(3, Math.floor(range));
        return cut.rows[i].map(
            (a, k) => T.MathUtils.lerp(a, cut.rows[i + 1][k], range - i) * span
        );
    };
    const ring = (t: number): Point[] => {
        const [top, bottom] = section(t);
        const radius = (bottom - top) * 0.5;
        const depth =
            radius *
            T.MathUtils.lerp(0.22, 0.88, T.MathUtils.smoothstep(t, 0.36, 0.67));
        return Array.from({ length: sides + 1 }, (_, i) => {
            const angle = (2 * Math.PI * (i % sides)) / sides;
            const vertical = Math.sin(angle);
            return [
                center +
                    sign *
                        span *
                        (t -
                            cut.tilt *
                                vertical *
                                T.MathUtils.smoothstep(t, 0.72, 0.94)),
                armY + (top + bottom) * 0.5 + radius * vertical,
                armZ + depth * Math.cos(angle),
            ];
        });
    };
    d.s.blend = undefined;
    d.drape("upperChest", bone, 0, 1);
    d.s.drape.weight = (x) =>
        T.MathUtils.smoothstep(Math.abs(x - center) / span, 0.45, 0.85);
    d.s.tone = (_, y) =>
        1 -
        0.34 *
            T.MathUtils.smoothstep(y, armY + span * 0.05, armY + span * 0.27);
    d.s.printUV = undefined;
    // Bindings belong to the cloth shell. A band adds two rings and uses the
    // same indexed mesh and material as the jersey.
    const edges = [
        ...new Set([0.36, ...cut.bands.flatMap((b) => [b.start, b.end]), 1]),
    ].sort((a, b) => a - b);
    for (let i = 1; i < edges.length; i++) {
        const a = edges[i - 1],
            b = edges[i],
            mid = (a + b) / 2;
        const band = cut.bands.find((v) => v.start < mid && mid < v.end);
        const rings = [a, ...stations.filter((t) => a < t && t < b), b].map(
            ring
        );
        d.s.surface(
            sign > 0 ? rings.reverse() : rings,
            band?.color ?? cloth,
            true,
            "perimeter"
        );
    }
    const opening = ring(1);
    const cap: Point = [
        center + sign * span,
        armY + (cut.rows[4][0] + cut.rows[4][1]) * span * 0.5,
        armZ,
    ];
    const lining = [opening, opening.map(() => cap)];
    d.s.surface(
        sign > 0 ? lining.reverse() : lining,
        cut.bands.find((b) => b.end === 1)?.color ?? cloth,
        true,
        "perimeter"
    );
    d.s.drape = undefined;
    d.s.tone = undefined;
}
