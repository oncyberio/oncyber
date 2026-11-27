import { MeshBuilder, Rgb, localise, mixRgb, occlusion } from "../kernel/build";
import { meshField } from "../kernel/mesher";
import { smoothstep } from "../kernel/noise";
import { Shape, Vec3, field, offset, smin } from "../kernel/sdf";

type P3 = [number, number, number];

/** One lock of hair to be sculpted: a guide and its cross-section. */
export interface SculptLock {
    path: P3[];
    /** The side of the lock that faces away from the head, per point. */
    normals: P3[];
    /** Half-width at the widest point, and thickness as a share of width. */
    width: number;
    flat: number;
    belly: number;
    root: number;
    tone: number;
    depth: number;
    /** Strand ridges round the lock. */
    ridges: number;
}

/** Height of the broad flutes along a lock, and their spacing, in metres. */
const RIDGE = 0.00045;
const FLUTE = (Math.PI * 2) / 0.0075;
const FIELDS = 19;

/**
 * Hair as one sculpted mass. Every lock is a chain of flattened, fluted
 * cones; locks melt into their neighbours where they touch, the way a
 * sculptor's clay strands do, so the hair has one clean silhouette with
 * strand ridges running along every lock.
 *
 * The bundle is a distance field over all the segments. It prunes itself
 * to the segments near a region, which keeps meshing a few hundred locks
 * affordable.
 */
export class LockBundle implements Shape {
    /** FIELDS numbers per segment; see `add`. */
    private readonly data: Float64Array;
    private readonly count: number;
    lo = -Infinity;
    hi = Infinity;

    constructor(data: Float64Array, count: number, readonly blend: number) {
        this.data = data;
        this.count = count;
    }

    static from(locks: SculptLock[], blend = 0.003) {
        const rows: number[] = [];
        locks.forEach((lock, index) => {
            const n = lock.path.length;
            const phase = (index * 2.399) % (Math.PI * 2);
            const profile = (t: number) =>
                lock.width *
                (t < lock.belly
                    ? lock.root + (1 - lock.root) * smoothstep(0, lock.belly, t)
                    : Math.pow(1 - smoothstep(lock.belly, 1, t), 0.7));
            for (let i = 0; i + 1 < n; i++) {
                const a = lock.path[i];
                const b = lock.path[i + 1];
                const na = lock.normals[i];
                const nb = lock.normals[i + 1];
                rows.push(
                    a[0],
                    a[1],
                    a[2],
                    b[0] - a[0],
                    b[1] - a[1],
                    b[2] - a[2],
                    (na[0] + nb[0]) / 2,
                    (na[1] + nb[1]) / 2,
                    (na[2] + nb[2]) / 2,
                    profile(i / (n - 1)),
                    profile((i + 1) / (n - 1)),
                    lock.flat,
                    lock.ridges + phase / 10,
                    index + i / (n - 1) / 2,
                    // A sphere round the segment, to reject it cheaply.
                    (a[0] + b[0]) / 2,
                    (a[1] + b[1]) / 2,
                    (a[2] + b[2]) / 2,
                    Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 2 +
                        Math.max(
                            profile(i / (n - 1)),
                            profile((i + 1) / (n - 1))
                        ) *
                            1.05,
                    1 / (n - 1)
                );
            }
        });
        return new LockBundle(
            new Float64Array(rows),
            rows.length / FIELDS,
            blend
        );
    }

