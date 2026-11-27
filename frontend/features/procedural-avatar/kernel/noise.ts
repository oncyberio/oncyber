/** Deterministic random numbers and smooth noise for procedural detail. */

export function mulberry(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function hash(x: number, y: number, z: number) {
    let h =
        Math.imul(x, 374761393) ^
        Math.imul(y, 668265263) ^
        Math.imul(z, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const fade = (t: number) => t * t * (3 - 2 * t);

/** Value noise in [0, 1]. */
export function noise3(x: number, y: number, z: number) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const u = fade(x - xi);
    const v = fade(y - yi);
    const w = fade(z - zi);
    const mix = (a: number, b: number, t: number) => a + (b - a) * t;
    return mix(
        mix(
            mix(hash(xi, yi, zi), hash(xi + 1, yi, zi), u),
            mix(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u),
            v
        ),
        mix(
            mix(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u),
            mix(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u),
            v
        ),
        w
    );
}

/** Fractal noise in roughly [0, 1]. */
export function fbm(x: number, y: number, z: number, octaves = 3) {
    let sum = 0;
    let amp = 0.5;
    let total = 0;
    for (let i = 0; i < octaves; i++) {
        sum += noise3(x, y, z) * amp;
        total += amp;
        x = x * 2.03 + 17.1;
        y = y * 2.03 + 5.3;
        z = z * 2.03 + 9.7;
        amp *= 0.5;
    }
    return sum / total;
}

export const smoothstep = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
