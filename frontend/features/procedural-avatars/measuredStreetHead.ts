import * as T from "three/webgpu";
import { Drawing, frontOfLoft, lift } from "./drawing";
import type { Point } from "./sculpt";
import { streetShade, type StreetPattern } from "./streetwearPattern";

const tau = Math.PI * 2;
const ink = "#31272a";
const ring = (count: number, at: (a: number) => Point) =>
    Array.from({ length: count + 1 }, (_, i) =>
        at((tau * (i % count)) / count)
    );

/** A vertical section through the eye carries sclera, cornea, iris and lid
 * on one convex surface. Iris and pupil terminate at the eyelid margin. */
function eye(
    d: Drawing,
    p: StreetPattern,
    side: number,
    face: ReturnType<typeof frontOfLoft>
) {
    const cx = (side * p.head.eyeGap) / 2,
        y0 = p.head.eyeLine,
        k = p.head.width / 48;
    // Coordinates progress from the tear duct to the outer canthus.
    const top = [
        [-12, 0],
        [-10, -2.3],
        [-7, -3.8],
        [-3, -4.7],
        [1, -5],
        [5, -5.1],
        [9, -4.9],
        [12, -4.5],
        [13.5, -4.1],
    ];
    const bottom = [
        [-12, 0],
        [-10, 1.6],
        [-7, 3.3],
        [-3, 4.9],
        [1, 5.3],
        [5, 4.6],
        [9, 2.9],
        [12, 0],
        [13.5, -4.1],
    ];
    const value = (path: number[][], u: number) => {
        let j = 1;
        while (j < path.length - 1 && path[j][0] < u) j++;
        const [a, v] = path[j - 1],
            [b, w] = path[j];
        return T.MathUtils.lerp(
            v,
            w,
            T.MathUtils.clamp((u - a) / (b - a), 0, 1)
        );
    };
    function point(u: number, v: number, offset: number): Point {
        const x = cx + side * k * u * 0.95,
            y = y0 + k * v * 1.17;
        const convex =
            2.65 * Math.max(0, 1 - ((u - 0.7) / 15) ** 2 - ((v + 1) / 9) ** 2);
        return [x, y, face(x, y) + 1.0 + k * convex + offset];
    }
    function strip(
        xs: number[],
        span: (u: number) => [number, number],
        offset: number,
        color: string,
        across = 1
    ) {
        const rows = xs.map((u) => {
            const [t, b] = span(u);
            return Array.from({ length: across + 1 }, (_, i) =>
                point(u, T.MathUtils.lerp(t, b, i / across), offset)
            );
        });
        d.s.surface(rows, color, false, "perimeter");
    }
    const sample = (a: number, b: number, n: number) =>
        Array.from({ length: n + 1 }, (_, i) => T.MathUtils.lerp(a, b, i / n));
    d.s.fineDetail = true;
    strip(
        sample(-12, 13.5, 13),
        (u) => [value(top, u), value(bottom, u)],
        0,
        "#fff1df",
        3
    );
    function disc(
        x: number,
        y: number,
        rx: number,
        ry: number,
        offset: number,
        color: string
    ) {
        strip(
            sample(x - rx, x + rx, rx < 2 ? 6 : rx < 4 ? 10 : 14),
            (u) => {
                const dy = ry * Math.sqrt(Math.max(0, 1 - ((u - x) / rx) ** 2));
                const lo = value(top, u),
                    hi = value(bottom, u);
                return [
                    T.MathUtils.clamp(y - dy, lo, hi),
                    T.MathUtils.clamp(y + dy, lo, hi),
                ];
            },
            offset,
            color,
            rx < 2 ? 1 : 2
        );
    }
    disc(0.5, -1.35, 7.2, 7, 0.21, "#293c4c");
    d.s.gradient = {
        top: y0 - 4.5 * k,
        bottom: y0 + 5.5 * k,
        from: streetShade(p.colors.iris, "#407999", "#27384f"),
        to: streetShade(p.colors.iris, "#407999", "#83b9d7"),
    };
    disc(0.5, -1.6, 6.15, 6.3, 0.43, p.colors.iris);
    d.s.gradient = undefined;
    disc(0.4, -2.6, 2.85, 3.65, 0.62, "#1d2938");
    disc(0.4 + side * 2.45, -2.7, 1.32, 1.0, 0.82, "#e7f0ed");
    disc(-2.6, 2.85, 0.68, 0.46, 0.7, "#87c2dc");
    const lash = [
        [-13.6, 1.3],
        [-12, -0.2],
        [-10, -2.5],
        [-7, -5.2],
        [-3, -6.45],
        [1, -6.85],
        [5, -7.02],
        [9, -6.98],
        [12, -6.78],
        [15, -6.3],
        [17.3, -5.6],
    ];
    strip(
        lash.map((v) => v[0]),
        (u) => {
            const upper = value(lash, u);
            const underside =
                u < -12
                    ? value(lash, u) + 0.25
                    : u <= 13.5
                    ? value(top, u) + 0.94
                    : T.MathUtils.lerp(-3.9, -5.6, (u - 13.5) / 3.8);
            return [upper, underside];
        },
        0.99,
        ink
    );
    strip(
        sample(-6.5, 10, 11),
        (u) => {
            const y = value(bottom, u);
            return [y - 0.2, y + 0.32];
        },
        0.32,
        "#8a6658"
    );
    const brow = [
        [-10, -9.8],
        [-6, -11.9],
        [-1, -13.4],
        [5, -14.0],
        [10, -13.8],
        [13, -13.3],
    ];
    strip(
        brow.map((v) => v[0]),
        (u) => {
            const y = value(brow, u);
            return [y, y + 0.38 + 1.28 * Math.sin((Math.PI * (u + 10)) / 23)];
        },
        0.3,
        streetShade(p.colors.hair, "#fdedd3", "#977655")
    );
    d.s.fineDetail = false;
}

