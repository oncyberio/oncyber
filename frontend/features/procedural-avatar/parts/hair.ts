import {
    MeshBuilder,
    Rgb,
    localise,
    mixRgb,
    rgb,
    spline,
} from "../kernel/build";
import { clamp, mix, mulberry, noise3, smoothstep } from "../kernel/noise";
import { Shape, Vec3, field, gradient, place, project } from "../kernel/sdf";
import type { SculptLock } from "./hairSculpt";
import { HEAD_ORIGIN, SkinField } from "./skinField";

/**
 * Hair, grown rather than modelled.
 *
 * A groom lays guide curves over the sculpted head: each is traced along
 * the skull's distance field (so it hugs the head and never dips inside
 * it), then swept into a flat, ridged, tapered lock. Hundreds of locks in
 * layers give the mass; hair-thin strays break the silhouette. Colour is
 * baked per vertex: darker at the roots and in the under-layers, streaked
 * along the length, with a soft sheen where a lock turns to the light.
 */

export interface HairPalette {
    base: string;
    /** Sheen on the lit side of a lock. */
    sheen: string;
    /** Warm tone that shows where hair thins out at the tips. */
    tip: string;
}

type P3 = [number, number, number];

const sub = (a: Vec3, b: Vec3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const addv = (a: Vec3, b: Vec3, s = 1): P3 => [
    a[0] + b[0] * s,
    a[1] + b[1] * s,
    a[2] + b[2] * s,
];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Vec3): P3 => {
    const l = len(a) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: Vec3, b: Vec3): P3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];

export interface LockOptions {
    /** Half-width and half-thickness at the widest point, in metres. */
    width: number;
    thickness: number;
    /** 0..1 along the lock where it is widest. */
    belly?: number;
    /** Width at the root relative to the widest point. */
    root?: number;
    /** Brightness of this lock relative to its neighbours. */
    tone?: number;
    /** How buried the lock is: 0 outermost, 1 against the scalp. */
    depth?: number;
    sides?: number;
    samples?: number;
    /** Ridges round the cross-section; reads as grouped strands. */
    ridges?: number;
    /** Normals to orient the flat side; defaults to the head's surface. */
    normals?: Vec3[];
}

export class Groom {
    readonly out = new MeshBuilder();
    readonly random: () => number;
    /** Every lock's path, for strays to sprout from. */
    readonly paths: P3[][] = [];
    /** Set to an array to collect locks for sculpting (see hairSculpt). */
    sculpt: SculptLock[] | null = null;
    private readonly local: (x: number, y: number, z: number) => Shape;
    private readonly base: Rgb;
    private readonly sheen: Rgb;
    private readonly tip: Rgb;
    private readonly g: P3 = [0, 0, 0];

    constructor(
        /** The head (and whatever else hair must stay outside), head space. */
        readonly collider: Shape,
        palette: HairPalette,
        seed: number
    ) {
        this.random = mulberry(seed);
        this.local = localise(collider, 0.02, 0.012);
        this.base = rgb(palette.base);
        this.sheen = rgb(palette.sheen);
        this.tip = rgb(palette.tip);
    }

    /** A random number in [a, b]. */
    range(a: number, b: number) {
        return a + (b - a) * this.random();
    }

    distance(p: Vec3) {
        return this.local(p[0], p[1], p[2]).eval(p[0], p[1], p[2]);
    }

    normal(p: Vec3): P3 {
        gradient(
            this.local(p[0], p[1], p[2]),
            p[0],
            p[1],
            p[2],
            0.0015,
            this.g
        );
        return unit(this.g);
    }

    /** Move a point to sit `lift` metres off the surface. */
    settle(p: Vec3, lift: number): P3 {
        const q: P3 = [p[0], p[1], p[2]];
        project(this.local(q[0], q[1], q[2]), q, lift, 3, 0.0015);
        return q;
    }

