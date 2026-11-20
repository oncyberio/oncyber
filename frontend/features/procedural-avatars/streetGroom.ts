import * as T from "three/webgpu";
import type { Drawing } from "./drawing";
import type { Point } from "./sculpt";
import { silhouetteTile } from "./surfaces";
import { streetHairTile } from "./streetBrush";
import { streetShade, type StreetPattern } from "./streetwearPattern";

const mix = T.MathUtils.lerp,
    smooth = T.MathUtils.smoothstep,
    pi = Math.PI,
    tau = 2 * pi;
const series = (n: number) => Array.from({ length: n + 1 }, (_, i) => i / n);

/** Each patch follows a lock, including the turned-under edge at the fringe. */
export function drawStreetGroom(d: Drawing, p: StreetPattern) {
    const { width, depth } = p.head,
        rx = width * 1.11,
        ry = 57,
        rz = depth + 14;
    const dye = (hex: string) =>
        parseInt(streetShade(p.colors.hair, "#fdedd3", hex).slice(1), 16);
    const fiber = (
        rows: Point[][],
        mode: number,
        color: number,
        angles?: number[]
    ) => {
        d.s.printUV = (_x, _y, around, _z, along) => {
            const u = angles
                ? angles[Math.round(around * (angles.length - 1))]
                : around;
            return [
                streetHairTile + 0.003 + u * 0.994,
                mode + 0.005 + along * 0.99,
            ];
        };
        d.s.vertexPaint = () => color;
        d.s.surface(rows, p.colors.hair, false, "perimeter");
    };
    d.s.sculptedCartoon = false;
    d.s.sourcePaint = false;
    d.s.thinSkinOutline = false;
    d.drape("head", "upperChest", 193, p.hair.nape);
    const length = p.hair.nape;
    const fall = [
        [103, 40, 0, -52],
        [128, 51, 18, -58],
        [163, 51, 23, -63],
        [203, 52, -1, -66],
        [250, 53, -32, -68],
        [length - 72, 56, -48, -79],
        [length - 25, 52, -47, -77],
        [length, 22, -53, -62],
    ];
    for (let j = 0; j < 7; j++) {
        const rows = fall.map(([y, w, front, back]) =>
            series(4).map((u) => {
                const restAngle = ((j + u) * tau) / 7;
                const a =
                        restAngle +
                        0.085 *
                            Math.sin(2 * restAngle - 0.8) *
                            smooth(y, 123, 260),
                    lock = 2.8 * Math.cos(7 * a + 0.45) * smooth(y, 127, 211),
                    weight = smooth(y, length - 68, length);
                return [
                    Math.sin(a) * (w + lock),
                    y -
                        weight *
                            (4 +
                                11 * Math.cos(a * 3 + 0.5) +
                                8 * Math.cos(a * 5)),
                    mix(back, front, (1 + Math.cos(a)) / 2) +
                        1.7 * Math.sin(3 * a) +
                        lock * Math.cos(a),
                ] as Point;
            })
        );
        fiber(rows, 2, dye("#fff0d5"));
    }
    d.bind("head");
    for (const [ax, ay, az, bx, by, bz, r] of p.hair.spikes) {
        const a = new T.Vector3(ax, ay, az),
            b = new T.Vector3(bx, by, bz),
            v = b.clone().sub(a).normalize();
        const wide = new T.Vector3(-v.y, v.x, 0).normalize(),
            round = v.clone().cross(wide).normalize();
        const spoke = (
            t: number,
            size: number,
            angle: number,
            outline = 0
        ): Point => {
            const center = a.clone().lerp(b, t);
            center.y += 2.4 * Math.sin(pi * t);
            return center
                .addScaledVector(v, t * outline)
                .addScaledVector(wide, (r * size + outline) * Math.cos(angle))
                .addScaledVector(
                    round,
                    (0.62 * r * size + outline) * Math.sin(angle)
                )
                .toArray() as Point;
        };
        const shape = [
            [0, 0.88],
            [0.24, 1],
            [0.69, 0.43],
            [1, 0],
        ];
        for (let half = 0; half < 2; half++) {
            const rows = shape.map(([t, size]) =>
                series(5).map((u) => spoke(t, size, (half + u) * pi))
            );
            fiber(rows, 3, dye("#f8dfb8"));
        }
        // The ring matches the spike's own sections. A backface line stays
        // visible at oblique angles where a painted edge would leave the tip.
        d.s.printUV = () => [silhouetteTile + 0.5, 0.5];
        d.s.vertexPaint = () => dye("#443324");
        const shell = shape
            .filter(([t]) => t === 0.24 || t === 1)
            .map(([t, size]) =>
                series(10).map((u) =>
                    t === 1
                        ? (b
                              .clone()
                              .addScaledVector(v, 1.35)
                              .toArray() as Point)
                        : spoke(t, size, (u % 1) * tau, 1.24)
                )
            );
        d.s.surface(shell, p.colors.hair, false, "perimeter");
    }
    // The front drawing determines each central cleft. Around the temple the
    // side drawing determines where the lock frees itself from the forehead.
    const fringe = p.hair.fringe
        .filter(([x]) => Math.abs(x) <= 36)
        .map(([x, y]) => {
            const phi = Math.acos((107 - y) / ry);
            return [
                Math.asin(
                    T.MathUtils.clamp(
                        x / (53.28 * Math.sin(phi)),
                        -0.996,
                        0.996
                    )
                ),
                y + 1.6 * smooth(y, 111, 123),
            ];
        });
    const lateral = p.faceFit.crown
        .filter(([a]) => Math.abs(a) > 0.85 && Math.abs(a) < 1.34)
        .map(([a, y]) => [a, y]);
    const observed = [
        [-pi, 160],
        [-2.5, 151],
        [-2.1, 131],
        [-1.69, 119],
        ...lateral,
        ...fringe,
        [1.69, 119],
        [2.1, 131],
        [2.5, 151],
        [pi, 160],
    ].sort((a, b) => a[0] - b[0]);
    const edge = observed.filter(
        (v, i) => i === 0 || v[0] - observed[i - 1][0] > 0.022
    );
    const boundaries = [0];
    for (let i = 1; i < edge.length - 1; i++) {
        if (
            edge[i][1] < edge[i - 1][1] &&
            edge[i][1] < edge[i + 1][1] &&
            edge[i][0] - edge[boundaries.at(-1)][0] > 0.123
        )
            boundaries.push(i);
    }
    boundaries.push(edge.length - 1);
    const point = (a: number, t: number, across: number, h: number): Point => {
        const end = Math.acos(T.MathUtils.clamp((107 - h) / ry, -0.996, 0.996));
        // Keep the dome circular down to the brow. Each fringe tip leaves that
        // horizontal ring independently, preserving a smooth turn at the temple.
        const lat =
            t < 0.68 ? (1.26 * t) / 0.68 : mix(1.26, end, (t - 0.68) / 0.32);
        const flow = a + 0.045 * Math.sin(2 * a - 0.3) * Math.sin(pi * t);
        const relief =
            1.55 * Math.sin(pi * across) ** 2 * smooth(t, 0.68, 0.95);
        return [
            (rx + relief) * Math.sin(lat) * Math.sin(flow),
            107 - ry * Math.cos(lat),
            10 + (rz + relief) * Math.sin(lat) * Math.cos(flow),
        ];
    };
    d.s.surfaceNormal = (x, y, z) =>
        new T.Vector3(
            x / (rx * rx),
            (y - 107) / (ry * ry),
            (z - 10) / (rz * rz)
        )
            .normalize()
            .toArray() as Point;
    const domeAngles: number[] = [];
    for (let k = 1; k < boundaries.length; k++) {
        const first = boundaries[k - 1],
            last = boundaries[k],
            left = edge[first][0],
            right = edge[last][0];
        const count = Math.max(2, Math.ceil((right - left) * 6));
        const samples = [
            left,
            ...series(count)
                .slice(1, -1)
                .map((t) => mix(left, right, t)),
            ...edge.slice(first + 1, last).map(([a]) => a),
            right,
        ].sort((a, b) => a - b);
        const angles = samples.filter(
            (a, i) =>
                i === 0 ||
                a - samples[i - 1] > 0.0035 ||
                i === samples.length - 1
        );
        const us = angles.map((a) => (a - left) / (right - left));
        const heights = angles.map((a) => {
            const i = edge.findIndex(([angle]) => angle >= a);
            if (i <= 0) return i === 0 ? edge[0][1] : edge.at(-1)[1];
            const lo = edge[i - 1],
                hi = edge[i];
            return mix(lo[1], hi[1], (a - lo[0]) / (hi[0] - lo[0]));
        });
        const ringAt = (t: number) =>
            angles.map((a, i) => point(a, t, us[i], heights[i]));
        const hem = ringAt(1);
        // A sloping cut needs more vertical thickness than a horizontal cut
        // to give the same width of ink on the surface.
        const inkEdge = angles.map((a, i) => {
            const before = Math.max(0, i - 1),
                after = Math.min(i + 1, angles.length - 1);
            const slope =
                (heights[after] - heights[before]) /
                ((angles[after] - angles[before]) * rx);
            const width = Math.min(4.5, 1.12 * Math.hypot(1, slope));
            return point(a, 1, us[i], heights[i] - width);
        });
        domeAngles.push(...(k === 1 ? angles : angles.slice(1)));
        const rows = [0.68, 0.83, 0.93].map((t) => ringAt(t));
        rows.push(inkEdge);
        fiber(rows, 0, dye("#fff1d9"), us);
        // Both sides terminate at the same stitched ring. An ink overlay
        // on the dome would flicker as the underlying mesh simplifies.
        d.s.printUV = undefined;
        d.s.vertexPaint = () => dye("#422e21");
        d.s.surface([inkEdge, hem], p.colors.hair, false, "both");
        const underside = hem.map(
            ([x, y, z]): Point => [x * 0.966, y + 1.45, 10 + (z - 10) * 0.942]
        );
        d.s.vertexPaint = () => dye("#bb8965");
        d.s.surface([hem, underside], p.colors.hair, false, "both");
    }
    // All locks start on the same ring of one smooth dome. Sharing those
    // meridians removes hairline cracks up to the pole when the mesh reduces.
    const dome = [0, 0.25, 0.49, 0.68].map((t) =>
        domeAngles.map((a) => point(a, t, 0, 107))
    );
    fiber(
        dome,
        4,
        dye("#fff1d9"),
        domeAngles.map((a) => (a + pi) / tau)
    );
    d.s.surfaceNormal = undefined;
    for (const s of [-1, 1]) {
        d.drape("head", "upperChest", 184, 231);
        const stations = p.hair.temple ?? [
            [78, 31, 43, 28, 2],
            [118, 37, 49, 24, 4],
            [146, 36, 47, 23, 5],
            [170, 35, 44, 23, 8],
            [192, 34, 41, 24, 13],
            [212, 34, 38, 26, 18],
            [230, 35, 35.4, 24, 23.6],
        ];
        for (let half = 0; half < 2; half++) {
            const rows = stations.map(([y, inside, outside, fore, back]) =>
                series(5).map((u) => {
                    const a = (half + u) * pi;
                    // Give the temple a convex outer face across its full
                    // depth, so the skull cannot pierce a diagonal ribbon.
                    const arc = (n: number) =>
                        Math.sign(n) * Math.pow(Math.abs(n), 0.65);
                    return [
                        (s *
                            mix(inside, outside, 0.5 + 0.5 * arc(Math.cos(a))) *
                            width) /
                            48,
                        y,
                        (mix(back, fore, 0.5 + 0.5 * arc(Math.sin(a))) *
                            depth) /
                            54,
                    ] as Point;
                })
            );
            fiber(rows, 1, dye(half === 0 ? "#fff0d6" : "#e2b888"));
        }
    }
    d.s.printUV = undefined;
    d.s.vertexPaint = undefined;
}
