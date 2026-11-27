import type { RawMesh } from "./mesher";
import type { Shape, Vec3 } from "./sdf";

export type Rgb = [number, number, number];

const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

/** "#rrggbb" to linear RGB, the space vertex colours are stored in. */
export function rgb(hex: string): Rgb {
    const n = parseInt(hex.slice(1), 16);
    return [
        toLinear(((n >> 16) & 255) / 255),
        toLinear(((n >> 8) & 255) / 255),
        toLinear((n & 255) / 255),
    ];
}

export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
];

export const scaleRgb = (a: Rgb, s: number): Rgb => [
    a[0] * s,
    a[1] * s,
    a[2] * s,
];

/**
 * Painted sky light: surfaces that face down sit in shade. Baked into
 * colour, it gives folds and undersides their form under any lighting.
 */
export const skyShade = (n: Vec3, depth = 0.24) =>
    1 - depth * (0.5 - 0.5 * n[1]) * (0.5 - 0.5 * n[1]) * 2;

/** Geometry for one avatar part before it is bound to the skeleton. */
export interface PartMesh {
    positions: number[];
    normals: number[];
    colors: number[];
    uvs: number[];
    indices: number[];
}

/**
 * How open a point on a surface is, from the field itself: step out along
 * the normal and see how much room there is. 1 is fully open, 0 is buried.
 */
export function occlusion(
    source: Shape,
    p: Vec3,
    n: Vec3,
    reach = 0.03,
    samples = 4
) {
    let sum = 0;
    let total = 0;
    for (let i = 1; i <= samples; i++) {
        const d = (reach * i) / samples;
        const weight = 1 / i;
        const v = source.eval(
            p[0] + n[0] * d,
            p[1] + n[1] * d,
            p[2] + n[2] * d
        );
        sum += Math.min(1, Math.max(0, v / d)) * weight;
        total += weight;
    }
    return sum / total;
}

/**
 * Cache pruned copies of a field on a coarse grid, so repeated queries near
 * a surface (occlusion, projection) only pay for the primitives nearby.
 * `reach` is how far from the query point later evaluations may stray.
 */
export function localise(source: Shape, cell: number, reach: number) {
    if (!source.prune) return () => source;
    const cache = new Map<number, Shape>();
    const radius = (cell * Math.sqrt(3)) / 2 + reach;
    return (x: number, y: number, z: number): Shape => {
        const i = Math.floor(x / cell);
        const j = Math.floor(y / cell);
        const k = Math.floor(z / cell);
        const key = i + 512 + (j + 512) * 1024 + (k + 512) * 1048576;
        let found = cache.get(key);
        if (!found) {
            found = source.prune(
                (i + 0.5) * cell,
                (j + 0.5) * cell,
                (k + 0.5) * cell,
                radius
            );
            cache.set(key, found);
        }
        return found;
    };
}

export class MeshBuilder implements PartMesh {
    positions: number[] = [];
    normals: number[] = [];
    colors: number[] = [];
    uvs: number[] = [];
    indices: number[] = [];

    get count() {
        return this.positions.length / 3;
    }

    vertex(p: Vec3, n: Vec3, color: Rgb, u = 0, v = 0) {
        this.positions.push(p[0], p[1], p[2]);
        this.normals.push(n[0], n[1], n[2]);
        this.colors.push(color[0], color[1], color[2]);
        this.uvs.push(u, v);
        return this.count - 1;
    }

    tri(a: number, b: number, c: number) {
        this.indices.push(a, b, c);
    }

    quad(a: number, b: number, c: number, d: number) {
        this.indices.push(a, b, c, a, c, d);
    }

    /** Add a meshed field, colouring each vertex from its position and normal. */
    addRaw(
        raw: RawMesh,
        paint: (p: Vec3, n: Vec3) => Rgb,
        uv?: (p: Vec3, n: Vec3) => [number, number]
    ) {
        const base = this.count;
        for (let i = 0; i < raw.positions.length; i += 3) {
            const p: Vec3 = [
                raw.positions[i],
                raw.positions[i + 1],
                raw.positions[i + 2],
            ];
            const n: Vec3 = [
                raw.normals[i],
                raw.normals[i + 1],
                raw.normals[i + 2],
            ];
            const t = uv ? uv(p, n) : [0, 0];
            this.vertex(p, n, paint(p, n), t[0], t[1]);
        }
        for (let i = 0; i < raw.indices.length; i++)
            this.indices.push(base + raw.indices[i]);
        return this;
    }

    /** Append another builder, optionally mirrored across the YZ plane. */
    append(other: PartMesh, mirror = false) {
        const base = this.count;
        const s = mirror ? -1 : 1;
        for (let i = 0; i < other.positions.length; i += 3) {
            this.positions.push(
                other.positions[i] * s,
                other.positions[i + 1],
                other.positions[i + 2]
            );
            this.normals.push(
                other.normals[i] * s,
                other.normals[i + 1],
                other.normals[i + 2]
            );
        }
        this.colors.push(...other.colors);
        this.uvs.push(...other.uvs);
        for (let i = 0; i < other.indices.length; i += 3) {
            const a = base + other.indices[i];
            const b = base + other.indices[i + 1];
            const c = base + other.indices[i + 2];
            if (mirror) this.indices.push(a, c, b);
            else this.indices.push(a, b, c);
        }
        return this;
    }

