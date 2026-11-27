/**
 * A small signed-distance-field kit for sculpting organic avatar parts.
 *
 * A shape is a function from a point to its signed distance from the
 * surface (negative inside). Shapes combine on a `Field`: an ordered list of
 * add / carve / clip steps with a blend radius each. A field can prune
 * itself for a region of space, dropping steps that cannot change the result
 * there; the mesher relies on that to stay fast with a hundred primitives.
 */

/**
 * What a shape is made of, for the shapes simple enough to be rebuilt
 * elsewhere (a shader that traces the same surface per pixel).
 */
export type ShapeDesc =
    | { type: "sphere"; c: Vec3; r: number }
    | { type: "ellipsoid"; c: Vec3; r: Vec3; basis: Basis }
    | { type: "roundCone"; a: Vec3; b: Vec3; ra: number; rb: number }
    | {
          type: "ribbonCone";
          a: Vec3;
          b: Vec3;
          ra: number;
          rb: number;
          out: Vec3;
          outEnd: Vec3;
          flat: number;
      }
    | { type: "halfSpace"; p: Vec3; n: Vec3 }
    | { type: "roundBox"; c: Vec3; half: Vec3; radius: number; basis: Basis }
    | { type: "torus"; c: Vec3; major: number; minor: number; basis: Basis }
    | { type: "symmetric"; source: Shape }
    | { type: "offset"; source: Shape; amount: number }
    | { type: "place"; source: Shape; from: Vec3; to: Vec3; scale: number };

export interface Shape {
    desc?: ShapeDesc;
    eval(x: number, y: number, z: number): number;
    /** A cheaper equivalent inside the ball of radius `r` around a point. */
    prune?(x: number, y: number, z: number, r: number): Shape;
}

export type Vec3 = readonly [number, number, number];

const shape = (fn: (x: number, y: number, z: number) => number): Shape => ({
    eval: fn,
});

export function sphere(c: Vec3, r: number): Shape {
    return { ...sphereRaw(c, r), desc: { type: "sphere", c, r } };
}

function sphereRaw(c: Vec3, r: number): Shape {
    const [cx, cy, cz] = c;
    return shape((x, y, z) => {
        const dx = x - cx;
        const dy = y - cy;
        const dz = z - cz;
        return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
    });
}

/** Round cone between two points; equal radii make a capsule. */
export function roundCone(a: Vec3, b: Vec3, ra: number, rb: number): Shape {
    return {
        ...roundConeRaw(a, b, ra, rb),
        desc: { type: "roundCone", a, b, ra, rb },
    };
}

function roundConeRaw(a: Vec3, b: Vec3, ra: number, rb: number): Shape {
    const [ax, ay, az] = a;
    const bx = b[0] - ax;
    const by = b[1] - ay;
    const bz = b[2] - az;
    const l2 = bx * bx + by * by + bz * bz;
    if (l2 < 1e-12) return sphere(a, Math.max(ra, rb));
    const rr = ra - rb;
    const a2 = l2 - rr * rr;
    const il2 = 1 / l2;
    return shape((x, y, z) => {
        const px = x - ax;
        const py = y - ay;
        const pz = z - az;
        const yy = px * bx + py * by + pz * bz;
        const zz = yy - l2;
        const qx = px * l2 - bx * yy;
        const qy = py * l2 - by * yy;
        const qz = pz * l2 - bz * yy;
        const x2 = qx * qx + qy * qy + qz * qz;
        const y2 = yy * yy * l2;
        const z2 = zz * zz * l2;
        const k = Math.sign(rr) * rr * rr * x2;
        if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - rb;
        if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - ra;
        return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - ra;
    });
}

export const capsule = (a: Vec3, b: Vec3, r: number) => roundCone(a, b, r, r);

/**
 * A round cone pressed flat: `out` (a unit vector square to the axis) is the
 * direction it is thin in, and `flat` its thickness as a fraction of its
 * width. Give `outEnd` to have it twist from `out` at `a` to `outEnd` at
 * `b`. A lock of hair lying on a head is a chain of these.
 */
