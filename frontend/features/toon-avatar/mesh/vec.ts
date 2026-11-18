/** Tiny vector helpers on plain tuples, so mesh code runs without three.js. */
export type Vec3 = [number, number, number];

export const v3 = (x = 0, y = 0, z = 0): Vec3 => [x, y, z];
export const add = (a: Vec3, b: Vec3): Vec3 => [
    a[0] + b[0],
    a[1] + b[1],
    a[2] + b[2],
];
export const sub = (a: Vec3, b: Vec3): Vec3 => [
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2],
];
export const scale = (a: Vec3, s: number): Vec3 => [
    a[0] * s,
    a[1] * s,
    a[2] * s,
];
/** a + b * s */
export const addScaled = (a: Vec3, b: Vec3, s: number): Vec3 => [
    a[0] + b[0] * s,
    a[1] + b[1] * s,
    a[2] + b[2] * s,
];
export const dot = (a: Vec3, b: Vec3) =>
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const normalize = (a: Vec3): Vec3 => {
    const l = length(a);
    return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 1, 0];
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (x: number, lo = 0, hi = 1) =>
    Math.min(hi, Math.max(lo, x));
export const smoothstep = (e0: number, e1: number, x: number) => {
    const t = clamp((x - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
};

/** Any unit vector perpendicular to `axis`. */
export function perpendicular(axis: Vec3): Vec3 {
    const other: Vec3 = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    return normalize(cross(other, axis));
}

/** Piecewise-smooth 1D curve through `[x, y]` keys (monotone in x). */
export function curve(keys: [number, number][], x: number): number {
    if (x <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
        if (x <= keys[i][0]) {
            const [x0, y0] = keys[i - 1];
            const [x1, y1] = keys[i];
            return lerp(y0, y1, smoothstep(x0, x1, x));
        }
    }
    return keys[keys.length - 1][1];
}

/** Deterministic 0..1 pseudo-random from an integer seed (mulberry32). */
export function seededRandom(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