    /**
     * A grid of vertices joined into quads: `rows` by `columns`, optionally
     * closed around the columns. Returns the index of the first vertex.
     */
    grid(
        rows: number,
        columns: number,
        closed: boolean,
        point: (
            row: number,
            column: number
        ) => {
            p: Vec3;
            color: Rgb;
            uv?: [number, number];
            n?: Vec3;
        },
        flip = false
    ) {
        const base = this.count;
        const explicit: boolean[] = [];
        for (let r = 0; r < rows; r++)
            for (let c = 0; c < columns; c++) {
                const v = point(r, c);
                explicit.push(!!v.n);
                this.vertex(
                    v.p,
                    v.n || [0, 0, 0],
                    v.color,
                    v.uv ? v.uv[0] : 0,
                    v.uv ? v.uv[1] : 0
                );
            }
        const span = closed ? columns : columns - 1;
        const first = this.indices.length;
        for (let r = 0; r + 1 < rows; r++)
            for (let c = 0; c < span; c++) {
                const a = base + r * columns + c;
                const b = base + r * columns + ((c + 1) % columns);
                const d = base + (r + 1) * columns + c;
                const e = base + (r + 1) * columns + ((c + 1) % columns);
                if (flip) this.indices.push(a, d, e, a, e, b);
                else this.indices.push(a, b, e, a, e, d);
            }
        this.smooth(base, this.count, first, explicit);
        return base;
    }

    /** Area-weighted vertex normals for a vertex range. */
    smooth(from: number, to: number, firstIndex = 0, keep?: boolean[]) {
        const p = this.positions;
        const n = this.normals;
        const kept = (i: number) => keep && keep[i - from];
        for (let i = from; i < to; i++)
            if (!kept(i)) n[i * 3] = n[i * 3 + 1] = n[i * 3 + 2] = 0;
        for (let i = firstIndex; i < this.indices.length; i += 3) {
            const a = this.indices[i];
            const b = this.indices[i + 1];
            const c = this.indices[i + 2];
            const ux = p[b * 3] - p[a * 3];
            const uy = p[b * 3 + 1] - p[a * 3 + 1];
            const uz = p[b * 3 + 2] - p[a * 3 + 2];
            const vx = p[c * 3] - p[a * 3];
            const vy = p[c * 3 + 1] - p[a * 3 + 1];
            const vz = p[c * 3 + 2] - p[a * 3 + 2];
            const nx = uy * vz - uz * vy;
            const ny = uz * vx - ux * vz;
            const nz = ux * vy - uy * vx;
            for (const v of [a, b, c]) {
                if (v < from || v >= to || kept(v)) continue;
                n[v * 3] += nx;
                n[v * 3 + 1] += ny;
                n[v * 3 + 2] += nz;
            }
        }
        for (let i = from; i < to; i++) {
            if (kept(i)) continue;
            const l = Math.hypot(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]);
            if (l < 1e-12) {
                n[i * 3] = n[i * 3 + 1] = n[i * 3 + 2] = 0;
                continue;
            }
            n[i * 3] /= l;
            n[i * 3 + 1] /= l;
            n[i * 3 + 2] /= l;
        }
    }

    /**
     * A tube along a path. `radius(t, angle)` may vary along and around;
     * `frame` supplies the cross-section axes at each point. Ends are capped
     * to a point when the radius there is zero, or with a fan otherwise.
     */
    tube(
        path: Vec3[],
        sides: number,
        radius: (t: number, angle: number) => number,
        color: (t: number, angle: number, i: number) => Rgb,
        options: {
            /** Fixed reference "up" for the cross-section. */
            up?: Vec3;
            /** Per-point normal override (the cross-section's local Y). */
            normals?: Vec3[];
            /** Squash the cross-section along its normal. */
            flatten?: number | ((t: number) => number);
            uv?: (t: number, angle: number) => [number, number];
            caps?: boolean;
        } = {}
    ) {
        const n = path.length;
        const frames = pathFrames(path, options.up, options.normals);
        const base = this.count;
        const first = this.indices.length;
        for (let i = 0; i < n; i++) {
            const t = n > 1 ? i / (n - 1) : 0;
            const { normal, binormal } = frames[i];
            const flat =
                typeof options.flatten === "function"
                    ? options.flatten(t)
                    : options.flatten ?? 1;
            for (let s = 0; s < sides; s++) {
                const angle = (s / sides) * Math.PI * 2;
                const r = radius(t, angle);
                const cx = Math.cos(angle) * r;
                const cy = Math.sin(angle) * r * flat;
                const p: Vec3 = [
                    path[i][0] + binormal[0] * cx + normal[0] * cy,
                    path[i][1] + binormal[1] * cx + normal[1] * cy,
                    path[i][2] + binormal[2] * cx + normal[2] * cy,
                ];
                const uv = options.uv ? options.uv(t, angle) : [s / sides, t];
                this.vertex(p, [0, 0, 0], color(t, angle, i), uv[0], uv[1]);
            }
        }
        for (let i = 0; i + 1 < n; i++)
            for (let s = 0; s < sides; s++) {
                const a = base + i * sides + s;
                const b = base + i * sides + ((s + 1) % sides);
                const c = base + (i + 1) * sides + ((s + 1) % sides);
                const d = base + (i + 1) * sides + s;
                this.indices.push(a, d, c, a, c, b);
            }
        if (options.caps !== false) {
            for (const end of [0, n - 1]) {
                const t = end === 0 ? 0 : 1;
                const tangent = frames[end].tangent;
                const sign = end === 0 ? -1 : 1;
                const centre = this.vertex(
                    path[end],
                    [tangent[0] * sign, tangent[1] * sign, tangent[2] * sign],
                    color(t, 0, end)
                );
                for (let s = 0; s < sides; s++) {
                    const a = base + end * sides + s;
                    const b = base + end * sides + ((s + 1) % sides);
                    if (end === 0) this.indices.push(centre, a, b);
                    else this.indices.push(centre, b, a);
                }
            }
        }
        this.smooth(base, this.count, first);
        // Where the tube closes to a point no face has any area; give those
        // vertices the direction the tube runs in.
        const normals = this.normals;
        for (let v = base; v < this.count; v++) {
            if (normals[v * 3] || normals[v * 3 + 1] || normals[v * 3 + 2])
                continue;
            // Ring vertices come first, then the two cap centres.
            const ring = Math.floor((v - base) / sides);
            const i = ring < n ? ring : v - base - n * sides === 0 ? 0 : n - 1;
            const sign = i < n / 2 ? -1 : 1;
            normals[v * 3] = frames[i].tangent[0] * sign;
            normals[v * 3 + 1] = frames[i].tangent[1] * sign;
            normals[v * 3 + 2] = frames[i].tangent[2] * sign;
        }
        return base;
    }
}