export function ribbonCone(
    a: Vec3,
    b: Vec3,
    ra: number,
    rb: number,
    out: Vec3,
    flat: number,
    outEnd: Vec3 = out
): Shape {
    const [ax, ay, az] = a;
    const bx = b[0] - ax;
    const by = b[1] - ay;
    const bz = b[2] - az;
    const l2 = bx * bx + by * by + bz * bz || 1e-9;
    return {
        desc: { type: "ribbonCone", a, b, ra, rb, out, outEnd, flat },
        eval: (x, y, z) => {
            const px = x - ax;
            const py = y - ay;
            const pz = z - az;
            let h = (px * bx + py * by + pz * bz) / l2;
            h = h < 0 ? 0 : h > 1 ? 1 : h;
            const qx = px - bx * h;
            const qy = py - by * h;
            const qz = pz - bz * h;
            let ox = out[0] + (outEnd[0] - out[0]) * h;
            let oy = out[1] + (outEnd[1] - out[1]) * h;
            let oz = out[2] + (outEnd[2] - out[2]) * h;
            const ol = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
            ox /= ol;
            oy /= ol;
            oz /= ol;
            // An ellipse across the lock, `r` wide and `r * flat` thick.
            // Its distance is estimated from the implicit function and
            // its gradient: exact on the surface and along both axes,
            // close elsewhere, so shadows and occlusion see the true
            // gap to a thin lock instead of a fraction of it.
            const r = ra + (rb - ra) * h;
            const thin = r * flat;
            const o = qx * ox + qy * oy + qz * oz;
            const rx = qx - ox * o;
            const ry = qy - oy * o;
            const rz = qz - oz * o;
            const wide2 = rx * rx + ry * ry + rz * rz;
            const k0 = Math.sqrt(wide2 / (r * r) + (o * o) / (thin * thin));
            const k1 = Math.sqrt(
                wide2 / (r * r * r * r) + (o * o) / (thin * thin * thin * thin)
            );
            return k1 < 1e-9 ? -thin : (k0 * (k0 - 1)) / k1;
        },
    };
}

/** A 3x3 rotation, row-major, mapping local axes to world. */
export type Basis = readonly [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number
];

export const IDENTITY: Basis = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** Rotation from Euler angles in radians, applied X then Y then Z. */
export function euler(rx: number, ry: number, rz: number): Basis {
    const cx = Math.cos(rx);
    const sx = Math.sin(rx);
    const cy = Math.cos(ry);
    const sy = Math.sin(ry);
    const cz = Math.cos(rz);
    const sz = Math.sin(rz);
    // R = Rz * Ry * Rx
    return [
        cz * cy,
        cz * sy * sx - sz * cx,
        cz * sy * cx + sz * sx,
        sz * cy,
        sz * sy * sx + cz * cx,
        sz * sy * cx - cz * sx,
        -sy,
        cy * sx,
        cy * cx,
    ];
}

export function mulBasis(a: Basis, b: Basis): Basis {
    const out = new Array(9) as number[];
    for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++)
            out[r * 3 + c] =
                a[r * 3] * b[c] +
                a[r * 3 + 1] * b[3 + c] +
                a[r * 3 + 2] * b[6 + c];
    return out as unknown as Basis;
}

export function rotate(m: Basis, v: Vec3): [number, number, number] {
    return [
        m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
        m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
        m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
    ];
}

/**
 * Ellipsoid with per-axis radii, optionally rotated. The distance is the
 * usual first-order estimate: right at the surface, approximate far away.
 */
export function ellipsoid(c: Vec3, r: Vec3, basis: Basis = IDENTITY): Shape {
    return {
        ...ellipsoidRaw(c, r, basis),
        desc: { type: "ellipsoid", c, r, basis },
    };
}

function ellipsoidRaw(c: Vec3, r: Vec3, basis: Basis): Shape {
    const [cx, cy, cz] = c;
    const ix = 1 / r[0];
    const iy = 1 / r[1];
    const iz = 1 / r[2];
    const m = basis;
    const minR = Math.min(r[0], r[1], r[2]);
    return shape((x, y, z) => {
        const dx = x - cx;
        const dy = y - cy;
        const dz = z - cz;
        // World to local is the transpose of the basis.
        const lx = (m[0] * dx + m[3] * dy + m[6] * dz) * ix;
        const ly = (m[1] * dx + m[4] * dy + m[7] * dz) * iy;
        const lz = (m[2] * dx + m[5] * dy + m[8] * dz) * iz;
        const k0 = Math.sqrt(lx * lx + ly * ly + lz * lz);
        if (k0 < 1e-6) return -minR;
        const k1 = Math.sqrt(
            lx * ix * lx * ix + ly * iy * ly * iy + lz * iz * lz * iz
        );
        return (k0 * (k0 - 1)) / k1;
    });
}

/** Box with rounded edges, optionally rotated. */
export function roundBox(
    c: Vec3,
    half: Vec3,
    radius = 0,
    basis: Basis = IDENTITY
): Shape {
    return {
        ...roundBoxRaw(c, half, radius, basis),
        desc: { type: "roundBox", c, half, radius, basis },
    };
}