    /** Push a point out if it is closer to the surface than `lift`. */
    clear(p: Vec3, lift: number): P3 {
        const d = this.distance(p);
        if (d >= lift) return [p[0], p[1], p[2]];
        return addv(p, this.normal(p), lift - d);
    }

    /** The point on the surface seen from `origin` along `direction`. */
    cast(origin: Vec3, direction: Vec3, lift = 0): P3 {
        const d = unit(direction);
        let t = 0.2;
        for (let i = 0; i < 40; i++) {
            const p = addv(origin, d, t);
            const v = this.distance(p) - lift;
            if (v < 0.0001) break;
            t -= v * 0.9;
            if (t < 0) break;
        }
        return addv(origin, d, t);
    }

    /**
     * Trace a guide over the surface from `root` towards `target`, riding
     * `lift(t)` metres above it. Stops `stop` metres short of the target.
     */
    flow(
        root: Vec3,
        target: Vec3,
        lift: (t: number) => number,
        options: {
            step?: number;
            stop?: number;
            wander?: number;
            sideways?: Vec3;
            /** Go over the top of the head, never down across the face. */
            over?: boolean;
        } = {}
    ): P3[] {
        const step = options.step ?? 0.011;
        const stop = options.stop ?? 0.012;
        const total = Math.max(0.03, len(sub(target, root)) * 1.25);
        const phase = this.random() * 100;
        let p = this.settle(root, lift(0));
        const path: P3[] = [p];
        for (let i = 0; i < 48; i++) {
            const to = sub(target, p);
            const distance = len(to);
            if (distance < stop) break;
            const t = clamp(1 - distance / total);
            const n = this.normal(p);
            let d = addv(to, n, -dot(to, n));
            if (len(d) < 1e-5) d = cross(n, [1, 0, 0]);
            d = unit(d);
            if (options.over) {
                const k = smoothstep(-0.03, 0.04, p[2]) * 1.8;
                d = unit(
                    addv(d, [-n[0] * n[1], 1 - n[1] * n[1], -n[2] * n[1]], k)
                );
            }
            if (options.sideways) {
                const k = 1 - smoothstep(0, 0.3, t);
                d = unit(addv(d, options.sideways, k * 1.6));
            }
            if (options.wander) {
                const side = cross(n, d);
                const w =
                    (noise3(phase + i * 0.35, phase * 0.37, 0.5) - 0.5) *
                    2 *
                    options.wander;
                d = unit(addv(d, side, w));
            }
            p = this.settle(addv(p, d, Math.min(step, distance)), lift(t));
            path.push(p);
        }
        return path;
    }

