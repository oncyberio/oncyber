import type { MeshBuilder, Rgb } from "./build";
import { Basis, IDENTITY, Vec3 } from "./sdf";

const turn = (m: Basis, v: Vec3): [number, number, number] => [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];

/**
 * A box with slightly bevelled edges, so it catches light like a made
 * object rather than a maths one. `colour` may vary per face normal.
 */
export function box(
    out: MeshBuilder,
    centre: Vec3,
    half: Vec3,
    colour: Rgb | ((normal: Vec3) => Rgb),
    basis: Basis = IDENTITY,
    bevel = 0.0012
) {
    const b = Math.min(bevel, half[0] * 0.45, half[1] * 0.45, half[2] * 0.45);
    const axes: Vec3[] = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
    ];
    for (let axis = 0; axis < 3; axis++)
        for (const sign of [1, -1]) {
            const u = (axis + 1) % 3;
            const v = (axis + 2) % 3;
            const normal: [number, number, number] = [0, 0, 0];
            normal[axis] = sign;
            const worldNormal = turn(basis, normal);
            const c = typeof colour === "function" ? colour(normal) : colour;
            const base = out.count;
            // Face corners inset by the bevel; the bevel itself is a ring of
            // quads to the neighbouring faces' insets, shaded by normal blend.
            const corners: [number, number][] = [
                [-1, -1],
                [1, -1],
                [1, 1],
                [-1, 1],
            ];
            for (const [cu, cv] of corners) {
                const local: [number, number, number] = [0, 0, 0];
                local[axis] = sign * half[axis];
                local[u] = cu * (half[u] - b);
                local[v] = cv * (half[v] - b);
                const p = turn(basis, local);
                out.vertex(
                    [centre[0] + p[0], centre[1] + p[1], centre[2] + p[2]],
                    worldNormal,
                    c
                );
            }
            // Outer ring at the true edge, with normals leaning outwards.
            for (const [cu, cv] of corners) {
                const local: [number, number, number] = [0, 0, 0];
                local[axis] = sign * (half[axis] - b);
                local[u] = cu * half[u];
                local[v] = cv * half[v];
                const lean: [number, number, number] = [0, 0, 0];
                lean[axis] = sign;
                lean[u] = cu * 0.7;
                lean[v] = cv * 0.7;
                const l = Math.hypot(lean[0], lean[1], lean[2]);
                const p = turn(basis, local);
                const n = turn(basis, [lean[0] / l, lean[1] / l, lean[2] / l]);
                out.vertex(
                    [centre[0] + p[0], centre[1] + p[1], centre[2] + p[2]],
                    n,
                    [c[0] * 0.92, c[1] * 0.92, c[2] * 0.92]
                );
            }
            const flip = sign < 0;
            const quad = (a: number, b2: number, c2: number, d: number) =>
                flip ? out.quad(a, d, c2, b2) : out.quad(a, b2, c2, d);
            quad(base, base + 1, base + 2, base + 3);
            for (let k = 0; k < 4; k++) {
                const n = (k + 1) % 4;
                quad(base + 4 + k, base + 4 + n, base + n, base + k);
            }
        }
}

/** A capped cylinder between two points, optionally tapered. */
export function cylinder(
    out: MeshBuilder,
    from: Vec3,
    to: Vec3,
    radius: number,
    colour: Rgb,
    options: { endRadius?: number; segments?: number } = {}
) {
    const segments = options.segments ?? 14;
    const r1 = options.endRadius ?? radius;
    out.tube(
        [from, to],
        segments,
        (t) => radius + (r1 - radius) * t,
        () => colour,
        { caps: true }
    );
}
