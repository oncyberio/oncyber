import * as T from "three/webgpu";
import type { Drawing } from "./drawing";
import type { Point } from "./sculpt";
import { inkPart } from "./streetInk";
import { margin, upperLid, streetHairTile } from "./streetBrush";
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
    d.s.markInkPart(inkPart.crown);
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
            series(3).map((u) => {
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
    d.s.markInkPart(inkPart.spikes);
    for (const [ax, ay, az, bx, by, bz, r] of p.hair.spikes) {
        const a = new T.Vector3(ax, ay, az).lerp(
                new T.Vector3(0, 98, -10),
                0.15
            ),
            b = new T.Vector3(bx, by, bz),
            v = b.clone().sub(a).normalize();
        const wide = new T.Vector3(-v.y, v.x, 0).normalize(),
            round = v.clone().cross(wide).normalize();
        const spoke = (t: number, size: number, angle: number): Point => {
            const center = a.clone().lerp(b, t);
            center.y += 2.4 * Math.sin(pi * t);
            return center
                .addScaledVector(wide, r * size * Math.cos(angle))
                .addScaledVector(round, 0.62 * r * size * Math.sin(angle))
                .toArray() as Point;
        };
        // The broad base lives under the crown. A slight concavity in
        // the taper makes the sides read as drawn tufts through a turn.
        const shape = [
            [0, 0.87],
            [0.21, 1],
            [0.52, 0.62],
            [0.79, 0.24],
            [1, 0],
        ];
        for (let half = 0; half < 2; half++) {
            const rows = shape.map(([t, size]) =>
                series(4).map((u) => spoke(t, size, (half + u) * pi))
            );
            fiber(rows, 3, dye("#f7dcb1"));
        }
    }
    d.s.markInkPart(inkPart.crown);
    // The front drawing determines each central cleft. Around the temple the
    // side drawing determines where the lock frees itself from the forehead.
    const fringe = p.hair.fringe
        .filter(([x]) => Math.abs(x) <= 36)
        .map(([x, y]) => {
            const lid = margin(
                upperLid,
                T.MathUtils.clamp(
                    Math.abs(x),
                    upperLid[0][0],
                    upperLid.at(-1)[0]
                )
            );
            return [Math.asin(x / 53.28), Math.min(y, lid - 3.2)];
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
        (v, i) => i === 0 || v[0] - observed[i - 1][0] > 0.003
    );
    // Split the negative spaces first. A short notch inside a broad clump
    // stays with the clump. The two long temple locks are separate below.
    const boundaries = [0];
    for (let i = 1; i < edge.length - 1; i++) {
        const [a, y] = edge[i];
        if (
            y < edge[i - 1][1] &&
            y < edge[i + 1][1] &&
            a - edge[boundaries.at(-1)][0] > 0.064 &&
            (y <= 116 || Math.abs(a) > 1.3)
        )
            boundaries.push(i);
    }
    boundaries.push(edge.length - 1);
    const surface = (a: number, y: number, lift: number): Point => {
        const v = T.MathUtils.clamp((107 - y) / 57.3, -1, 1);
        // Leave clearance over the fitted rear skull and the buried spike roots.
        const r = Math.sqrt(1 - v * v) * (1 + 0.046 * (1 - smooth(y, 72, 96)));
        const tuck = 8.5 * smooth(y, 86, 122) * Math.max(0, Math.cos(a));
        return [
            (rx + 0.85 + lift) * r * Math.sin(a),
            y,
            10 + (rz - tuck + lift) * r * Math.cos(a),
        ];
    };
    const crownNormal = (x: number, y: number, z: number): Point => {
        const n = new T.Vector3(
            x / (rx * rx),
            (y - 107) / (ry * ry),
            (z - 10) / (rz * rz)
        );
        return n.normalize().toArray() as Point;
    };
    d.s.surfaceNormal = crownNormal;
    const domeAngles: number[] = [];
    for (let k = 1; k < boundaries.length; k++) {
        const contour = edge.slice(boundaries[k - 1], boundaries[k] + 1);
        const [left, ly] = contour[0],
            [right, ryEnd] = contour.at(-1);
        const [tip, ty] = contour.reduce((a, b) => (a[1] > b[1] ? a : b));
        const lock =
            Math.abs(tip) < 1.5 &&
            tip > left &&
            tip < right &&
            ty > Math.max(ly, ryEnd) + 3;
        const us = series(Math.max(2, Math.ceil((right - left) * 6)));
        const angles = us.map((u) => mix(left, right, u));
        domeAngles.push(...(k === 1 ? angles : angles.slice(1)));
        const shoulder = (u: number) => mix(ly, ryEnd, u);
        // An ascending curved ridge starts in the crown. The exposed tongue
        // below the fork converges on its own tip, swept across the forehead.
        const cross = (u: number) => Math.sin(pi * u) ** 1.4;
        const roots = [0, 0.5, 1].map((t) =>
            us.map((u) => {
                const a = mix(left, right, u);
                const y = mix(86, shoulder(u), t);
                return surface(
                    a - 0.052 * Math.sin(pi * t) * Math.cos(a),
                    y,
                    (lock ? 2.2 : 0.65) * t * cross(u)
                );
            })
        );
        if (!lock) {
            fiber(roots, 0, dye("#fff0d6"), us);
            continue;
        }
        const tongue = (t: number) =>
            us.map((u) => {
                const a = mix(left, right, u);
                const h = shoulder(u);
                const bend = Math.sin(pi * t);
                // A drawn lock holds its width through the middle and narrows
                // quickly near the tip. Keep the inside edge close to straight.
                const mid =
                    mix(a, tip, t ** mix(1.05, 1.72, u)) -
                    0.14 * (right - left) * bend;
                return surface(
                    mid,
                    mix(h, ty, t),
                    cross(u) * 2.2 * (1 - t) + bend * 1.35
                );
            });
        const edgeRows = [roots[2], tongue(0.44), tongue(0.78), tongue(1)];
        fiber(roots, 0, dye("#fff1d9"), us);
        fiber(edgeRows, 5, dye("#fff0d6"), us);
        d.s.printUV = undefined;
        const outline = [
            ...edgeRows.map((row) => row[0]),
            ...edgeRows
                .slice(0, -1)
                .reverse()
                .map((row) => row.at(-1)),
        ];
        const inside = outline.map(
            ([x, y, z]): Point => [x * 0.97, y - 0.65, 10 + (z - 10) * 0.958]
        );
        d.s.vertexPaint = () => dye("#916343");
        d.s.surface([outline, inside], p.colors.hair, false, "both");
    }
    // Each lock shares its whole root edge with the same smooth cranial cap.
    const dome = [49.7, 52.5, 60, 72, 86].map((y) =>
        domeAngles.map((a) => surface(a, y, 0))
    );

    fiber(
        dome,
        4,
        dye("#fff1d9"),
        domeAngles.map((a) => (a + pi) / tau)
    );
    d.s.markInkPart(inkPart.locks);
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
                    // Sweep the hanging lock behind the cheekbone before
                    // returning to its measured tip beside the collar.
                    const sweep =
                        8.5 * smooth(y, 125, 166) * (1 - smooth(y, 166, 230));
                    // Give the temple a convex outer face across its full
                    // depth, so the skull cannot pierce a diagonal ribbon.
                    const arc = (n: number) =>
                        Math.sign(n) * Math.pow(Math.abs(n), 0.65);
                    return [
                        (s *
                            mix(inside, outside, 0.5 + 0.5 * arc(Math.cos(a))) *
                            mix(0.85, 1, smooth(y, 78, 117)) *
                            width) /
                            48,
                        y,
                        ((mix(back, fore, 0.5 + 0.5 * arc(Math.sin(a))) -
                            sweep) *
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
