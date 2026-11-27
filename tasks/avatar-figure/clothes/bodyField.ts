/**
 * The figure's body as a distance field, for cutting clothes to it.
 *
 * Signed distance to the skin (body and head together), negative inside,
 * kept on a grid near the surface and read between grid points. A blurred
 * copy stands for how cloth lies over the body: it bridges the hollows
 * (armpits, the small of the back, between the legs) and drops the
 * muscles, the way a garment does.
 */
import type { Shape } from "../../../frontend/features/procedural-avatar/kernel/sdf";

export interface Surface {
    positions: Float32Array;
    normals: Float32Array;
    indices: Uint32Array;
}

export interface BodyField {
    /** The skin itself. */
    skin: Shape;
    /** The skin as cloth lies over it: blurred over `blur` metres. */
    draped(blur: number): Shape;
    cell: number;
    band: number;
}

export function bodyField(
    surface: Surface,
    options: { cell?: number; band?: number } = {}
): BodyField {
    const cell = options.cell ?? 0.007;
    const band = options.band ?? 0.07;
    const { positions, normals, indices } = surface;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3)
        for (let k = 0; k < 3; k++) {
            min[k] = Math.min(min[k], positions[i + k]);
            max[k] = Math.max(max[k], positions[i + k]);
        }
    const pad = band + 2 * cell;
    const o = min.map((v) => v - pad);
    const n = max.map((v, k) => Math.ceil((v + pad - o[k]) / cell) + 1);
    const [nx, ny, nz] = n;
    const total = nx * ny * nz;
    const at = (i: number, j: number, k: number) => i + nx * (j + ny * k);
    const dist = new Float32Array(total).fill(Infinity);
    const sign = new Int8Array(total);

    // Closest point on each triangle to the grid points near it.
    const p = [0, 0, 0];
    const tri = new Float64Array(9);
    const nrm = new Float64Array(9);
    for (let t = 0; t < indices.length; t += 3) {
        for (let c = 0; c < 3; c++)
            for (let k = 0; k < 3; k++) {
                tri[c * 3 + k] = positions[indices[t + c] * 3 + k];
                nrm[c * 3 + k] = normals[indices[t + c] * 3 + k];
            }
        const lo = [0, 1, 2].map((k) =>
            Math.max(
                0,
                Math.floor(
                    (Math.min(tri[k], tri[3 + k], tri[6 + k]) - band - o[k]) /
                        cell
                )
            )
        );
        const hi = [0, 1, 2].map((k) =>
            Math.min(
                n[k] - 1,
                Math.ceil(
                    (Math.max(tri[k], tri[3 + k], tri[6 + k]) + band - o[k]) /
                        cell
                )
            )
        );
        for (let k = lo[2]; k <= hi[2]; k++)
            for (let j = lo[1]; j <= hi[1]; j++)
                for (let i = lo[0]; i <= hi[0]; i++) {
                    p[0] = o[0] + i * cell;
                    p[1] = o[1] + j * cell;
                    p[2] = o[2] + k * cell;
                    const [d, u, v, w] = closest(tri, p);
                    const g = at(i, j, k);
                    if (d >= dist[g] || d > band) continue;
                    dist[g] = d;
                    // Which side, by the skin's own normal at that point.
                    let s = 0;
                    for (let a = 0; a < 3; a++) {
                        const cp = u * tri[a] + v * tri[3 + a] + w * tri[6 + a];
                        const cn = u * nrm[a] + v * nrm[3 + a] + w * nrm[6 + a];
                        s += (p[a] - cp) * cn;
                    }
                    sign[g] = s < 0 ? -1 : 1;
                }
    }

    // Beyond the band: outside if it can be reached from the grid's edge
    // without crossing the band, inside otherwise.
    const reached = new Uint8Array(total);
    const queue = new Int32Array(total);
    let head = 0;
    let tail = 0;
    const push = (g: number) => {
        if (reached[g] || dist[g] !== Infinity) return;
        reached[g] = 1;
        queue[tail++] = g;
    };
    for (let k = 0; k < nz; k++)
        for (let j = 0; j < ny; j++)
            for (let i = 0; i < nx; i++)
                if (
                    !i ||
                    !j ||
                    !k ||
                    i === nx - 1 ||
                    j === ny - 1 ||
                    k === nz - 1
                )
                    push(at(i, j, k));
    while (head < tail) {
        const g = queue[head++];
        const i = g % nx;
        const j = Math.floor(g / nx) % ny;
        const k = Math.floor(g / (nx * ny));
        if (i > 0) push(g - 1);
        if (i < nx - 1) push(g + 1);
        if (j > 0) push(g - nx);
        if (j < ny - 1) push(g + nx);
        if (k > 0) push(g - nx * ny);
        if (k < nz - 1) push(g + nx * ny);
    }
    const values = new Float32Array(total);
    for (let g = 0; g < total; g++)
        values[g] =
            dist[g] !== Infinity
                ? dist[g] * sign[g]
                : reached[g]
                ? band
                : -band;

    const read = (grid: Float32Array): Shape => ({
        eval(x, y, z) {
            const fx = (x - o[0]) / cell;
            const fy = (y - o[1]) / cell;
            const fz = (z - o[2]) / cell;
            if (
                fx < 0 ||
                fy < 0 ||
                fz < 0 ||
                fx >= nx - 1 ||
                fy >= ny - 1 ||
                fz >= nz - 1
            )
                return band;
            const i = Math.floor(fx);
            const j = Math.floor(fy);
            const k = Math.floor(fz);
            const tx = fx - i;
            const ty = fy - j;
            const tz = fz - k;
            const g = at(i, j, k);
            const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
            const sx = 1;
            const sy = nx;
            const sz = nx * ny;
            return lerp(
                lerp(
                    lerp(grid[g], grid[g + sx], tx),
                    lerp(grid[g + sy], grid[g + sy + sx], tx),
                    ty
                ),
                lerp(
                    lerp(grid[g + sz], grid[g + sz + sx], tx),
                    lerp(grid[g + sz + sy], grid[g + sz + sy + sx], tx),
                    ty
                ),
                tz
            );
        },
    });

    const blurred = new Map<number, Shape>();
    return {
        skin: read(values),
        cell,
        band,
        draped(radius) {
            const key = Math.round(radius * 1e4);
            if (!blurred.has(key))
                blurred.set(key, read(blur(values, n, radius / cell)));
            return blurred.get(key);
        },
    };
}

