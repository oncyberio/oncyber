/**
 * What a figure's skin knows about itself, worked out once when the file is
 * built and stored on its vertices: how open each point is to the light,
 * how sharply the surface turns there, and how much flesh lies behind it.
 * The shader lights the skin from these instead of from painted shading.
 *
 * Plain arrays in, plain arrays out, and no imports, so the builder (plain
 * Node) can load it as is.
 */

/** Vertices that share a place, such as the two sides of a seam. */
export interface Weld {
    /** For each vertex, which place it is at. */
    of: Uint32Array;
    count: number;
}

/**
 * Find the vertices that sit in the same place: within `tolerance` of the
 * first vertex found there.
 */
export function weld(positions: Float32Array, tolerance = 5e-5): Weld {
    const of = new Uint32Array(positions.length / 3);
    // Places by the cell their first vertex is in; a vertex looks in its
    // own cell and the ones round it.
    const cells = new Map<string, number[]>();
    const firsts: number[] = [];
    const cell = (x: number) => Math.floor(x / tolerance);
    for (let v = 0; v < of.length; v++) {
        const x = positions[v * 3];
        const y = positions[v * 3 + 1];
        const z = positions[v * 3 + 2];
        const cx = cell(x);
        const cy = cell(y);
        const cz = cell(z);
        let found = -1;
        for (let dx = -1; dx <= 1 && found < 0; dx++)
            for (let dy = -1; dy <= 1 && found < 0; dy++)
                for (let dz = -1; dz <= 1 && found < 0; dz++) {
                    const here = cells.get(
                        cx + dx + "," + (cy + dy) + "," + (cz + dz)
                    );
                    if (!here) continue;
                    for (const place of here) {
                        const f = firsts[place] * 3;
                        if (
                            Math.hypot(
                                positions[f] - x,
                                positions[f + 1] - y,
                                positions[f + 2] - z
                            ) <= tolerance
                        ) {
                            found = place;
                            break;
                        }
                    }
                }
        if (found < 0) {
            found = firsts.length;
            firsts.push(v);
            const key = cx + "," + cy + "," + cz;
            if (!cells.has(key)) cells.set(key, []);
            cells.get(key).push(found);
        }
        of[v] = found;
    }
    return { of, count: firsts.length };
}

/** Which places each place is joined to by an edge. */
export function neighbours(indices: Uint32Array, welded: Weld): number[][] {
    const sets: Set<number>[] = Array.from(
        { length: welded.count },
        () => new Set<number>()
    );
    for (let t = 0; t < indices.length; t += 3) {
        const a = welded.of[indices[t]];
        const b = welded.of[indices[t + 1]];
        const c = welded.of[indices[t + 2]];
        if (a !== b) sets[a].add(b), sets[b].add(a);
        if (b !== c) sets[b].add(c), sets[c].add(b);
        if (c !== a) sets[c].add(a), sets[a].add(c);
    }
    return sets.map((set) => [...set]);
}

/**
 * The edges of a surface that only one triangle uses, joined up into
 * rings of places: the rims of its openings, and its outer edge.
 */
export function boundaryLoops(indices: Uint32Array, welded: Weld): number[][] {
    const uses = new Map<number, number>();
    const key = (a: number, b: number) =>
        a < b ? a * welded.count + b : b * welded.count + a;
    const each = (visit: (a: number, b: number) => void) => {
        for (let t = 0; t < indices.length; t += 3) {
            const a = welded.of[indices[t]];
            const b = welded.of[indices[t + 1]];
            const c = welded.of[indices[t + 2]];
            if (a === b || b === c || c === a) continue;
            visit(a, b), visit(b, c), visit(c, a);
        }
    };
    each((a, b) => uses.set(key(a, b), (uses.get(key(a, b)) || 0) + 1));
    // A rim edge keeps the direction its triangle went round in.
    const next = new Map<number, number[]>();
    each((a, b) => {
        if (uses.get(key(a, b)) !== 1) return;
        if (!next.has(a)) next.set(a, []);
        next.get(a).push(b);
    });
    const loops: number[][] = [];
    for (const start of [...next.keys()]) {
        while (next.get(start)?.length) {
            const loop = [start];
            let at = next.get(start).pop();
            while (at !== start && at !== undefined) {
                loop.push(at);
                at = next.get(at)?.pop();
            }
            if (at === start && loop.length > 2) loops.push(loop);
        }
    }
    return loops;
}

