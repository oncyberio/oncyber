// The shape of the world as plain functions: the main island (beach, hills,
// a cliff plateau with a waterfall into the pond) and two small islets for the
// mini games. Shared by the mesh builder, the water shader's depth texture,
// movement and the bloomlings' brains.

export const WATER = 0;
export const UPPER_WATER = 8.15;
export const POND = { x: 0, z: -11, r: 8.6 };
export const PLATEAU = { x: 0, z: -30, rx: 22, rz: 10, h: 8.6 };
export const FALLS = { x: 0, z: -20.6, top: UPPER_WATER, width: 3.6 };
export const CAVE = { x: -11.5, z: -20.6 };
export const SPAWN = { x: 0, z: 13, heading: Math.PI };
export const RACE_ISLE = { x: 175, z: 0, r: 30 };
export const DOJO_ISLE = { x: -165, z: 0, r: 22 };
export const RACE_GATE = { x: 31, z: 6 };
export const HUT = { x: -21, z: 9 };
export const NEST = { x: -17.6, z: 13.4 };
export const ISLAND_RADIUS = 40;

// Small smooth value noise, deterministic, good enough for gentle terrain.
const P = new Uint8Array(512);
{
    let s = 1337;
    const perm = [...Array(256).keys()];
    for (let i = 255; i > 0; i--) {
        s = (s * 16807) % 2147483647;
        const j = s % (i + 1);
        [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
}
const fade = (t) => t * t * (3 - 2 * t);
const grad = (h) => (h / 255) * 2 - 1;
export function noise2(x, z) {
    const xi = Math.floor(x);
    const zi = Math.floor(z);
    const xf = fade(x - xi);
    const zf = fade(z - zi);
    const a = P[(xi & 255) + P[zi & 255]];
    const b = P[((xi + 1) & 255) + P[zi & 255]];
    const c = P[(xi & 255) + P[(zi + 1) & 255]];
    const d = P[((xi + 1) & 255) + P[(zi + 1) & 255]];
    const top = grad(a) + (grad(b) - grad(a)) * xf;
    const bot = grad(c) + (grad(d) - grad(c)) * xf;
    return top + (bot - top) * zf;
}

export const smoothstep = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

/** Shoreline distance from the centre at an angle (a wobbly circle). */
export function shoreAt(angle) {
    return (
        ISLAND_RADIUS +
        2.6 * Math.sin(3 * angle + 1.1) +
        1.6 * Math.sin(5 * angle + 2.3) +
        0.8 * Math.sin(9 * angle)
    );
}

function islet(x, z, isle, top) {
    const d = Math.hypot(x - isle.x, z - isle.z);
    const ang = Math.atan2(z - isle.z, x - isle.x);
    const r = isle.r + 1.5 * Math.sin(4 * ang + 0.7);
    const land = 1 - smoothstep(r - 5, r + 2, d);
    return mix(-4, top + noise2(x * 0.12, z * 0.12) * 0.25, land);
}

/** Ground height everywhere in the world. */
export function heightAt(x, z) {
    if (x > 110) return islet(x, z, RACE_ISLE, 0.8);
    if (x < -110) return islet(x, z, DOJO_ISLE, 0.9);
    const r = Math.hypot(x, z);
    const shore = shoreAt(Math.atan2(z, x));
    const land = 1 - smoothstep(shore - 7, shore + 3, r);
    let h = mix(-4.5, 1.0, land);
    h +=
        land *
        noise2(x * 0.08, z * 0.08) * 0.45;
    // Rolling hills.
    h += 1.7 * Math.exp(-((x - 17) ** 2 + (z - 6) ** 2) / 50) * land;
    h += 1.3 * Math.exp(-((x + 19) ** 2 + (z - 2) ** 2) / 40) * land;
    h += 0.7 * Math.exp(-((x - 7) ** 2 + (z - 24) ** 2) / 30) * land;
    // The cliff plateau.
    const e =
        ((x - PLATEAU.x) / PLATEAU.rx) ** 2 +
        ((z - PLATEAU.z) / PLATEAU.rz) ** 2;
    const p = 1 - smoothstep(0.8, 1.0, e);
    h = mix(h, PLATEAU.h + noise2(x * 0.15, z * 0.15) * 0.35, p);
    // Upper basin and the channel that feeds the falls.
    const basin = 1 - smoothstep(2.4, 3.6, Math.hypot(x, z + 27));
    const channel =
        (1 - smoothstep(0.9, 1.6, Math.abs(x))) *
        smoothstep(-28, -26, z) *
        (1 - smoothstep(-20.8, -20.2, z));
    h = mix(h, 7.4, Math.max(basin, channel) * p);
    // The pond.
    const dp = Math.hypot(x - POND.x, z - POND.z);
    h = mix(h, -1.5, 1 - smoothstep(POND.r - 3.5, POND.r + 0.4, dp));
    // Plunge pool: the pond reaches the foot of the falls, so the water drops
    // straight into it (only in front of the cliff face).
    const plunge =
        (1 - smoothstep(1.8, 3.4, Math.hypot(x - FALLS.x, z + 19.2))) *
        smoothstep(-20.95, -20.6, z);
    h = mix(h, -1.2, plunge);
    return h;
}

/** Surface slope (rise per metre), for colouring and walkability. */
export function slopeAt(x, z) {
    const e = 0.5;
    const dx = heightAt(x + e, z) - heightAt(x - e, z);
    const dz = heightAt(x, z + e) - heightAt(x, z - e);
    return Math.hypot(dx, dz) / (2 * e);
}

export function inPond(x, z) {
    return Math.hypot(x - POND.x, z - POND.z) < POND.r;
}

/** Water surface above a point, or -Infinity where it's dry land. */
export function waterAt(x, z) {
    const g = heightAt(x, z);
    if (g > UPPER_WATER - 0.2 && g < UPPER_WATER) return UPPER_WATER;
    return g < WATER ? WATER : -Infinity;
}

/** Where a walker may stand: not too deep, not up a cliff. */
export function walkable(x, z) {
    return heightAt(x, z) > -0.9;
}