    /**
     * Distance to one segment, with the lock it belongs to, how far along
     * the segment the nearest point is, and the ridge height there.
     */
    private segment(
        s: number,
        x: number,
        y: number,
        z: number,
        out?: number[]
    ) {
        const d = this.data;
        const o = s * FIELDS;
        const px = x - d[o];
        const py = y - d[o + 1];
        const pz = z - d[o + 2];
        const ax = d[o + 3];
        const ay = d[o + 4];
        const az = d[o + 5];
        const l2 = ax * ax + ay * ay + az * az;
        let h = (px * ax + py * ay + pz * az) / l2;
        h = h < 0 ? 0 : h > 1 ? 1 : h;
        const qx = px - ax * h;
        const qy = py - ay * h;
        const qz = pz - az * h;
        // Thickness direction: the stored normal, squared off to the axis.
        let nx = d[o + 6];
        let ny = d[o + 7];
        let nz = d[o + 8];
        const along = (nx * ax + ny * ay + nz * az) / l2;
        nx -= ax * along;
        ny -= ay * along;
        nz -= az * along;
        const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        const flat = d[o + 11];
        const v = (qx * nx + qy * ny + qz * nz) / nl;
        const q2 = qx * qx + qy * qy + qz * qz;
        const u2 = Math.max(0, q2 - v * v);
        const vf = v / flat;
        const r = Math.sqrt(u2 + vf * vf);
        const radius = d[o + 9] + (d[o + 10] - d[o + 9]) * h;
        // Away from the surface the fluting cannot matter; skip its cost.
        const rough = r - radius;
        if (!out && (rough * flat > 0.004 || rough < -radius * 0.5))
            return rough * flat;
        // How far across the lock, measured straight across its width (not
        // from the nearest point, which would ring round the lock's ends).
        const bx = ay * nz - az * ny;
        const by = az * nx - ax * nz;
        const bz = ax * ny - ay * nx;
        const u =
            (px * bx + py * by + pz * bz) /
            (Math.sqrt(bx * bx + by * by + bz * bz) || 1);
        // Flutes run along the lock: a ripple across its width.
        const code = d[o + 12];
        const ridge = Math.cos(u * FLUTE + (code - Math.floor(code)) * 10);
        if (out) {
            out[0] = h;
            out[1] = ridge;
            out[2] = u;
        }
        return (r - radius) * flat - RIDGE * ridge;
    }

    eval = (x: number, y: number, z: number): number => {
        const d = this.data;
        let total = Infinity;
        let lock = -1;
        let best = Infinity;
        let near = 0.05;
        for (let s = 0; s < this.count; s++) {
            const id = Math.floor(d[s * FIELDS + 13]);
            if (id !== lock) {
                if (lock >= 0 && best < Infinity)
                    total =
                        total === Infinity
                            ? best
                            : smin(total, best, this.blend);
                lock = id;
                best = Infinity;
            }
            // A segment further off than anything found so far, by more
            // than the blend can reach, cannot change the answer.
            const o = s * FIELDS;
            const cx = x - d[o + 14];
            const cy = y - d[o + 15];
            const cz = z - d[o + 16];
            const away = Math.sqrt(cx * cx + cy * cy + cz * cz) - d[o + 17];
            if (away * d[o + 11] > near + this.blend) continue;
            const v = this.segment(s, x, y, z);
            if (v < best) best = v;
            if (v < near) near = v;
        }
        if (lock >= 0 && best < Infinity)
            total = total === Infinity ? best : smin(total, best, this.blend);
        return total === Infinity ? near : total;
    };

    prune = (x: number, y: number, z: number, radius: number): LockBundle => {
        const d = this.data;
        const reach = radius * 1.35 + 0.002 + this.blend;
        const kept: number[] = [];
        for (let s = 0; s < this.count; s++) {
            const o = s * FIELDS;
            const cx = d[o + 14] - x;
            const cy = d[o + 15] - y;
            const cz = d[o + 16] - z;
            const limit = reach + d[o + 17];
            if (cx * cx + cy * cy + cz * cz < limit * limit) kept.push(s);
        }
        const data = new Float64Array(kept.length * FIELDS);
        kept.forEach((s, i) =>
            data.set(d.subarray(s * FIELDS, (s + 1) * FIELDS), i * FIELDS)
        );
        const out = new LockBundle(data, kept.length, this.blend);
        if (!kept.length) out.lo = out.hi = 1;
        return out;
    };

