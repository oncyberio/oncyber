import * as T from "three/webgpu";
import { drawStreetGroom } from "./streetGroom";
import { streetPaintUV } from "./streetBrush";
import { drawFittedStreetFace } from "./fittedStreetFace";
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
        ring(16, (a) => [
            Math.sin(a) * half,
            y + Math.max(0, (y - nape + 60) / 60) * 9 * Math.cos(3 * a),
            (front + back) / 2 +
                ((front - back) / 2) * Math.cos(a) +
                2 * Math.cos(5 * a),
        ]);
    const curtain = [
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
        // The ink occupies a narrow sector of the lock itself. Keep its color
        // discontinuous at the common edge so a dark tip cannot stain a light face.
        const rim = 0.38,
            pi = Math.PI;
        const sectors = [
            [-rim, 0, rim],
            [rim, pi / 2, pi - rim],
            [pi - rim, pi, pi + rim],
            [pi + rim, 1.5 * pi, tau - rim],
        ];
        for (const [i, angles] of sectors.entries()) {
            const rows = [
                [0, 0.9],
                [0.22, 1],
                [1, 0],
            ].map(([t, size]) =>
                angles.map((angle) => {
                    const center = a.clone().lerp(b, t);
                    center.z += 0.65 * r * size * Math.sin(angle);
                    return center
                        .addScaledVector(cross, r * size * Math.cos(angle))
                        .toArray() as Point;
                })
            );
            if (i % 2 === 1)
                d.s.gradient = {
                    top: Math.min(ay, by),
                    bottom: Math.max(ay, by) + 1,
                    from: strand("#fff3d8"),
                    to: strand("#edce9f"),
                };
            d.s.surface(
                rows,
                i % 2 === 0 ? strand("#51402f") : p.colors.hair,
                false,
                "perimeter"
            );
            d.s.gradient = undefined;
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
    const measured = p.faceFit?.crown;
    const angles = measured
        ? measured.map((row) => row[0])
        : [
              ...knots,
              ...Array.from(
                  { length: 34 },
                  (_, i) => -Math.PI + (tau * i) / 34
              ),
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
    const ringCount = measured ? 8 : 9;
    const dyes = new Map<string, number>();
    const key = (v: Point) => v.map(Math.fround).join(",");
    const cap = Array.from({ length: ringCount }, (_, i) =>
        angles.map((a, j) => {
            const front = Math.cos(a),
                sx = Math.sin(a);
            const y = measured
                ? measured[j % measured.length][1]
                : front >= 0
                ? fringeAt(Math.atan2(sx, front))
                : 135 - 28 * front;
            const end = Math.acos(
                T.MathUtils.clamp((cy - y) / ry, -0.994, 0.994)
            );
            const lat = measured
                ? [
                      0,
                      0.45,
                      0.85,
                      1.13,
                      1.34,
                      T.MathUtils.lerp(1.34, end, 0.5),
                      T.MathUtils.lerp(1.34, end, 0.9),
                      end,
                  ][i]
                : 0.004 + ((end - 0.004) * i) / 8;
            const v: Point = [
                rx * Math.sin(lat) * sx,
                cy - ry * Math.cos(lat),
                10 + (depth + 14) * Math.sin(lat) * front,
            ];
            if (measured) {
                const paint = measured[j % measured.length][i + 2];
                const dyed =
                    p.colors.hair === "#fdedd3"
                        ? paint
                        : parseInt(
                              strand(
                                  "#" + paint.toString(16).padStart(6, "0")
                              ).slice(1),
                              16
                          );
                dyes.set(key(v), dyed);
            }
            return v;
        })
    );
    d.s.gradient = {
        top: 54,
        bottom: 138,
        from: strand("#fff3d9"),
        to: strand("#efd2a7"),
    };
    if (measured)
        d.s.vertexPaint = (x, y, z) =>
            dyes.get(key([x, y, z])) ?? parseInt(p.colors.hair.slice(1), 16);
    d.s.surfaceNormal = (x, y, z) =>
        new T.Vector3(
            x / (rx * rx),
            (y - cy) / (ry * ry),
            (z - 10) / (depth + 14) ** 2
        )
            .normalize()
            .toArray() as Point;
    if (measured) {
        // Only the lower rings need a meridian per fringe corner. Spin sparse,
        // even upper rings and stitch to the increasing angular resolution.
        const n = angles.length - 1;
        const rows = cap.map((_, i) => {
            if (i === 0) return [0, n];
            if (i >= 5) return angles.map((_, j) => j);
            const result = new Set([0, n]),
                spokes = [0, 10, 14, 17, 25][i];
            for (let j = 1; j < spokes; j++) {
                const a = angles[0] + (tau * j) / spokes;
                const k = angles.reduce(
                    (best, x, k) =>
                        Math.abs(x - a) < Math.abs(angles[best] - a) ? k : best,
                    0
                );
                result.add(k);
            }
            return [...result].sort((a, b) => a - b);
        });
        const faces: Point[] = [];
        for (let r = 1; r < rows.length; r++) {
            const above = rows[r - 1],
                below = rows[r];
            let a = 0,
                b = 0;
            while (a < above.length - 1 || b < below.length - 1) {
                const ba = below[b],
                    aa = above[a];
                if (
                    a < above.length - 1 &&
                    (b === below.length - 1 || above[a + 1] < below[b + 1])
                ) {
                    if (r > 1)
                        faces.push(
                            cap[r - 1][aa],
                            cap[r - 1][above[a + 1]],
                            cap[r][ba]
                        );
                    a++;
                } else {
                    faces.push(
                        cap[r - 1][aa],
                        cap[r][below[b + 1]],
                        cap[r][ba]
                    );
                    b++;
                }
            }
        }
        const hem = new Set(cap.at(-1).map(key));
        d.s.preserveVertex = (x, y, z) => hem.has(key([x, y, z]));
        d.s.triangles(faces, p.colors.hair);
        d.s.preserveVertex = undefined;
    } else d.s.surface(cap, p.colors.hair, false, "end", 0.56);
    d.s.surfaceNormal = undefined;
    d.s.vertexPaint = undefined;
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
            4
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
    d.s.surface(fringeInk, strand("#4e3928"), false, "perimeter");
    for (const s of [-1, 1]) {
        d.drape("head", "upperChest", 183, 232);
        const stations = [
            [88, 40, 50, 29, -4],
            [112, 37, 50, 34, -1],
            [128, 36.8, 49, 34, 2.6],
            [149, 35.3, 46.7, 30, 5.3],
            [170, 35, 44.2, 24, 8],
            [191, 34.6, 41.6, 22.5, 11.8],
            [211, 34.4, 38.2, 22.6, 16.6],
            [229, 34.8, 34.9, 23, 22.8],
        ];
        const rows = stations.map(([y, inside, outside, fore, back]) =>
            ring(10, (a) => {
                const t = (1 - Math.cos(a)) / 2;
                return [
                    (s *
                        (T.MathUtils.lerp(inside, outside, t) +
                            2 * Math.sin(a)) *
                        width) /
                        48,
                    y,
                    ((T.MathUtils.lerp(fore, back, t) + 3.8 * Math.sin(a)) *
                        depth) /
                        54,
                ] as Point;
            })
        );
        d.s.gradient = {
            top: 94,
            bottom: 228,
            from: strand("#fef1d9"),
            to: strand("#edc998"),
        };
        d.s.tone = (x, y, z) =>
            0.98 + 0.075 * Math.cos(Math.abs(x) * 0.38 + z * 0.18 + y * 0.006);
        d.s.surface(rows, p.colors.hair, false, "perimeter");
        d.s.tone = undefined;
        d.s.gradient = undefined;
        for (const i of [0, 5]) {
            const rim = rows.map((row, k) => {
                const c = new T.Vector3(...row[i]),
                    t = k === rows.length - 1 ? 0.23 : i === 0 ? 1.12 : 0.88;
                return [-1, 0, 1].map((j) => {
                    const direction = new T.Vector3(...row[(i + j + 10) % 10])
                        .sub(c)
                        .normalize();
                    const point = c.clone().addScaledVector(direction, t);
                    point.x += s * (i === 0 ? -0.45 : 0.45);
                    point.z += i === 0 ? 0.6 : -0.6;
                    return point.toArray() as Point;
                });
            });
            d.s.surface(rim, strand("#695039"), false, "perimeter");
        }
    }
}

function ears(d: Drawing, p: StreetPattern) {
    const { width } = p.head;
    const brushed = p.faceFit?.finish === "brush";
    for (const s of [-1, 1]) {
        // The helix is highest above the concha and gradually flattens into
        // the lobe. Place the open fold on this surface in both profiles.
        const shell = (u: number, v: number, offset = 0): Point => {
            const r = Math.hypot(u, v),
                z = -6 + 10.6 * u * (1 - 0.22 * v) + 2.6 * v;
            const rim =
                (brushed ? 2.1 : 4.1) *
                Math.exp(-(((r - 0.77) / 0.25) ** 2)) *
                (1 - 0.62 * T.MathUtils.smoothstep(v, 0, 0.95));
            return [
                s *
                    (width +
                        (brushed ? 4.5 : 5.9) +
                        rim -
                        (brushed ? 0.68 : 0.46) * (z + 6) -
                        v +
                        offset),
                137 + v * 16.7,
                z,
            ];
        };
        const rings = [0, 0.37, 0.62, 0.79, 1].map((r) =>
            ring(14, (a) => shell(r * Math.cos(a), r * Math.sin(a)))
        );
        rings.push(
            rings
                .at(-1)
                .map(
                    ([x, y, z]): Point => [x - (brushed ? 1.8 : 6.3) * s, y, z]
                )
        );
        d.s.gradient = {
            top: 124,
            bottom: 150,
            from: streetShade(p.colors.skin, "#fdd8b6", "#f5cdaa"),
            to: p.colors.skin,
        };
        d.s.tone = (_x, y, z) =>
            1.018 -
            0.5 *
                Math.exp(-(((z + 7.6) / 4.4) ** 2 + ((y - 135.7) / 5.6) ** 2)) -
            0.11 * Math.exp(-(((z + 10) / 3.5) ** 2 + ((y - 128) / 3.7) ** 2));
        if (p.faceFit?.finish === "brush") {
            d.s.sourcePaint = false;
            d.s.sculptedCartoon = false;
            d.s.thinSkinOutline = false;
            d.s.tone = undefined;
            d.s.gradient = undefined;
            d.s.vertexPaint = () => parseInt(p.colors.skin.slice(1), 16);
            d.s.printUV = (_x, y, _, z) => {
                const v = (y - 137) / 16.7,
                    u = (z + 6 - 2.6 * v) / (10.6 * (1 - 0.22 * v));
                return streetPaintUV("ear", u, v);
            };
        } else if (p.faceFit) {
            const colors = new Map<string, number>();
            rings.slice(0, -1).forEach((row, i) =>
                row.forEach((point, j) => {
                    const raw = p.faceFit.ear[i][j % 14];
                    const dye =
                        p.colors.skin === "#fdd8b6"
                            ? raw
                            : parseInt(
                                  streetShade(
                                      p.colors.skin,
                                      "#fdd8b6",
                                      "#" + raw.toString(16).padStart(6, "0")
                                  ).slice(1),
                                  16
                              );
                    colors.set(point.map(Math.fround).join(","), dye);
                })
            );
            d.s.vertexPaint = (x, y, z) =>
                colors.get([x, y, z].join(",")) ??
                parseInt(p.colors.skin.slice(1), 16);
        }
        d.s.surface(rings, p.colors.skin, false, "perimeter");
        d.s.printUV = undefined;
        d.s.vertexPaint = undefined;
        d.s.tone = undefined;
        d.s.gradient = undefined;
        const rim = [0.94, 1.011].map((r) =>
            ring(14, (a) => shell(r * Math.cos(a), r * Math.sin(a), 0.42))
        );
        rim.push(rim[1].map(([x, y, z]): Point => [x - 1.15 * s, y, z]));
        d.s.surface(
            rim,
            streetShade(p.colors.skin, "#fdd8b6", "#513725"),
            false,
            "perimeter"
        );
        if (brushed) continue;
        // The folds follow the relief of the pinna. They only need a narrow
        // ribbon on that surface, including when the ear turns into profile.
        const crease = (path: number[][], color: string) => {
            const rows = path.map(([u, v, r], i) => {
                const a = path[Math.max(0, i - 1)],
                    b = path[Math.min(path.length - 1, i + 1)];
                const dz = (b[0] - a[0]) * 10.6,
                    dy = (b[1] - a[1]) * 16.7;
                const length = Math.hypot(dz, dy) || 1;
                return [-r, r].map((w) =>
                    shell(
                        u + (w * dy) / (length * 10.6),
                        v - (w * dz) / (length * 16.7),
                        0.86
                    )
                );
            });
            d.s.surface(
                rows,
                streetShade(p.colors.skin, "#fdd8b6", color),
                false,
                "perimeter"
            );
        };
        crease(
            [
                [-0.16, 0.52, 0.28],
                [-0.47, 0.25, 0.76],
                [-0.55, -0.1, 1.03],
                [-0.41, -0.46, 0.98],
                [-0.12, -0.6, 0.94],
                [0.14, -0.51, 0.75],
                [0.31, -0.27, 0.35],
            ],
            "#714b32"
        );
        crease(
            [
                [0.28, -0.13, 0.36],
                [0.17, 0.04, 0.77],
                [0.21, 0.16, 0.74],
                [0.36, 0.22, 0.31],
            ],
            "#be8e6f"
        );
    }
}

export function measuredStreetHead(d: Drawing, p: StreetPattern) {
    d.bind("head");
    if (p.faceFit) {
        drawFittedStreetFace(d, p);
        ears(d, p);
        if (p.faceFit.finish === "brush") drawStreetGroom(d, p);
        else hair(d, p);
        return;
    }
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
    ears(d, p);
    for (const s of [-1, 1]) {
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
    hair(d, p);
}