/**
 * Triangles sorted into a tree of boxes, to find what a ray hits without
 * trying every triangle.
 */
export class TriangleTree {
    private readonly corners: Float32Array;
    private readonly boxes: Float32Array;
    /** Per node: first triangle and count for a leaf, or children. */
    private readonly first: Int32Array;
    private readonly count: Int32Array;
    private readonly left: Int32Array;
    private readonly right: Int32Array;
    private nodes = 0;
    private readonly stack = new Int32Array(96);

    constructor(positions: Float32Array, indices: Uint32Array) {
        const triangles = indices.length / 3;
        const order = new Uint32Array(triangles);
        const centre = new Float32Array(triangles * 3);
        for (let t = 0; t < triangles; t++) {
            order[t] = t;
            for (let axis = 0; axis < 3; axis++)
                centre[t * 3 + axis] =
                    (positions[indices[t * 3] * 3 + axis] +
                        positions[indices[t * 3 + 1] * 3 + axis] +
                        positions[indices[t * 3 + 2] * 3 + axis]) /
                    3;
        }
        const most = Math.max(1, triangles * 2);
        this.boxes = new Float32Array(most * 6);
        this.first = new Int32Array(most);
        this.count = new Int32Array(most);
        this.left = new Int32Array(most);
        this.right = new Int32Array(most);
        const build = (from: number, to: number): number => {
            const node = this.nodes++;
            const box = this.boxes.subarray(node * 6, node * 6 + 6);
            box.fill(Infinity, 0, 3);
            box.fill(-Infinity, 3, 6);
            const lo = [Infinity, Infinity, Infinity];
            const hi = [-Infinity, -Infinity, -Infinity];
            for (let i = from; i < to; i++) {
                const t = order[i];
                for (let corner = 0; corner < 3; corner++) {
                    const v = indices[t * 3 + corner] * 3;
                    for (let axis = 0; axis < 3; axis++) {
                        const x = positions[v + axis];
                        if (x < box[axis]) box[axis] = x;
                        if (x > box[3 + axis]) box[3 + axis] = x;
                    }
                }
                for (let axis = 0; axis < 3; axis++) {
                    const x = centre[t * 3 + axis];
                    if (x < lo[axis]) lo[axis] = x;
                    if (x > hi[axis]) hi[axis] = x;
                }
            }
            if (to - from <= 4) {
                this.first[node] = from;
                this.count[node] = to - from;
                return node;
            }
            let axis = 0;
            if (hi[1] - lo[1] > hi[axis] - lo[axis]) axis = 1;
            if (hi[2] - lo[2] > hi[axis] - lo[axis]) axis = 2;
            const middle = (lo[axis] + hi[axis]) / 2;
            let split = from;
            for (let i = from; i < to; i++) {
                if (centre[order[i] * 3 + axis] < middle) {
                    const swap = order[i];
                    order[i] = order[split];
                    order[split++] = swap;
                }
            }
            if (split === from || split === to) split = (from + to) >> 1;
            this.count[node] = 0;
            this.left[node] = build(from, split);
            this.right[node] = build(split, to);
            return node;
        };
        if (triangles) build(0, triangles);
        // The triangles' corners, in the tree's order.
        this.corners = new Float32Array(triangles * 9);
        for (let i = 0; i < triangles; i++)
            for (let corner = 0; corner < 3; corner++)
                for (let axis = 0; axis < 3; axis++)
                    this.corners[i * 9 + corner * 3 + axis] =
                        positions[indices[order[i] * 3 + corner] * 3 + axis];
    }

