"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAY_LIMITS = void 0;
exports.readPlayRecipe = readPlayRecipe;
exports.playBodies = playBodies;
exports.encodeBodies = encodeBodies;
exports.decodeBodies = decodeBodies;
exports.encodePeople = encodePeople;
exports.decodePeople = decodePeople;

// A play zone is a small walled area where the server runs rigid-body
// physics for a short game: things fall, people push and hit them, and a
// rule keeps score. A recipe describes one game from a fixed set of parts.
// Nothing in a recipe is code: both sides read it with readPlayRecipe, which
// clamps every number, so a recipe from a prompt or a stranger is safe to run.

/** Budgets a recipe is clamped to. The server cost was measured at about 2 ms a step for 500 balls and 32 people. */
const PLAY_LIMITS = Object.freeze({
    bodies: 400,
    people: 32,
    seconds: [5, 180],
    half: [3, 15],
    size: [0.1, 1.5],
    gravity: [1, 25],
    /** Bodies in one frame: 12 bytes each under a 1200 byte datagram. */
    frameBodies: 96,
});
exports.PLAY_LIMITS = PLAY_LIMITS;

const KINDS = ["ball", "box"];
const DROPS = ["rain", "center", "sides"];
const SCORES = ["none", "side-count", "floor-touch"];
/** Positions travel as centimetres from the zone's centre in 16 bits: +-327 m. */
const UNIT = 100;
const QUAT_RANGE = Math.SQRT1_2;

const number = (value, [low, high], fallback) => (typeof value === "number" && Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : fallback);
const pick = (value, list, fallback) => (list.includes(value) ? value : fallback);

/** A recipe with every field present and inside its limits, or null when it describes nothing to play. */
function readPlayRecipe(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const input = value;
    const arena = input.arena && typeof input.arena === "object" ? input.arena : {};
    const things = [];
    let left = PLAY_LIMITS.bodies;
    for (const thing of Array.isArray(input.things) ? input.things.slice(0, 8) : []) {
        if (!thing || typeof thing !== "object" || left <= 0) continue;
        const count = Math.min(left, Math.floor(number(thing.count, [0, PLAY_LIMITS.bodies], 0)));
        if (count < 1) continue;
        left -= count;
        things.push({
            kind: pick(thing.kind, KINDS, "ball"),
            count,
            size: number(thing.size, PLAY_LIMITS.size, 0.2),
            bounce: number(thing.bounce, [0, 1], 0.5),
            weight: number(thing.weight, [0.05, 5], 0.4),
            drop: pick(thing.drop, DROPS, "rain"),
            color: Math.floor(number(thing.color, [0, 7], 0)),
        });
    }
    if (!things.length) return null;
    const hit = input.hit && typeof input.hit === "object" ? { reach: number(input.hit.reach, [0.5, 3], 1.4), power: number(input.hit.power, [1, 30], 6), lift: number(input.hit.lift, [0, 1], 0.5) } : null;
    const net = typeof arena.net === "number" && arena.net > 0 ? number(arena.net, [0.5, 3], 1.5) : 0;
    return {
        title:
            typeof input.title === "string"
                ? input.title
                      .replace(/[\u0000-\u001f]/g, " ")
                      .trim()
                      .slice(0, 60)
                : "",
        seconds: Math.round(number(input.seconds, PLAY_LIMITS.seconds, 60)),
        gravity: number(input.gravity, PLAY_LIMITS.gravity, 9.81),
        arena: { halfX: number(arena.halfX, PLAY_LIMITS.half, 8), halfZ: number(arena.halfZ, PLAY_LIMITS.half, 8), walls: arena.walls !== false, net },
        things,
        hit,
        score: pick(input.score, SCORES, "none"),
    };
}

/** One entry per body, in the order both sides number them. */
function playBodies(recipe) {
    const bodies = [];
    for (const thing of recipe.things) for (let i = 0; i < thing.count; i++) bodies.push({ kind: thing.kind, size: thing.size, color: thing.color });
    return bodies;
}

const int16 = (value) => Math.max(-32768, Math.min(32767, Math.round(value * UNIT)));