function hair(d: Drawing, p: StreetPattern) {
    const strand = (color: string) =>
        streetShade(p.colors.hair, "#fdedd3", color);
    d.s.sculptedCartoon = false;
    d.s.sourcePaint = true;
    d.s.thinSkinOutline = false;
    d.s.ambientByPaint[p.colors.hair] = 0.95;
    const { width, depth } = p.head,
        { spikes, fringe, nape } = p.hair;
    // The rear fall continues behind the shoulders, with a curved front wall
    // and an uneven hem. Each side lock tapers independently at the tip.
    d.drape("head", "upperChest", 193, nape);
    d.s.gradient = {
        top: 70,
        bottom: nape,
        from: p.colors.hair,
        to: strand("#e8c79b"),
    };
    const rear = ([y, half, front, back]: number[]) =>
        ring(20, (a) => [
            Math.sin(a) * half,
            y + Math.max(0, (y - nape + 60) / 60) * 9 * Math.cos(3 * a),
            (front + back) / 2 +
                ((front - back) / 2) * Math.cos(a) +
                2 * Math.cos(5 * a),
        ]);
    const curtain = [
        [84, 34, 0, -39],
        [117, 53, 25, -55],
        [168, 51, 24, -60],
        [215, 53, -8, -65],
        [263, 54, -43, -68],
        [nape - 73, 55, -47, -80],
        [nape - 28, 54, -48, -78],
        [nape - 6, 43, -49, -65],
        [nape, 18, -53, -60],
    ];
    d.s.tone = (x, y, z) =>
        0.95 +
        0.075 * Math.cos(x * 0.12 + z * 0.042 + y * 0.006) -
        0.13 * Math.exp(-(((y - 163) / 35) ** 2 + ((z - 5) / 23) ** 2));
    d.s.surface(curtain.map(rear), p.colors.hair);
    d.s.tone = undefined;
    d.s.gradient = undefined;
    d.bind("head");
    for (const [ax, ay, az, bx, by, bz, r] of spikes) {
        const a = new T.Vector3(ax, ay, az),
            b = new T.Vector3(bx, by, bz),
            v = b.clone().sub(a).normalize();
        const cross = new T.Vector3(-v.y, v.x, 0).normalize();
        d.s.gradient = {
            top: Math.min(ay, by),
            bottom: Math.max(ay, by) + 1,
            from: strand("#fff3d8"),
            to: strand("#edce9f"),
        };
        const shape = [
            [0, 0.9],
            [0.22, 1],
            [0.68, 0.47],
            [1, 0],
        ].map(([t, s]) =>
            ring(8, (angle) => {
                const center = a.clone().lerp(b, t);
                center.z += 0.65 * r * s * Math.sin(angle);
                return center
                    .addScaledVector(cross, r * s * Math.cos(angle))
                    .toArray() as Point;
            })
        );
        d.s.surface(shape, p.colors.hair, false);
        d.s.gradient = undefined;
        for (const direction of [-1, 1]) {
            const edge = shape.map((row) => row[direction > 0 ? 0 : 4]);
            d.s.sweep(
                edge.map(([x, y, z]): Point => [x, y, z + 1]),
                edge.map((_, i) => (i === edge.length - 1 ? 0.42 : 0.97)),
                strand("#574938"),
                5
            );
        }
    }
    d.s.gradient = undefined;
    const cy = 107,
        ry = 57,
        rx = width * 1.105;
    // Add a meridian at each tip and cleft so simplification cannot turn the
    // asymmetrical cut bangs into a zigzag pasted onto a smooth hemisphere.
    const knots = fringe.map(([x, y]) => {
        const end = Math.acos(T.MathUtils.clamp((cy - y) / ry, -0.994, 0.994));
        return Math.asin(
            T.MathUtils.clamp(x / (rx * Math.sin(end)), -0.999, 0.999)
        );
    });
    const angles = [
        ...knots,
        ...Array.from({ length: 34 }, (_, i) => -Math.PI + (tau * i) / 34),
    ].sort((a, b) => a - b);
    angles.push(angles[0] + tau);
    const fringeAt = (angle: number) => {
        let i = 1;
        while (i < knots.length - 1 && knots[i] < angle) i++;
        return T.MathUtils.lerp(
            fringe[i - 1][1],
            fringe[i][1],
            T.MathUtils.clamp(
                (angle - knots[i - 1]) /
                    Math.max(0.001, knots[i] - knots[i - 1]),
                0,
                1
            )
        );
    };
    const cap = Array.from({ length: 9 }, (_, i) =>
        angles.map((a) => {
            const front = Math.cos(a),
                sx = Math.sin(a);
            const y =
                front >= 0 ? fringeAt(Math.atan2(sx, front)) : 135 - 28 * front;
            const end = Math.acos(
                T.MathUtils.clamp((cy - y) / ry, -0.994, 0.994)
            );
            const t = i / 8,
                lat = 0.004 + (end - 0.004) * t;
            return [
                rx * Math.sin(lat) * sx,
                cy - ry * Math.cos(lat),
                10 + (depth + 14) * Math.sin(lat) * front,
            ] as Point;
        })
    );
    d.s.gradient = {
        top: 54,
        bottom: 138,
        from: strand("#fff3d9"),
        to: strand("#efd2a7"),
    };
    d.s.surface(cap, p.colors.hair, false, "end", 0.56);
    d.s.gradient = undefined;
    for (const sign of [-1, 1]) {
        const meridian = angles.reduce(
            (best, a, i) =>
                Math.abs(a - (sign * Math.PI) / 2) <
                Math.abs(angles[best] - (sign * Math.PI) / 2)
                    ? i
                    : best,
            0
        );
        const contour = cap.map((row) => row[meridian]);
        d.s.sweep(
            contour,
            contour.map(() => 0.8),
            strand("#7b674e"),
            5
        );
    }
    // Use the same meridians for the fringe and its turned-under edge.
    // This keeps the ink attached to each hair tip from either profile.
    const hem = cap.at(-1).filter((_, i) => Math.cos(angles[i]) > 0);
    const inside = hem.map(([x, y, z]): Point => [x * 0.987, y - 0.6, z - 3.5]);
    d.s.surface([hem, inside], strand("#ac875e"), false, "both");
    const fringeInk = hem.map(([x, y, z], i) => {
        const prev = hem[Math.max(0, i - 1)],
            next = hem[Math.min(hem.length - 1, i + 1)];
        const dx = next[0] - prev[0],
            dy = next[1] - prev[1],
            length = Math.hypot(dx, dy) || 1;
        const halfWidth = 0.56 + 0.16 * T.MathUtils.smoothstep(y, 111, 127);
        return [-1, 1].map((sign) => {
            const px = x + ((sign * dy) / length) * halfWidth,
                py = y - ((sign * dx) / length) * halfWidth;
            const surface =
                10 +
                (depth + 14) *
                    Math.sqrt(
                        Math.max(0, 1 - (px / rx) ** 2 - ((cy - py) / ry) ** 2)
                    );
            return [px, py, Math.max(surface, z) + 0.64] as Point;
        });
    });
    d.s.surface(fringeInk, strand("#654936"), false, "perimeter");
    for (const s of [-1, 1]) {
        // A broad lock beside the ear and a narrow pointed lock in front of it.
        for (const [dx, length, z] of [
            [0, 221, 17],
            [-5, 225, 35],
        ]) {
            d.drape("head", "upperChest", 178, length + 11);
            const rows = [
                [98, 43, 7],
                [123, 46, 7.3],
                [155, 47, 5],
                [191, 45, 3.8],
                [length, 39, 0],
            ].map(([y, c, r]) =>
                ring(8, (a) => [
                    s * (c + dx) + r * Math.sin(a),
                    y,
                    z + 0.14 * (y - 99) + r * 0.62 * Math.cos(a),
                ])
            );
            d.s.surface(rows, p.colors.hair);
            const rim = rows.map((row) => row[s < 0 ? 6 : 2]);
            d.s.sweep(
                rim,
                rim.map((_, i) => (i === rim.length - 1 ? 0.35 : 0.68)),
                strand("#7f6850"),
                5
            );
        }
    }
}