    /** How far along a ray the nearest triangle is, or `far` if none. */
    cast(
        ox: number,
        oy: number,
        oz: number,
        dx: number,
        dy: number,
        dz: number,
        far: number
    ): number {
        if (!this.nodes) return far;
        const ix = 1 / dx;
        const iy = 1 / dy;
        const iz = 1 / dz;
        const { boxes, corners, stack } = this;
        let nearest = far;
        let top = 0;
        stack[top++] = 0;
        while (top) {
            const node = stack[--top];
            const b = node * 6;
            // Where the ray is within the box along each axis. Along an
            // axis it does not move on, it only has to start inside.
            let near = 0;
            let end = nearest;
            if (dx !== 0) {
                const t0 = (boxes[b] - ox) * ix;
                const t1 = (boxes[b + 3] - ox) * ix;
                near = Math.max(near, t0 < t1 ? t0 : t1);
                end = Math.min(end, t0 < t1 ? t1 : t0);
            } else if (ox < boxes[b] || ox > boxes[b + 3]) continue;
            if (dy !== 0) {
                const t0 = (boxes[b + 1] - oy) * iy;
                const t1 = (boxes[b + 4] - oy) * iy;
                near = Math.max(near, t0 < t1 ? t0 : t1);
                end = Math.min(end, t0 < t1 ? t1 : t0);
            } else if (oy < boxes[b + 1] || oy > boxes[b + 4]) continue;
            if (dz !== 0) {
                const t0 = (boxes[b + 2] - oz) * iz;
                const t1 = (boxes[b + 5] - oz) * iz;
                near = Math.max(near, t0 < t1 ? t0 : t1);
                end = Math.min(end, t0 < t1 ? t1 : t0);
            } else if (oz < boxes[b + 2] || oz > boxes[b + 5]) continue;
            if (near > end) continue;
            const count = this.count[node];
            if (!count) {
                stack[top++] = this.left[node];
                stack[top++] = this.right[node];
                continue;
            }
            const from = this.first[node];
            for (let i = from; i < from + count; i++) {
                // Möller–Trumbore, from either side.
                const c = i * 9;
                const ax = corners[c];
                const ay = corners[c + 1];
                const az = corners[c + 2];
                const e1x = corners[c + 3] - ax;
                const e1y = corners[c + 4] - ay;
                const e1z = corners[c + 5] - az;
                const e2x = corners[c + 6] - ax;
                const e2y = corners[c + 7] - ay;
                const e2z = corners[c + 8] - az;
                const px = dy * e2z - dz * e2y;
                const py = dz * e2x - dx * e2z;
                const pz = dx * e2y - dy * e2x;
                const det = e1x * px + e1y * py + e1z * pz;
                if (det > -1e-14 && det < 1e-14) continue;
                const inv = 1 / det;
                const sx = ox - ax;
                const sy = oy - ay;
                const sz = oz - az;
                const u = (sx * px + sy * py + sz * pz) * inv;
                if (u < 0 || u > 1) continue;
                const qx = sy * e1z - sz * e1y;
                const qy = sz * e1x - sx * e1z;
                const qz = sx * e1y - sy * e1x;
                const v = (dx * qx + dy * qy + dz * qz) * inv;
                if (v < 0 || u + v > 1) continue;
                const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
                if (t > 1e-6 && t < nearest) nearest = t;
            }
        }
        return nearest;
    }
}

/** A surface to bake: vertices, their normals, and its triangles. */
export interface BakeSurface {
    positions: Float32Array;
    normals: Float32Array;
    indices: Uint32Array;
}

/** One normal for each place: the average of the vertices there. */
function weldedFrames(surface: BakeSurface, welded: Weld) {
    const at = new Float64Array(welded.count * 3);
    const normal = new Float64Array(welded.count * 3);
    const members = new Uint32Array(welded.count);
    for (let v = 0; v < welded.of.length; v++) {
        const w = welded.of[v];
        members[w]++;
        for (let axis = 0; axis < 3; axis++) {
            at[w * 3 + axis] += surface.positions[v * 3 + axis];
            normal[w * 3 + axis] += surface.normals[v * 3 + axis];
        }
    }
    for (let w = 0; w < welded.count; w++) {
        const length =
            Math.hypot(normal[w * 3], normal[w * 3 + 1], normal[w * 3 + 2]) ||
            1;
        for (let axis = 0; axis < 3; axis++) {
            at[w * 3 + axis] /= members[w] || 1;
            normal[w * 3 + axis] /= length;
        }
    }
    return { at, normal };
}

/** Two unit vectors square to a normal and to each other. */
function frame(nx: number, ny: number, nz: number) {
    // Duff et al., "Building an Orthonormal Basis, Revisited".
    const sign = nz >= 0 ? 1 : -1;
    const a = -1 / (sign + nz);
    const b = nx * ny * a;
    return [
        1 + sign * nx * nx * a,
        sign * b,
        -sign * nx,
        b,
        sign + ny * ny * a,
        -ny,
    ];
}