function roundBoxRaw(c: Vec3, half: Vec3, radius: number, basis: Basis): Shape {
    const [cx, cy, cz] = c;
    const hx = half[0] - radius;
    const hy = half[1] - radius;
    const hz = half[2] - radius;
    const m = basis;
    return shape((x, y, z) => {
        const dx = x - cx;
        const dy = y - cy;
        const dz = z - cz;
        const qx = Math.abs(m[0] * dx + m[3] * dy + m[6] * dz) - hx;
        const qy = Math.abs(m[1] * dx + m[4] * dy + m[7] * dz) - hy;
        const qz = Math.abs(m[2] * dx + m[5] * dy + m[8] * dz) - hz;
        const ox = Math.max(qx, 0);
        const oy = Math.max(qy, 0);
        const oz = Math.max(qz, 0);
        return (
            Math.sqrt(ox * ox + oy * oy + oz * oz) +
            Math.min(Math.max(qx, qy, qz), 0) -
            radius
        );
    });
}

/** Torus around the local Y axis of `basis`. */
export function torus(
    c: Vec3,
    major: number,
    minor: number,
    basis: Basis = IDENTITY
): Shape {
    const [cx, cy, cz] = c;
    const m = basis;
    return {
        desc: { type: "torus", c, major, minor, basis },
        eval: (x, y, z) => {
            const dx = x - cx;
            const dy = y - cy;
            const dz = z - cz;
            const lx = m[0] * dx + m[3] * dy + m[6] * dz;
            const ly = m[1] * dx + m[4] * dy + m[7] * dz;
            const lz = m[2] * dx + m[5] * dy + m[8] * dz;
            const q = Math.sqrt(lx * lx + lz * lz) - major;
            return Math.sqrt(q * q + ly * ly) - minor;
        },
    };
}

/** Half-space: negative behind the plane through `p` with normal `n`. */
export function halfSpace(p: Vec3, n: Vec3): Shape {
    return { ...halfSpaceRaw(p, n), desc: { type: "halfSpace", p, n } };
}

function halfSpaceRaw(p: Vec3, n: Vec3): Shape {
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    const nx = n[0] / l;
    const ny = n[1] / l;
    const nz = n[2] / l;
    const d = p[0] * nx + p[1] * ny + p[2] * nz;
    return shape((x, y, z) => x * nx + y * ny + z * nz - d);
}

/**
 * Any shape stretched along world axes around a point. Distances scale by
 * the smallest factor, which keeps them a safe underestimate.
 */
export function stretch(source: Shape, c: Vec3, s: Vec3): Shape {
    const [cx, cy, cz] = c;
    const ix = 1 / s[0];
    const iy = 1 / s[1];
    const iz = 1 / s[2];
    const k = Math.min(s[0], s[1], s[2]);
    return shape(
        (x, y, z) =>
            source.eval(
                cx + (x - cx) * ix,
                cy + (y - cy) * iy,
                cz + (z - cz) * iz
            ) * k
    );
}

/** Grow (positive) or shrink a shape by a constant offset. */
export function offset(source: Shape, amount: number): Shape {
    return {
        desc: { type: "offset", source, amount },
        eval: (x, y, z) => source.eval(x, y, z) - amount,
        prune: source.prune
            ? (x, y, z, r) =>
                  offset(source.prune(x, y, z, r + Math.abs(amount)), amount)
            : undefined,
    };
}

/**
 * Push a surface in or out by a function of position (folds, wrinkles).
 * `amplitude` bounds |fn| so pruning stays conservative.
 */
export function displace(
    source: Shape,
    fn: (x: number, y: number, z: number) => number,
    amplitude: number
): Shape {
    // Far from the surface the detail cannot matter; skip the cost of it.
    const far = amplitude * 2.5;
    return {
        eval: (x, y, z) => {
            const d = source.eval(x, y, z);
            return d > far || d < -far ? d : d - fn(x, y, z);
        },
        prune: source.prune
            ? (x, y, z, r) =>
                  displace(source.prune(x, y, z, r + amplitude), fn, amplitude)
            : undefined,
    };
}

/**
 * A shape authored around `from`, moved to `to` and uniformly scaled there.
 * Lets a head sculpted at a reference size sit on any body.
 */
export function place(source: Shape, from: Vec3, to: Vec3, scale = 1): Shape {
    const inv = 1 / scale;
    return {
        desc: { type: "place", source, from, to, scale },
        eval: (x, y, z) =>
            source.eval(
                from[0] + (x - to[0]) * inv,
                from[1] + (y - to[1]) * inv,
                from[2] + (z - to[2]) * inv
            ) * scale,
        prune: source.prune
            ? (x, y, z, r) =>
                  place(
                      source.prune(
                          from[0] + (x - to[0]) * inv,
                          from[1] + (y - to[1]) * inv,
                          from[2] + (z - to[2]) * inv,
                          r * inv
                      ),
                      from,
                      to,
                      scale
                  )
            : undefined,
    };
}

/** Mirror a shape across the YZ plane (left to right). */
export function mirrorX(source: Shape): Shape {
    return {
        eval: (x, y, z) => source.eval(-x, y, z),
        prune: source.prune
            ? (x, y, z, r) => mirrorX(source.prune(-x, y, z, r))
            : undefined,
    };
}