export function measuredStreetHead(d: Drawing, p: StreetPattern) {
    d.bind("head");
    const { width, depth, chin } = p.head;
    // Front width and side depth are independent. The nose belongs to the
    // midline of the skull, while the cheeks and sockets turn back beside it.
    const levels = [
        [51, 1, 10, 7, 0],
        [55, 15, 31, -12, 0],
        [66, 32, 45, -27, 0],
        [84, 43, 54, -40, 0],
        [104, 46.5, 58, -46, 0],
        [119, 46.6, 59, -46, 0],
        [126, 45.8, 58, -45, 0.6],
        [132, 45.1, 57.5, -44, 2.4],
        [138, 44.3, 56.5, -42, 5],
        [144, 43.2, 56, -39, 10],
        [147.4, 42.1, 55.8, -36, 12.2],
        [149.5, 41.5, 55.7, -34, 13.4],
        [152.4, 40.8, 56.1, -32, 12.5],
        [155.2, 39.5, 56.4, -29.7, 8.2],
        [158, 37.7, 57.3, -27, 3.4],
        [162.5, 35, 59, -23, 2.3],
        [166.8, 32.5, 60.7, -20, 1.6],
        [169.4, 30, 59.6, -17, 1.2],
        [173.5, 25, 58.4, -13, 0.4],
        [178.5, 16, 55.7, -7.5, 0],
        [182, 8.5, 51, 3, 0],
        [184, 0.5, 45, 43, 0],
    ];
    const samples = d.s.detail === "full" ? 36 : 26;
    const angles = [
        ...Array.from(
            { length: samples },
            (_, i) => (2 * Math.PI * i) / samples
        ),
        ...[-0.115, -0.058, 0.058, 0.115].map((a) => (a + tau) % tau),
    ].sort((a, b) => a - b);
    angles.push(angles[0]);
    const rings = levels.map(([row, w, fore, back, nose]) =>
        angles.map((a) => {
            const c = Math.cos(a),
                u = Math.sin(a),
                y = chin - ((184 - row) * (chin - 51)) / 133;
            const x = w * Math.sign(u) * Math.abs(u) ** 0.93;
            const facial =
                (fore + back) / 2 +
                ((fore - back) / 2) * Math.sign(c) * Math.abs(c) ** 0.76;
            const bridge =
                nose *
                Math.exp(-((x / (row > 146 && row < 155 ? 6.6 : 5.3)) ** 2));
            const socket =
                -2.1 *
                Math.exp(
                    -(((Math.abs(x) - 24) / 12) ** 2 + ((row - 132) / 7) ** 2)
                );
            const cheek =
                1.7 *
                Math.exp(
                    -(((Math.abs(x) - 28) / 10) ** 2 + ((row - 148) / 11) ** 2)
                );
            return [
                (x * width) / 48,
                y,
                ((facial + Math.max(0, c) * (bridge + socket + cheek)) *
                    depth) /
                    54,
            ] as Point;
        })
    );
    d.s.thinSkinOutline = false;
    d.s.sculptedCartoon = false;
    d.s.sourcePaint = true;
    d.s.skinShadows = [];
    d.s.ambientByPaint[p.colors.skin] = 0.94;
    d.s.cheeks = [-1, 1].map((s) => ({
        x: s * 29,
        y: 149,
        rx: 22,
        ry: 12,
        strength: 0.49,
    }));
    d.s.gradient = {
        top: 99,
        bottom: chin,
        from: p.colors.skin,
        to: streetShade(p.colors.skin, "#fdd8b6", "#f6cca7"),
    };
    d.s.thinSkinOutline = true;
    d.s.tone = (x, y, z) =>
        1.055 -
        0.045 * Math.min(1, Math.abs(x / 40) ** 2) -
        0.16 *
            Math.exp(-(((y - p.head.eyeLine + 4) / 5.8) ** 2)) *
            T.MathUtils.smoothstep(z, 16, 53) -
        0.1 * Math.exp(-(((y - chin + 0.7) / 6) ** 2));
    const normals = new Map<string, Point>();
    const key = (point: Point) => point.map(Math.fround).join(",");
    const v = (point: Point) => new T.Vector3(...point);
    for (let j = 0; j < rings.length; j++)
        for (let i = 0; i < angles.length - 1; i++) {
            const n = angles.length - 1;
            const around = v(rings[j][(i + 1) % n]).sub(
                v(rings[j][(i + n - 1) % n])
            );
            const down = v(rings[Math.min(j + 1, rings.length - 1)][i]).sub(
                v(rings[Math.max(j - 1, 0)][i])
            );
            normals.set(
                key(rings[j][i]),
                around.cross(down).normalize().toArray() as Point
            );
        }
    d.s.surfaceNormal = (x, y, z) => normals.get(key([x, y, z])) ?? [0, 0, 1];
    d.s.surface(rings, p.colors.skin, false, "end", 0.4);
    d.s.surfaceNormal = undefined;
    d.s.thinSkinOutline = false;
    d.s.tone = undefined;
    d.s.gradient = undefined;
    d.s.cheeks = [];
    const face = frontOfLoft(rings);
    for (const s of [-1, 1]) {
        // The helix is highest above the concha and gradually flattens into
        // the lobe. Place the open fold on this surface in both profiles.
        const shell = (u: number, v: number, offset = 0): Point => {
            const r = Math.hypot(u, v),
                z = 9 + 9.2 * u * (1 - 0.22 * v) + 2.6 * v;
            const rim =
                4.1 *
                Math.exp(-(((r - 0.77) / 0.25) ** 2)) *
                (1 - 0.62 * T.MathUtils.smoothstep(v, 0, 0.95));
            return [
                s * (width + 5.9 + rim - 0.23 * (z - 9) - v + offset),
                136 + v * 15,
                z,
            ];
        };
        const rings = [0, 0.37, 0.62, 0.79, 1].map((r) =>
            ring(14, (a) => shell(r * Math.cos(a), r * Math.sin(a)))
        );
        rings.push(rings.at(-1).map(([x, y, z]): Point => [x - 6.3 * s, y, z]));
        d.s.gradient = {
            top: 124,
            bottom: 150,
            from: streetShade(p.colors.skin, "#fdd8b6", "#f5cdaa"),
            to: p.colors.skin,
        };
        d.s.tone = (_x, y, z) =>
            1.018 -
            0.3 *
                Math.exp(-(((z - 7.4) / 4.4) ** 2 + ((y - 135.7) / 5.6) ** 2)) -
            0.11 * Math.exp(-(((z - 5) / 3.5) ** 2 + ((y - 128) / 3.7) ** 2));
        d.s.surface(rings, p.colors.skin, false, "perimeter");
        d.s.tone = undefined;
        d.s.gradient = undefined;
        const fold = [
            [-0.16, 0.52],
            [-0.47, 0.25],
            [-0.55, -0.1],
            [-0.41, -0.46],
            [-0.12, -0.6],
            [0.14, -0.51],
            [0.31, -0.27],
        ].map(([u, v]) => shell(u, v, 0.65));
        d.s.sweep(
            fold,
            [0.25, 0.58, 0.82, 0.87, 0.85, 0.63, 0.3],
            streetShade(p.colors.skin, "#fdd8b6", "#91684c"),
            5,
            undefined,
            true
        );
        const tragus = [
            [0.28, -0.13],
            [0.17, 0.04],
            [0.21, 0.16],
            [0.36, 0.22],
        ].map(([u, v]) => shell(u, v, 0.8));
        d.s.sweep(
            tragus,
            [0.32, 0.73, 0.64, 0.24],
            streetShade(p.colors.skin, "#fdd8b6", "#be8e6f"),
            5,
            undefined,
            true
        );
        eye(d, p, s, face);
    }
    d.s.fineDetail = true;
    for (const sign of [-1, 1])
        d.stroke(
            [
                [sign * 1.1, 154.6],
                [sign * 1.75, 154.75],
                [sign * 2.55, 154.3],
            ],
            lift(face, 0.42),
            0.38,
            streetShade(p.colors.skin, "#fdd8b6", "#bc9072")
        );
    d.stroke(
        [
            [-5.5, 168.4],
            [-3, 167.75],
            [0, 167.85],
            [2.1, 167.65],
            [5.8, 168.18],
        ],
        lift(face, 0.64),
        0.66,
        "#594139"
    );
    d.stroke(
        [
            [-2, 170.2],
            [0.3, 170.65],
            [2.9, 170.2],
        ],
        lift(face, 0.39),
        0.47,
        streetShade(p.colors.skin, "#fdd8b6", "#e5b39a")
    );
    d.s.fineDetail = false;
    const depthAtMouth = face(4, 168.5);
    hair(d, p);
    return () => {
        d.bind("head");
        const depth = depthAtMouth;
        d.s.sweep(
            [
                [4, 168.5, depth + 1],
                [15, 176, depth + 6],
                [27, 186, depth + 19],
            ],
            [1.15, 1.1, 0.85],
            "#624e3b",
            6
        );
    };
}