export interface Frame {
    tangent: [number, number, number];
    normal: [number, number, number];
    binormal: [number, number, number];
}

const cross = (a: Vec3, b: Vec3): [number, number, number] => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
const normalize = (v: Vec3): [number, number, number] => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
};

/** Twist-free frames along a path (parallel transport). */
export function pathFrames(path: Vec3[], up?: Vec3, normals?: Vec3[]): Frame[] {
    const n = path.length;
    const frames: Frame[] = [];
    let previous: [number, number, number] | undefined;
    for (let i = 0; i < n; i++) {
        const a = path[Math.max(0, i - 1)];
        const b = path[Math.min(n - 1, i + 1)];
        const tangent = normalize([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
        let reference: Vec3 =
            (normals && normals[i]) ||
            up ||
            previous ||
            (Math.abs(tangent[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
        // Remove the part along the tangent.
        const d =
            reference[0] * tangent[0] +
            reference[1] * tangent[1] +
            reference[2] * tangent[2];
        let normal: [number, number, number] = [
            reference[0] - tangent[0] * d,
            reference[1] - tangent[1] * d,
            reference[2] - tangent[2] * d,
        ];
        if (Math.hypot(normal[0], normal[1], normal[2]) < 1e-5) {
            reference = Math.abs(tangent[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
            const e =
                reference[0] * tangent[0] +
                reference[1] * tangent[1] +
                reference[2] * tangent[2];
            normal = [
                reference[0] - tangent[0] * e,
                reference[1] - tangent[1] * e,
                reference[2] - tangent[2] * e,
            ];
        }
        normal = normalize(normal);
        const binormal = cross(tangent, normal);
        frames.push({ tangent, normal, binormal });
        previous = normal;
    }
    return frames;
}

/** Catmull-Rom spline through control points, sampled evenly per span. */
export function spline(points: Vec3[], samples: number): Vec3[] {
    const out: Vec3[] = [];
    const n = points.length;
    const at = (i: number) => points[Math.min(n - 1, Math.max(0, i))];
    for (let s = 0; s < samples; s++) {
        const u = (s / (samples - 1)) * (n - 1);
        const i = Math.min(n - 2, Math.floor(u));
        const t = u - i;
        const p0 = at(i - 1);
        const p1 = at(i);
        const p2 = at(i + 1);
        const p3 = at(i + 2);
        const t2 = t * t;
        const t3 = t2 * t;
        const point = [0, 0, 0] as [number, number, number];
        for (let k = 0; k < 3; k++)
            point[k] =
                0.5 *
                (2 * p1[k] +
                    (-p0[k] + p2[k]) * t +
                    (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
                    (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
        out.push(point);
    }
    return out;
}