/**
 * Directions over a hemisphere, more of them near its pole (so that their
 * plain average is what a matte surface would receive): [x, y, up] each.
 */
export function hemisphere(samples: number): Float64Array {
    const out = new Float64Array(samples * 3);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < samples; i++) {
        const up = Math.sqrt(1 - (i + 0.5) / samples);
        const flat = Math.sqrt(1 - up * up);
        out[i * 3] = Math.cos(i * golden) * flat;
        out[i * 3 + 1] = Math.sin(i * golden) * flat;
        out[i * 3 + 2] = up;
    }
    return out;
}

export interface OpennessOptions {
    /** Rays from each place. */
    samples?: number;
    /** How far away something can be and still shade a place, metres. */
    reach?: number;
    /** Height of a floor that shades what stands on it, if any. */
    floor?: number;
}

/**
 * How open each place is to the light: 1 with nothing near, 0 buried.
 * What blocks a ray counts for less the further off it is.
 */
export function bakeOpenness(
    surface: BakeSurface,
    welded: Weld,
    tree: TriangleTree,
    options: OpennessOptions = {}
): Float32Array {
    const samples = options.samples ?? 96;
    const reach = options.reach ?? 0.12;
    const directions = hemisphere(samples);
    const { at, normal } = weldedFrames(surface, welded);
    const out = new Float32Array(welded.count);
    for (let w = 0; w < welded.count; w++) {
        const nx = normal[w * 3];
        const ny = normal[w * 3 + 1];
        const nz = normal[w * 3 + 2];
        const [tx, ty, tz, bx, by, bz] = frame(nx, ny, nz);
        // Turn the pattern by a different amount at each place.
        const turn = ((w * 0.61803398875) % 1) * Math.PI * 2;
        const cos = Math.cos(turn);
        const sin = Math.sin(turn);
        const ox = at[w * 3] + nx * 4e-4;
        const oy = at[w * 3 + 1] + ny * 4e-4;
        const oz = at[w * 3 + 2] + nz * 4e-4;
        let blocked = 0;
        for (let i = 0; i < samples; i++) {
            const lx = directions[i * 3] * cos - directions[i * 3 + 1] * sin;
            const ly = directions[i * 3] * sin + directions[i * 3 + 1] * cos;
            const up = directions[i * 3 + 2];
            const dx = tx * lx + bx * ly + nx * up;
            const dy = ty * lx + by * ly + ny * up;
            const dz = tz * lx + bz * ly + nz * up;
            let hit = tree.cast(ox, oy, oz, dx, dy, dz, reach);
            if (options.floor !== undefined && dy < -1e-6)
                hit = Math.min(hit, Math.max(0, (options.floor - oy) / dy));
            if (hit < reach) {
                const near = 1 - hit / reach;
                blocked += near * near;
            }
        }
        out[w] = 1 - blocked / samples;
    }
    return out;
}

/**
 * How much of the light from one side reaches each place: 1 where nothing
 * stands between it and that light, 0 in something's shadow. Whether the
 * place faces the light is left out, the shader knows that already.
 * Something far off blocks less than something near, as a soft shadow
 * would.
 */