    /**
     * Sweep a guide into a lock. The cross-section is a flat ridged ellipse
     * lying on the surface, tapering to a point at the tip.
     */
    lock(guide: Vec3[], options: LockOptions) {
        if (guide.length < 2) return;
        const samples = options.samples ?? 12;
        const sides = options.sides ?? 6;
        const path = spline(guide as Vec3[], samples) as P3[];
        const normals =
            options.normals && options.normals.length === guide.length
                ? (spline(options.normals, samples).map(unit) as P3[])
                : path.map((p) => this.normal(p));
        const belly = options.belly ?? 0.4;
        const root = options.root ?? 0.55;
        const tone = options.tone ?? 1;
        const depth = options.depth ?? 0;
        const ridges = options.ridges ?? 3;
        if (this.sculpt) {
            // Collected for sculpting as one mass instead of a tube each.
            this.sculpt.push({
                path,
                normals,
                width: options.width,
                flat: Math.min(1, options.thickness / options.width),
                belly,
                root,
                tone,
                depth,
                ridges: Math.max(3, ridges + 2),
            });
            this.paths.push(path);
            return;
        }
        const ridgePhase = this.random() * Math.PI * 2;
        const streak = Array.from({ length: sides }, () =>
            this.range(0.7, 1.3)
        );
        const light = unit([0.3, 0.78, 0.55]);
        const glint = normals.map((n, i) => {
            const a = path[Math.max(0, i - 1)];
            const b = path[Math.min(samples - 1, i + 1)];
            const tangent = unit(sub(b, a));
            // Sheen sits where the lock runs across the light, on its lit face.
            const across = Math.sqrt(Math.max(0, 1 - dot(tangent, light) ** 2));
            return (
                Math.pow(across, 8) *
                smoothstep(0.1, 0.9, dot(n, light)) *
                (0.25 +
                    0.75 *
                        noise3(
                            path[i][0] * 60,
                            path[i][1] * 60,
                            path[i][2] * 60
                        ))
            );
        });
        const profile = (t: number) =>
            t < belly
                ? mix(root, 1, smoothstep(0, belly, t))
                : Math.pow(1 - smoothstep(belly, 1, t), 0.8);
        const base = this.base;
        const sheen = this.sheen;
        const tip = this.tip;
        this.out.tube(
            path,
            sides,
            (t, angle) =>
                options.width *
                profile(t) *
                (1 + 0.1 * Math.cos(angle * ridges + ridgePhase)),
            (t, angle, i) => {
                const s = Math.round((angle / (Math.PI * 2)) * sides) % sides;
                // Roots and buried layers sit in shadow.
                const shadow =
                    mix(0.5, 1, smoothstep(0, 0.22, t)) * mix(1, 0.5, depth);
                const outward = smoothstep(-0.2, 0.9, Math.sin(angle));
                const c = mixRgb(base, tip, smoothstep(0.7, 1, t) * 0.5);
                const k = tone * streak[s] * shadow * mix(0.72, 1.12, outward);
                const shine =
                    glint[i] *
                    streak[s] *
                    outward *
                    (1 - depth * 0.7) *
                    Math.min(1.6, tone) *
                    smoothstep(0.12, 0.4, t);
                return [
                    c[0] * k + sheen[0] * shine,
                    c[1] * k + sheen[1] * shine,
                    c[2] * k + sheen[2] * shine,
                ];
            },
            {
                normals,
                flatten: options.thickness / options.width,
                caps: false,
            }
        );
        this.paths.push(path);
    }

    /** A single stray hair: a hair-thin triangle-section tube. */
    stray(guide: Vec3[], radius = 0.00042, tone = 1) {
        const path = spline(guide as Vec3[], Math.max(6, guide.length)) as P3[];
        const c: Rgb = [
            this.base[0] * 1.5 * tone + this.sheen[0] * 0.08,
            this.base[1] * 1.5 * tone + this.sheen[1] * 0.08,
            this.base[2] * 1.5 * tone + this.sheen[2] * 0.08,
        ];
        this.out.tube(
            path,
            3,
            (t) => radius * (1 - 0.85 * t * t),
            () => c,
            { caps: false }
        );
    }

    /**
     * Scatter strays off the locks laid so far: each leaves a lock at an
     * angle, then curls.
     */
    strays(count: number, length: [number, number], pick?: (p: P3) => boolean) {
        if (!this.paths.length) return;
        let made = 0;
        for (let attempt = 0; attempt < count * 6 && made < count; attempt++) {
            const path =
                this.paths[Math.floor(this.random() * this.paths.length)];
            const i = Math.floor(this.range(0.15, 0.95) * (path.length - 1));
            const start = path[i];
            if (pick && !pick(start)) continue;
            const tangent = unit(
                sub(
                    path[Math.min(path.length - 1, i + 1)],
                    path[Math.max(0, i - 1)]
                )
            );
            const n = this.normal(start);
            const side = cross(tangent, n);
            let d = unit(
                addv(
                    addv(tangent, n, this.range(0.25, 1.1)),
                    side,
                    this.range(-0.9, 0.9)
                )
            );
            const axis = unit([
                this.range(-1, 1),
                this.range(-1, 1),
                this.range(-1, 1),
            ]);
            const curl = this.range(-0.5, 0.5);
            const total = this.range(length[0], length[1]);
            const steps = 7;
            let p = addv(start, n, 0.001);
            const guide: P3[] = [p];
            for (let k = 0; k < steps; k++) {
                // Turn the heading about a random axis: the curl.
                const c = cross(axis, d);
                d = unit(addv(addv(d, c, curl), [0, -0.12, 0]));
                p = this.clear(addv(p, d, total / steps), 0.002);
                guide.push(p);
            }
            this.stray(
                guide,
                this.range(0.00032, 0.0005),
                this.range(0.8, 1.6)
            );
            made++;
        }
    }