export function smin(a: number, b: number, k: number) {
    if (k <= 0) return a < b ? a : b;
    const h = k - Math.abs(a - b);
    if (h <= 0) return a < b ? a : b;
    return (a < b ? a : b) - (h * h) / (4 * k);
}

export function smax(a: number, b: number, k: number) {
    return -smin(-a, -b, k);
}

const ADD = 0;
const CARVE = 1;
const CLIP = 2;

/**
 * A shape authored for the left half (x >= 0) and reflected to the right,
 * so both sides are one evaluation.
 */
export function symmetric(source: Shape): Shape {
    return {
        desc: { type: "symmetric", source },
        eval: (x, y, z) => source.eval(x < 0 ? -x : x, y, z),
    };
}

export interface Step {
    kind: number;
    k: number;
    shape: Shape;
}

/** Extra reach when pruning, covering the approximate primitives. */
const PRUNE_SLACK = 1.35;
const PRUNE_PAD = 0.002;

export class Field implements Shape {
    /** The steps in order; `kind` is 0 add, 1 carve, 2 clip. */
    readonly steps: Step[] = [];
    /** Bounds of the value over the region this field was pruned for. */
    lo = -Infinity;
    hi = Infinity;

    /** Union with the shape, blended over `k` metres. */
    add(shape: Shape, k = 0) {
        this.steps.push({ kind: ADD, k, shape });
        return this;
    }

    /** Remove the shape. */
    carve(shape: Shape, k = 0) {
        this.steps.push({ kind: CARVE, k, shape });
        return this;
    }

    /** Keep only what lies inside the shape. */
    clip(shape: Shape, k = 0) {
        this.steps.push({ kind: CLIP, k, shape });
        return this;
    }

    get size() {
        return this.steps.length;
    }

    eval = (x: number, y: number, z: number): number => {
        const steps = this.steps;
        let d = Infinity;
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const v = step.shape.eval(x, y, z);
            if (step.kind === ADD) d = d === Infinity ? v : smin(d, v, step.k);
            else if (step.kind === CARVE) d = smax(d, -v, step.k);
            else d = smax(d, v, step.k);
        }
        return d;
    };

    prune = (x: number, y: number, z: number, radius: number): Field => {
        const reach = radius * PRUNE_SLACK + PRUNE_PAD;
        const out = new Field();
        let lo = Infinity;
        let hi = Infinity;
        for (const step of this.steps) {
            const v = step.shape.eval(x, y, z);
            const vlo = v - reach;
            const vhi = v + reach;
            const k = step.k;
            if (step.kind === ADD) {
                if (vlo >= hi + k) continue;
                if (vhi + k <= lo) out.steps.length = 0;
                lo = Math.min(lo, vlo) - k / 4;
                hi = Math.min(hi, vhi);
            } else if (step.kind === CARVE) {
                if (lo + vlo >= k) continue;
                lo = Math.max(lo, -vhi);
                hi = Math.max(hi, -vlo) + k / 4;
            } else {
                if (lo - vhi >= k) continue;
                lo = Math.max(lo, vlo);
                hi = Math.max(hi, vhi) + k / 4;
            }
            out.steps.push(
                step.shape.prune
                    ? { ...step, shape: step.shape.prune(x, y, z, radius) }
                    : step
            );
        }
        out.lo = lo;
        out.hi = hi;
        return out;
    };
}

export const field = () => new Field();

/** Gradient by tetrahedral differences; four evaluations. */
export function gradient(
    source: Shape,
    x: number,
    y: number,
    z: number,
    eps: number,
    out: [number, number, number]
) {
    const a = source.eval(x + eps, y - eps, z - eps);
    const b = source.eval(x - eps, y - eps, z + eps);
    const c = source.eval(x - eps, y + eps, z - eps);
    const d = source.eval(x + eps, y + eps, z + eps);
    out[0] = a - b - c + d;
    out[1] = -a - b + c + d;
    out[2] = -a + b - c + d;
    const s = 1 / (4 * eps);
    out[0] *= s;
    out[1] *= s;
    out[2] *= s;
    return out;
}

/** Move a point onto the surface of a shape along its gradient. */
export function project(
    source: Shape,
    p: [number, number, number],
    target = 0,
    iterations = 4,
    eps = 0.0008
) {
    const g: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < iterations; i++) {
        const d = source.eval(p[0], p[1], p[2]) - target;
        if (Math.abs(d) < 1e-5) break;
        gradient(source, p[0], p[1], p[2], eps, g);
        const l2 = g[0] * g[0] + g[1] * g[1] + g[2] * g[2];
        if (l2 < 1e-10) break;
        const s = d / l2;
        p[0] -= g[0] * s;
        p[1] -= g[1] * s;
        p[2] -= g[2] * s;
    }
    return p;
}