export function bakeSkylight(
    surface: BakeSurface,
    welded: Weld,
    tree: TriangleTree,
    towards: [number, number, number],
    options: { samples?: number; reach?: number; spread?: number } = {}
): Float32Array {
    const samples = options.samples ?? 128;
    const reach = options.reach ?? 0.4;
    // Rays within this of the light's direction (cosine of the angle).
    const spread = options.spread ?? 0.5;
    const directions = hemisphere(samples);
    const { at, normal } = weldedFrames(surface, welded);
    const length = Math.hypot(towards[0], towards[1], towards[2]) || 1;
    const lx = towards[0] / length;
    const ly = towards[1] / length;
    const lz = towards[2] / length;
    const [tx, ty, tz, bx, by, bz] = frame(lx, ly, lz);
    const out = new Float32Array(welded.count);
    for (let w = 0; w < welded.count; w++) {
        const nx = normal[w * 3];
        const ny = normal[w * 3 + 1];
        const nz = normal[w * 3 + 2];
        const ox = at[w * 3] + nx * 4e-4;
        const oy = at[w * 3 + 1] + ny * 4e-4;
        const oz = at[w * 3 + 2] + nz * 4e-4;
        let facing = 0;
        let lit = 0;
        for (let i = 0; i < samples; i++) {
            const up = directions[i * 3 + 2];
            if (up < spread) continue;
            const dx =
                tx * directions[i * 3] + bx * directions[i * 3 + 1] + lx * up;
            const dy =
                ty * directions[i * 3] + by * directions[i * 3 + 1] + ly * up;
            const dz =
                tz * directions[i * 3] + bz * directions[i * 3 + 1] + lz * up;
            const weight = dx * nx + dy * ny + dz * nz;
            if (weight <= 0.02) continue;
            facing += weight;
            const hit = tree.cast(ox, oy, oz, dx, dy, dz, reach);
            const t = Math.min(1, Math.max(0, (hit / reach - 0.3) / 0.7));
            lit += weight * t * t * (3 - 2 * t);
        }
        out[w] = facing > 1e-6 ? lit / facing : 1;
    }
    return out;
}

/**
 * How much flesh lies behind each place, metres, up to `reach`: the
 * average distance to the far side, looking inwards.
 */
export function bakeDepth(
    surface: BakeSurface,
    welded: Weld,
    tree: TriangleTree,
    options: { samples?: number; reach?: number } = {}
): Float32Array {
    const samples = options.samples ?? 32;
    const reach = options.reach ?? 0.05;
    const directions = hemisphere(samples);
    const { at, normal } = weldedFrames(surface, welded);
    const out = new Float32Array(welded.count);
    for (let w = 0; w < welded.count; w++) {
        const nx = -normal[w * 3];
        const ny = -normal[w * 3 + 1];
        const nz = -normal[w * 3 + 2];
        const [tx, ty, tz, bx, by, bz] = frame(nx, ny, nz);
        const ox = at[w * 3] + nx * 4e-4;
        const oy = at[w * 3 + 1] + ny * 4e-4;
        const oz = at[w * 3 + 2] + nz * 4e-4;
        let total = 0;
        for (let i = 0; i < samples; i++) {
            const lx = directions[i * 3];
            const ly = directions[i * 3 + 1];
            const up = directions[i * 3 + 2];
            total += tree.cast(
                ox,
                oy,
                oz,
                tx * lx + bx * ly + nx * up,
                ty * lx + by * ly + ny * up,
                tz * lx + bz * ly + nz * up,
                reach
            );
        }
        out[w] = total / samples;
    }
    return out;
}

/**
 * How the surface turns at each place, per metre: 1/r on a ball of radius
 * r, negative in a hollow.
 */
export function bakeCurvature(
    surface: BakeSurface,
    welded: Weld,
    near: number[][]
): Float32Array {
    const { at, normal } = weldedFrames(surface, welded);
    const out = new Float32Array(welded.count);
    for (let w = 0; w < welded.count; w++) {
        let total = 0;
        let count = 0;
        for (const other of near[w]) {
            const dx = at[w * 3] - at[other * 3];
            const dy = at[w * 3 + 1] - at[other * 3 + 1];
            const dz = at[w * 3 + 2] - at[other * 3 + 2];
            const length2 = dx * dx + dy * dy + dz * dz;
            if (length2 < 1e-12) continue;
            total +=
                (2 *
                    (dx * normal[w * 3] +
                        dy * normal[w * 3 + 1] +
                        dz * normal[w * 3 + 2])) /
                length2;
            count++;
        }
        out[w] = count ? total / count : 0;
    }
    return out;
}

/** Even a value out over the surface: each pass mixes in the neighbours. */
export function smoothOver(
    values: Float32Array,
    near: number[][],
    passes: number,
    amount = 0.5
): Float32Array {
    let from = values;
    for (let pass = 0; pass < passes; pass++) {
        const to = new Float32Array(from.length);
        for (let w = 0; w < from.length; w++) {
            if (!near[w].length) {
                to[w] = from[w];
                continue;
            }
            let total = 0;
            for (const other of near[w]) total += from[other];
            to[w] = from[w] * (1 - amount) + (total / near[w].length) * amount;
        }
        from = to;
    }
    return from;
}
