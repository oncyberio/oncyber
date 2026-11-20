import * as T from "three/webgpu";
import { Drawing, ellipse, frontOfLoft, lift, type XY } from "./drawing";
import type { Point } from "./sculpt";
import { streetShade, type StreetPattern } from "./streetwearPattern";

const tau = Math.PI * 2;
const ink = "#31272a";
const ring = (count: number, at: (a: number) => Point) =>
    Array.from({ length: count + 1 }, (_, i) =>
        at((tau * (i % count)) / count)
    );

/** An almond eye is seated against the same triangles that form the cheek.
 * The upper lash overlaps the iris and tapers past the outer corner. */
function eye(
    d: Drawing,
    p: StreetPattern,
    side: number,
    face: ReturnType<typeof frontOfLoft>
) {
    const x = (side * p.head.eyeGap) / 2,
        y = p.head.eyeLine,
        w = p.head.width * 0.285;
    const coords = (a: number, b: number): XY => [x + side * a * w, y + b * w];
    const edge: XY[] = [
        [-1, 0],
        [-0.72, -0.37],
        [-0.15, -0.51],
        [0.53, -0.55],
        [1, -0.31],
        [0.69, 0.28],
        [0.2, 0.52],
        [-0.36, 0.48],
        [-0.8, 0.23],
    ];
    const almond = edge.map(([u, v]) => coords(u, v));
    const white = d.patch(almond, [x, y], lift(face, 0.7), 1.7, "#fff2dd", {
        sharp: true,
    });
    const irisX = x - side * 0.65;
    d.decal(ellipse(irisX, y - 0.25, 6.0, 6.25), lift(white, 0.46), "#294556");
    d.decal(
        ellipse(irisX, y + 0.22, 5.0, 5.35),
        lift(white, 0.7),
        p.colors.iris
    );
    d.decal(ellipse(irisX, y - 1.0, 2.75, 3.25), lift(white, 0.91), "#202632");
    d.decal(
        ellipse(irisX - 1.6, y - 2.5, 1.4, 1.35),
        lift(white, 1.15),
        "#fffaf0"
    );
    d.decal(
        [
            [-1.06, 0.13],
            [-0.77, -0.43],
            [-0.12, -0.64],
            [0.63, -0.67],
            [1.39, -0.78],
            [1.04, -0.23],
            [0.75, 0.07],
            [0.8, -0.25],
            [0.29, -0.32],
            [-0.28, -0.33],
            [-0.7, -0.18],
        ].map(([u, v]) => coords(u, v)),
        lift(white, 1.55),
        ink
    );
    d.stroke(
        [
            [0.88, 0.06],
            [0.47, 0.45],
            [0.02, 0.54],
            [-0.33, 0.47],
        ].map(([u, v]) => coords(u, v)),
        lift(white, 0.95),
        0.56,
        ink
    );
    d.stroke(
        [coords(-0.8, -0.84), coords(0.06, -1.04), coords(0.82, -1.01)],
        lift(face, 0.55),
        0.85,
        streetShade(p.colors.skin, "#fdd8b6", "#a88568")
    );
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
        [117, 49, 4, -55],
        [168, 47, -8, -60],
        [215, 53, -30, -65],
        [263, 54, -43, -68],
        [nape - 73, 55, -47, -80],
        [nape - 28, 54, -48, -78],
        [nape - 6, 43, -49, -65],
        [nape, 18, -53, -60],
    ];
    d.s.surface(curtain.map(rear), p.colors.hair);
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
        rx = width * 1.04;
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
    const cap = Array.from({ length: 8 }, (_, i) =>
        angles.map((a) => {
            const front = Math.cos(a),
                sx = Math.sin(a);
            const y =
                front >= 0
                    ? fringeAt(Math.atan2(sx, front))
                    : 135 + 28 * -front;
            const end = Math.acos(
                T.MathUtils.clamp((cy - y) / ry, -0.994, 0.994)
            );
            const lat = 0.004 + ((end - 0.004) * i) / 7;
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
    const lip = cap.at(-1);
    const wisps = lip
        .filter((_, i) => Math.cos(angles[i]) > 0.05)
        .map(([x, y, z]): Point => [x, y + 0.25, z + 0.9]);
    d.s.ribbon(wisps, 1.05, strand("#65513d"));
    for (let i = 2; i < lip.length - 1; i++) {
        if (
            Math.cos(angles[i]) < 0.25 ||
            lip[i][1] <= Math.max(lip[i - 1][1], lip[i + 1][1]) + 1
        )
            continue;
        const tip = lip[i],
            root = cap[5][i];
        d.s.ribbon(
            [
                [root[0] + 2, root[1], root[2] + 0.6],
                [
                    (root[0] + tip[0]) / 2 + 1,
                    (root[1] + tip[1]) / 2,
                    (root[2] + tip[2]) / 2 + 1.6,
                ],
                [tip[0], tip[1], tip[2] + 1],
            ],
            0.53,
            strand("#d1b28b")
        );
    }
    d.s.gradient = undefined;
    for (const s of [-1, 1]) {
        // A broad lock beside the ear and a narrow pointed lock in front of it.
        for (const [dx, length, z] of [
            [0, 225, 17],
            [-7, 234, 40],
        ]) {
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
    const levels = [
        [53, 3, 18, 0],
        [56, 18, 29, -11],
        [66, 33, 45, -28],
        [84, 43, 54, -42],
        [104, 47, 60, -47],
        [120, 48, 60, -48],
        [132, 45.5, 60, -46],
        [143, 43, 61, -41],
        [151, 39, 65, -34],
        [158, 35, 61, -27],
        [167, 29, 60, -20],
        [176, 18, 55, -12],
        [182, 9, 51, 4],
        [184, 2, 45, 25],
    ];
    const rings = levels.map(([row, w, front, back]) =>
        ring(28, (a) => {
            const c = Math.cos(a),
                s = Math.sin(a),
                y = chin - ((184 - row) * (chin - 53)) / 131;
            return [
                ((w * width) / 48) * Math.sign(s) * Math.pow(Math.abs(s), 0.89),
                y,
                (((front + back) / 2 +
                    ((front - back) / 2) *
                        Math.sign(c) *
                        Math.pow(Math.abs(c), 0.83)) *
                    depth) /
                    54,
            ] as Point;
        })
    );
    d.s.ambientByPaint[p.colors.skin] = 0.94;
    d.s.cheeks = [-1, 1].map((s) => ({
        x: s * 29,
        y: 149,
        rx: 22,
        ry: 12,
        strength: 0.31,
    }));
    d.s.gradient = {
        top: 99,
        bottom: chin,
        from: p.colors.skin,
        to: streetShade(p.colors.skin, "#fdd8b6", "#f6cca7"),
    };
    d.s.surface(rings, p.colors.skin);
    d.s.gradient = undefined;
    d.s.cheeks = [];
    const face = frontOfLoft(rings);
    for (const s of [-1, 1]) {
        const ex = s * (width + 1);
        d.s.oval([ex, 136, 7], [8.3, 13.5, 6.5], p.colors.skin);
        d.stroke(
            [
                [ex - s, 143],
                [ex + s * 3.8, 136],
                [ex + s * 2.4, 130],
                [ex - s * 2.5, 132],
            ],
            () => 13,
            0.85,
            streetShade(p.colors.skin, "#fdd8b6", "#b78368")
        );
        eye(d, p, s, face);
    }
    const nose = d.patch(
        [
            [-5, 139],
            [-2, 143],
            [3.8, 149],
            [4, 153],
            [0, 157],
            [-4.2, 153],
        ],
        [0.1, 151],
        lift(face, 0.2),
        6.1,
        p.colors.skin,
        { sharp: true }
    );
    d.stroke(
        [
            [-2.3, 154],
            [-0.7, 155.2],
            [1.1, 154.9],
        ],
        lift(nose, 0.65),
        0.63,
        streetShade(p.colors.skin, "#fdd8b6", "#bc876a")
    );
    d.stroke(
        [
            [-5.6, 168],
            [-0.9, 167.6],
            [3.3, 167.9],
            [6, 168.2],
        ],
        lift(face, 0.7),
        0.87,
        ink
    );
    d.s.sweep(
        [
            [4, 168.5, face(4, 168.5) + 1],
            [15, 176, face(4, 168.5) + 6],
            [27, 186, face(4, 168.5) + 19],
        ],
        [1.15, 1.1, 0.85],
        "#624e3b",
        6
    );
    hair(d, p);
}