    /**
     * The scalp under the hair: a thin dark cap that follows the skull, so
     * no bare skin shows between locks. It stops short of the hairline,
     * where the face texture paints the roots at a finer grain.
     */
    scalp(
        centre: Vec3,
        inside: (p: P3) => number,
        lift = 0.0009,
        rows = 30,
        columns = 56
    ) {
        const base = this.out.count;
        const dark: Rgb = [
            this.base[0] * 0.6,
            this.base[1] * 0.6,
            this.base[2] * 0.6,
        ];
        const keep: number[] = [];
        for (let r = 0; r <= rows; r++) {
            const polar = (r / rows) * Math.PI * 0.86;
            for (let c = 0; c < columns; c++) {
                const az = (c / columns) * Math.PI * 2;
                const direction: P3 = [
                    Math.sin(polar) * Math.sin(az),
                    Math.cos(polar),
                    Math.sin(polar) * Math.cos(az),
                ];
                const p = this.cast(centre, direction, lift);
                const amount = inside(p);
                keep.push(amount);
                this.out.vertex(p, this.normal(p), dark);
            }
        }
        for (let r = 0; r < rows; r++)
            for (let c = 0; c < columns; c++) {
                const a = r * columns + c;
                const b = r * columns + ((c + 1) % columns);
                const d = (r + 1) * columns + c;
                const e = (r + 1) * columns + ((c + 1) % columns);
                if (
                    keep[a] <= 0 ||
                    keep[b] <= 0 ||
                    keep[d] <= 0 ||
                    keep[e] <= 0
                )
                    continue;
                this.out.quad(base + a, base + d, base + e, base + b);
            }
    }
}

/** Evenly spread directions over the upper part of a sphere. */
export function scatter(count: number, random: () => number): P3[] {
    const out: P3[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    const offset = random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
        const y = 1 - (i / (count - 1)) * 1.75;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const a = offset + i * golden;
        out.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
    return out;
}

export interface Hairline {
    /** Skull centre the roots are cast from. */
    centre: Vec3;
    /** Middle of the forehead hairline. */
    front: Vec3;
    /** How steeply the hairline drops towards the temples and ears. */
    slope: number;
    /** Lowest hair at the nape. */
    napeY: number;
    /** How far the hairline recedes at the temples, in metres. */
    temples: number;
}

/**
 * Signed depth inside the hairline: positive where hair grows, growing
 * with distance from the edge (metres, roughly).
 */
export function hairlineDepth(line: Hairline, p: Vec3) {
    const n = unit([0, -line.slope, 1]);
    const recede =
        line.temples *
        Math.exp(-(((Math.abs(p[0]) - 0.045) / 0.016) ** 2)) *
        smoothstep(0.02, 0.06, p[2]);
    const front = -(
        (p[1] - line.front[1]) * n[1] +
        (p[2] - line.front[2]) * n[2]
    );
    return Math.min(front - recede, p[1] - line.napeY);
}

/**
 * What hair must stay outside of, in head space: the head, the body, and
 * any clothes passed in (avatar-space shapes such as a collar).
 */
export function hairCollider(skin: SkinField, clothes: Shape[] = []): Shape {
    const joint = skin.rig.body.head;
    const inverse = 1 / skin.rig.body.headScale;
    const out = field().add(skin.head);
    out.add(place(skin.body, joint, HEAD_ORIGIN, inverse));
    for (const shape of clothes)
        out.add(place(shape, joint, HEAD_ORIGIN, inverse));
    return out;
}

export { addv, cross, dot, len, sub, unit };
export type { P3 };
