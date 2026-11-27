import { Shape, Vec3, gradient } from "./sdf";

export interface RawMesh {
    positions: Float32Array;
    normals: Float32Array;
    indices: Uint32Array;
}

export interface MeshOptions {
    min: Vec3;
    max: Vec3;
    /** Edge length of one cell, in metres. */
    cell: number;
    /** Return false to leave a hole where another part takes over. */
    keep?: (x: number, y: number, z: number) => boolean;
}

const LEAF = 4;

/**
 * Surface nets over a sparse grid.
 *
 * The box is split octree-style; each block prunes the field for itself and
 * is dropped when the surface cannot cross it, so only cells near the
 * surface are ever evaluated. One vertex is placed per crossed cell, slid
 * onto the true surface, and given the field gradient as its normal, which
 * keeps shading smooth at a modest triangle count.
 */
export function meshField(source: Shape, options: MeshOptions): RawMesh {
    const { cell, keep } = options;
    const [x0, y0, z0] = options.min;
    const nx = Math.max(1, Math.ceil((options.max[0] - x0) / cell));
    const ny = Math.max(1, Math.ceil((options.max[1] - y0) / cell));
    const nz = Math.max(1, Math.ceil((options.max[2] - z0) / cell));
    const sx = nx + 1;
    const sy = ny + 1;
    const sxy = sx * sy;
    const values = new Float32Array(sxy * (nz + 1)).fill(NaN);
    const cellVertex = new Int32Array(nx * ny * nz).fill(-1);
    const cellBlock = new Int32Array(nx * ny * nz).fill(-1);
    const blocks: Shape[] = [];
    const active: number[] = [];

    const visit = (
        i0: number,
        j0: number,
        k0: number,
        i1: number,
        j1: number,
        k1: number,
        parent: Shape,
        depth: number
    ) => {
        const hx = ((i1 - i0) * cell) / 2;
        const hy = ((j1 - j0) * cell) / 2;
        const hz = ((k1 - k0) * cell) / 2;
        const cx = x0 + i0 * cell + hx;
        const cy = y0 + j0 * cell + hy;
        const cz = z0 + k0 * cell + hz;
        const radius = Math.hypot(hx, hy, hz);
        let local = parent;
        const di = i1 - i0;
        const dj = j1 - j0;
        const dk = k1 - k0;
        const leaf = di <= LEAF && dj <= LEAF && dk <= LEAF;
        // Pruning costs an allocation and a full evaluation, so do it on
        // alternate levels and at the leaves; in between, one evaluation
        // of the already-pruned field is enough to drop empty blocks.
        if (parent.prune && (leaf || depth % 2 === 0)) {
            const pruned = parent.prune(cx, cy, cz, radius) as Shape & {
                lo?: number;
                hi?: number;
            };
            if (pruned.lo > 0 || pruned.hi < 0) return;
            local = pruned;
        } else {
            const d = parent.eval(cx, cy, cz);
            if (Math.abs(d) > radius * 1.5 + 0.002) return;
        }
        if (leaf) {
            const block = blocks.length;
            blocks.push(local);
            for (let k = k0; k <= k1; k++)
                for (let j = j0; j <= j1; j++)
                    for (let i = i0; i <= i1; i++) {
                        const at = i + j * sx + k * sxy;
                        if (values[at] !== values[at])
                            values[at] = local.eval(
                                x0 + i * cell,
                                y0 + j * cell,
                                z0 + k * cell
                            );
                    }
            for (let k = k0; k < k1; k++)
                for (let j = j0; j < j1; j++)
                    for (let i = i0; i < i1; i++) {
                        const c = i + j * nx + k * nx * ny;
                        cellBlock[c] = block;
                        active.push(c);
                    }
            return;
        }
        const im = di > LEAF ? i0 + (di >> 1) : i1;
        const jm = dj > LEAF ? j0 + (dj >> 1) : j1;
        const km = dk > LEAF ? k0 + (dk >> 1) : k1;
        const is =
            im === i1
                ? [[i0, i1]]
                : [
                      [i0, im],
                      [im, i1],
                  ];
        const js =
            jm === j1
                ? [[j0, j1]]
                : [
                      [j0, jm],
                      [jm, j1],
                  ];
        const ks =
            km === k1
                ? [[k0, k1]]
                : [
                      [k0, km],
                      [km, k1],
                  ];
        for (const [ka, kb] of ks)
            for (const [ja, jb] of js)
                for (const [ia, ib] of is)
                    visit(ia, ja, ka, ib, jb, kb, local, depth + 1);
    };
    visit(0, 0, 0, nx, ny, nz, source, 0);

    const positions: number[] = [];
    const normals: number[] = [];
    const corner = new Float64Array(8);
    const g: [number, number, number] = [0, 0, 0];
    const eps = cell * 0.3;
    // Corner order: bit 0 = +x, bit 1 = +y, bit 2 = +z.
    const edges = [
        [0, 1],
        [2, 3],
        [4, 5],
        [6, 7],
        [0, 2],
        [1, 3],
        [4, 6],
        [5, 7],
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 7],
    ];
    for (const c of active) {
        const i = c % nx;
        const j = Math.floor(c / nx) % ny;
        const k = Math.floor(c / (nx * ny));
        const base = i + j * sx + k * sxy;
        let mask = 0;
        for (let n = 0; n < 8; n++) {
            const v =
                values[
                    base + (n & 1) + ((n >> 1) & 1) * sx + ((n >> 2) & 1) * sxy
                ];
            corner[n] = v;
            if (v < 0) mask |= 1 << n;
        }
        if (mask === 0 || mask === 255) continue;
        let px = 0;
        let py = 0;
        let pz = 0;
        let count = 0;
        for (const [a, b] of edges) {
            const va = corner[a];
            const vb = corner[b];
            if (va < 0 === vb < 0) continue;
            const t = va / (va - vb);
            px += (a & 1) + ((b & 1) - (a & 1)) * t;
            py += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t;
            pz += ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t;
            count++;
        }
        const minX = x0 + i * cell;
        const minY = y0 + j * cell;
        const minZ = z0 + k * cell;
        let x = minX + (px / count) * cell;
        let y = minY + (py / count) * cell;
        let z = minZ + (pz / count) * cell;
        if (keep && !keep(minX + cell / 2, minY + cell / 2, minZ + cell / 2))
            continue;
        const local = blocks[cellBlock[c]];
        // Slide onto the surface, staying inside the cell so quads never
        // fold. The cell's own corners give the slope to slide along.
        const gx =
            (corner[1] -
                corner[0] +
                corner[3] -
                corner[2] +
                corner[5] -
                corner[4] +
                corner[7] -
                corner[6]) /
            (4 * cell);
        const gy =
            (corner[2] -
                corner[0] +
                corner[3] -
                corner[1] +
                corner[6] -
                corner[4] +
                corner[7] -
                corner[5]) /
            (4 * cell);
        const gz =
            (corner[4] -
                corner[0] +
                corner[5] -
                corner[1] +
                corner[6] -
                corner[2] +
                corner[7] -
                corner[3]) /
            (4 * cell);
        const l2 = gx * gx + gy * gy + gz * gz;
        if (l2 > 1e-9)
            for (let step = 0; step < 2; step++) {
                const s = local.eval(x, y, z) / l2;
                x = Math.min(minX + cell, Math.max(minX, x - gx * s));
                y = Math.min(minY + cell, Math.max(minY, y - gy * s));
                z = Math.min(minZ + cell, Math.max(minZ, z - gz * s));
            }
        gradient(local, x, y, z, eps, g);
        const l = Math.sqrt(g[0] * g[0] + g[1] * g[1] + g[2] * g[2]) || 1;
        cellVertex[c] = positions.length / 3;
        positions.push(x, y, z);
        normals.push(g[0] / l, g[1] / l, g[2] / l);
    }

    const indices: number[] = [];
    const quad = (
        a: number,
        b: number,
        c: number,
        d: number,
        flip: boolean
    ) => {
        if (a < 0 || b < 0 || c < 0 || d < 0) return;
        // Split along the diagonal whose end normals agree best.
        const dot = (p: number, q: number) =>
            normals[p * 3] * normals[q * 3] +
            normals[p * 3 + 1] * normals[q * 3 + 1] +
            normals[p * 3 + 2] * normals[q * 3 + 2];
        if (dot(a, c) >= dot(b, d)) {
            if (flip) indices.push(a, c, b, a, d, c);
            else indices.push(a, b, c, a, c, d);
        } else if (flip) indices.push(b, a, d, b, d, c);
        else indices.push(b, c, d, b, d, a);
    };
    const vertexAt = (i: number, j: number, k: number) =>
        i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz
            ? -1
            : cellVertex[i + j * nx + k * nx * ny];
    for (const c of active) {
        if (cellVertex[c] < 0) continue;
        const i = c % nx;
        const j = Math.floor(c / nx) % ny;
        const k = Math.floor(c / (nx * ny));
        const base = i + j * sx + k * sxy;
        const v0 = values[base];
        const inside = v0 < 0;
        if (inside !== values[base + 1] < 0)
            quad(
                vertexAt(i, j - 1, k - 1),
                vertexAt(i, j, k - 1),
                vertexAt(i, j, k),
                vertexAt(i, j - 1, k),
                !inside
            );
        if (inside !== values[base + sx] < 0)
            quad(
                vertexAt(i - 1, j, k - 1),
                vertexAt(i - 1, j, k),
                vertexAt(i, j, k),
                vertexAt(i, j, k - 1),
                !inside
            );
        if (inside !== values[base + sxy] < 0)
            quad(
                vertexAt(i - 1, j - 1, k),
                vertexAt(i, j - 1, k),
                vertexAt(i, j, k),
                vertexAt(i - 1, j, k),
                !inside
            );
    }

    return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        indices: new Uint32Array(indices),
    };
}