/** A gaussian blur along each axis in turn, `sigma` in grid steps. */
function blur(values: Float32Array, n: number[], sigma: number) {
    const reach = Math.ceil(sigma * 2.5);
    const weights = Array.from({ length: reach * 2 + 1 }, (_, i) =>
        Math.exp(-((i - reach) ** 2) / (2 * sigma * sigma))
    );
    const sum = weights.reduce((a, b) => a + b, 0);
    const w = weights.map((v) => v / sum);
    let from = values;
    const [nx, ny, nz] = n;
    const strides = [1, nx, nx * ny];
    for (let axis = 0; axis < 3; axis++) {
        const to = new Float32Array(from.length);
        const stride = strides[axis];
        const size = n[axis];
        for (let g = 0; g < from.length; g++) {
            const c =
                axis === 0
                    ? g % nx
                    : axis === 1
                    ? Math.floor(g / nx) % ny
                    : Math.floor(g / (nx * ny));
            let acc = 0;
            for (let d = -reach; d <= reach; d++) {
                const q = Math.min(size - 1, Math.max(0, c + d));
                acc += w[d + reach] * from[g + (q - c) * stride];
            }
            to[g] = acc;
        }
        from = to;
        void nz;
    }
    return from;
}

/**
 * Distance from p to the triangle (a, b, c in `t`) and the barycentric
 * weights of the closest point. After Ericson, Real-Time Collision
 * Detection, 5.1.5.
 */
function closest(
    t: Float64Array,
    p: number[]
): [number, number, number, number] {
    const ax = t[0],
        ay = t[1],
        az = t[2];
    const abx = t[3] - ax,
        aby = t[4] - ay,
        abz = t[5] - az;
    const acx = t[6] - ax,
        acy = t[7] - ay,
        acz = t[8] - az;
    const apx = p[0] - ax,
        apy = p[1] - ay,
        apz = p[2] - az;
    const d1 = abx * apx + aby * apy + abz * apz;
    const d2 = acx * apx + acy * apy + acz * apz;
    let u: number, v: number, w: number;
    if (d1 <= 0 && d2 <= 0) {
        [u, v, w] = [1, 0, 0];
    } else {
        const bpx = p[0] - t[3],
            bpy = p[1] - t[4],
            bpz = p[2] - t[5];
        const d3 = abx * bpx + aby * bpy + abz * bpz;
        const d4 = acx * bpx + acy * bpy + acz * bpz;
        const cpx = p[0] - t[6],
            cpy = p[1] - t[7],
            cpz = p[2] - t[8];
        const d5 = abx * cpx + aby * cpy + abz * cpz;
        const d6 = acx * cpx + acy * cpy + acz * cpz;
        const vc = d1 * d4 - d3 * d2;
        const vb = d5 * d2 - d1 * d6;
        const va = d3 * d6 - d5 * d4;
        if (d3 >= 0 && d4 <= d3) [u, v, w] = [0, 1, 0];
        else if (d6 >= 0 && d5 <= d6) [u, v, w] = [0, 0, 1];
        else if (vc <= 0 && d1 >= 0 && d3 <= 0) {
            const s = d1 / (d1 - d3);
            [u, v, w] = [1 - s, s, 0];
        } else if (vb <= 0 && d2 >= 0 && d6 <= 0) {
            const s = d2 / (d2 - d6);
            [u, v, w] = [1 - s, 0, s];
        } else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
            const s = (d4 - d3) / (d4 - d3 + (d5 - d6));
            [u, v, w] = [0, 1 - s, s];
        } else {
            const denom = 1 / (va + vb + vc);
            v = vb * denom;
            w = vc * denom;
            u = 1 - v - w;
        }
    }
    const qx = u * ax + v * t[3] + w * t[6] - p[0];
    const qy = u * ay + v * t[4] + w * t[7] - p[1];
    const qz = u * az + v * t[5] + w * t[8] - p[2];
    return [Math.hypot(qx, qy, qz), u, v, w];
}