/** A unit quaternion in 32 bits: which component is largest, and the other three in 10 bits each. */
function packQuat(x, y, z, w) {
    const q = [x, y, z, w];
    let largest = 0;
    for (let i = 1; i < 4; i++) if (Math.abs(q[i]) > Math.abs(q[largest])) largest = i;
    const sign = q[largest] < 0 ? -1 : 1;
    let packed = largest;
    for (let i = 0, shift = 2; i < 4; i++) {
        if (i === largest) continue;
        const unit = Math.max(0, Math.min(1, (q[i] * sign) / QUAT_RANGE / 2 + 0.5));
        packed |= Math.round(unit * 1023) << shift;
        shift += 10;
    }
    return packed >>> 0;
}
function unpackQuat(packed, out, at) {
    const largest = packed & 3;
    let sum = 0;
    for (let i = 0, shift = 2; i < 4; i++) {
        if (i === largest) continue;
        const value = (((packed >>> shift) & 1023) / 1023 - 0.5) * 2 * QUAT_RANGE;
        out[at + i] = value;
        sum += value * value;
        shift += 10;
    }
    out[at + largest] = Math.sqrt(Math.max(0, 1 - sum));
}

/**
 * Frames of body poses: [1, tick u32, count u16] then 12 bytes a body
 * (index u16, x y z i16 in centimetres, rotation u32). `poses` holds seven
 * numbers a body (x y z, then the quaternion x y z w).
 */
function encodeBodies(tick, indices, poses, perFrame = PLAY_LIMITS.frameBodies) {
    const frames = [];
    for (let start = 0; start < indices.length; start += perFrame) {
        const count = Math.min(perFrame, indices.length - start);
        const bytes = new Uint8Array(7 + count * 12),
            view = new DataView(bytes.buffer);
        view.setUint8(0, 1);
        view.setUint32(1, tick >>> 0, true);
        view.setUint16(5, count, true);
        for (let i = 0; i < count; i++) {
            const index = indices[start + i],
                p = index * 7,
                at = 7 + i * 12;
            view.setUint16(at, index, true);
            view.setInt16(at + 2, int16(poses[p]), true);
            view.setInt16(at + 4, int16(poses[p + 1]), true);
            view.setInt16(at + 6, int16(poses[p + 2]), true);
            view.setUint32(at + 8, packQuat(poses[p + 3], poses[p + 4], poses[p + 5], poses[p + 6]), true);
        }
        frames.push(bytes);
    }
    return frames;
}

/** Reads one body frame into `poses` and returns its tick and the indices it carried, or null for anything else. */
function decodeBodies(bytes, poses) {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength < 7 || bytes[0] !== 1) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const count = view.getUint16(5, true);
    if (bytes.byteLength !== 7 + count * 12) return null;
    const indices = [];
    for (let i = 0; i < count; i++) {
        const at = 7 + i * 12,
            index = view.getUint16(at, true),
            p = index * 7;
        if (p + 7 > poses.length) continue;
        poses[p] = view.getInt16(at + 2, true) / UNIT;
        poses[p + 1] = view.getInt16(at + 4, true) / UNIT;
        poses[p + 2] = view.getInt16(at + 6, true) / UNIT;
        unpackQuat(view.getUint32(at + 8, true), poses, p + 3);
        indices.push(index);
    }
    return { tick: view.getUint32(1, true), indices };
}

/** People in the zone: [2, tick u32, count u8] then 9 bytes each (id u16, x y z i16, facing u8). */
function encodePeople(tick, people) {
    const count = Math.min(255, people.length);
    const bytes = new Uint8Array(6 + count * 9),
        view = new DataView(bytes.buffer);
    view.setUint8(0, 2);
    view.setUint32(1, tick >>> 0, true);
    view.setUint8(5, count);
    for (let i = 0; i < count; i++) {
        const person = people[i],
            at = 6 + i * 9,
            turn = ((person.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        view.setUint16(at, person.id & 0xffff, true);
        view.setInt16(at + 2, int16(person.x), true);
        view.setInt16(at + 4, int16(person.y), true);
        view.setInt16(at + 6, int16(person.z), true);
        view.setUint8(at + 8, Math.round((turn / (Math.PI * 2)) * 255) & 255);
    }
    return bytes;
}
function decodePeople(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength < 6 || bytes[0] !== 2) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const count = view.getUint8(5);
    if (bytes.byteLength !== 6 + count * 9) return null;
    const people = [];
    for (let i = 0; i < count; i++) {
        const at = 6 + i * 9;
        people.push({ id: view.getUint16(at, true), x: view.getInt16(at + 2, true) / UNIT, y: view.getInt16(at + 4, true) / UNIT, z: view.getInt16(at + 6, true) / UNIT, yaw: (view.getUint8(at + 8) / 255) * Math.PI * 2 });
    }
    return { tick: view.getUint32(1, true), people };
}