    /**
     * The hair at a point: the nearest lock and where along it the point
     * is, and the strand direction and lock offset blended over every lock
     * close by, so shading runs smoothly from one lock into the next.
     */
    nearest(x: number, y: number, z: number) {
        const d = this.data;
        const info = [0, 0, 0];
        let best = Infinity;
        const out = {
            distance: Infinity,
            lock: -1,
            t: 0,
            ridge: 0,
            across: 0,
            shift: 0,
            tangent: [0, -1, 0] as P3,
        };
        const found: number[] = [];
        for (let s = 0; s < this.count; s++) {
            const v = this.segment(s, x, y, z, info);
            found.push(v);
            if (v >= best) continue;
            best = v;
            const o = s * FIELDS;
            out.distance = v;
            out.lock = Math.floor(d[o + 13]);
            out.t = (d[o + 13] - out.lock) * 2 + info[0] * d[o + 18];
            out.ridge = info[1];
            out.across = info[2];
        }
        let tx = 0;
        let ty = 0;
        let tz = 0;
        let shift = 0;
        let total = 0;
        for (let s = 0; s < this.count; s++) {
            const w = Math.exp(-Math.max(0, found[s] - best) / 0.0025);
            if (w < 0.01) continue;
            const o = s * FIELDS;
            const l = Math.hypot(d[o + 3], d[o + 4], d[o + 5]) || 1;
            tx += (d[o + 3] / l) * w;
            ty += (d[o + 4] / l) * w;
            tz += (d[o + 5] / l) * w;
            const id = Math.floor(d[o + 13]);
            shift += (((id * 0.6180339) % 1) * 2 - 1) * w;
            total += w;
        }
        const tl = Math.hypot(tx, ty, tz);
        if (tl > 1e-6) out.tangent = [tx / tl, ty / tl, tz / tl];
        if (total > 0) out.shift = shift / total;
        return out;
    }
}

export interface SculptOptions {
    /** The head the hair grows from, and where on it hair grows. */
    head: Shape;
    /** Positive inside the hairline, in metres from its edge. */
    hairline: (p: P3) => number;
    base: Rgb;
    tip: Rgb;
    cell: number;
    min: Vec3;
    max: Vec3;
}

/** Mesh a groom's locks, with the scalp beneath them, as one sculpture. */
export function sculptHair(locks: SculptLock[], options: SculptOptions) {
    const bundle = LockBundle.from(locks);
    const { head, hairline } = options;
    // A thin layer over the scalp joins the locks and hides the skin.
    const region: Shape = {
        eval: (x, y, z) => 0.002 - hairline([x, y, z]),
    };
    const scalp = field().add(offset(head, 0.0014)).clip(region, 0.004);
    const hair = field().add(bundle).add(scalp, 0.003);
    const local = localise(hair, 0.012, 0.014);
    const lookup = localise(bundle, 0.012, 0.004) as (
        x: number,
        y: number,
        z: number
    ) => LockBundle;
    const out = new MeshBuilder();
    const strand: [number, number] = [0, 0];
    const paint = (p: Vec3, n: Vec3): Rgb => {
        const near = lookup(p[0], p[1], p[2]).nearest(p[0], p[1], p[2]);
        const lock = locks[near.lock];
        const open = occlusion(local(p[0], p[1], p[2]), p, n, 0.012, 2);
        const onLock = lock && near.distance < 0.003;
        // Down and back over the scalp where no lock claims the surface.
        out.tangentNext = onLock ? near.tangent : [n[0] * 0.2, -0.9, -0.4];
        const groove = onLock ? smoothstep(-1, 0.6, near.ridge) : 0.5;
        out.auxNext = [
            open * (0.7 + 0.3 * groove),
            1,
            onLock ? near.shift : 0,
            onLock ? 1 : 0,
        ];
        // Across and along the lock: the shader draws strands from these.
        strand[0] = onLock ? near.across + near.lock * 0.37 : p[0];
        strand[1] = onLock ? near.t : 0;
        if (!onLock)
            return [
                options.base[0] * 0.6,
                options.base[1] * 0.6,
                options.base[2] * 0.6,
            ];
        // Strands differ in tone, darker in the grooves and under-layers.
        // Locks differ only a little in tone; the grooves carry the detail.
        const tone =
            (0.9 + 0.12 * Math.min(1.4, lock.tone - 0.5)) *
            (1 - 0.3 * lock.depth);
        const c = mixRgb(
            options.base,
            options.tip,
            smoothstep(0.75, 1, near.t) * 0.4
        );
        return [c[0] * tone, c[1] * tone, c[2] * tone];
    };
    out.addRaw(
        meshField(hair, {
            min: options.min,
            max: options.max,
            cell: options.cell,
            // Nothing inside the skull is ever seen.
            keep: (x, y, z) => head.eval(x, y, z) > -0.004,
        }),
        paint,
        () => strand
    );
    return out;
}
