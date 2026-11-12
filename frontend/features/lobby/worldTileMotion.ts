/** Shared 3D tile choreography for native spaces and the development preview. */
export const WORLD_TILE_REVEAL_MS = 1000;
/** Arriving travellers start standing up once the reveal has assembled every
 * cell within this many metres of the anchor (party formations included). */
export const WORLD_STAND_UP_FLOOR_RADIUS_M = 3;
/**
 * The reveal progress at which arrival's stand-up and camera settle begin:
 * late enough that they end together with the reveal (the latest start that
 * still saves their whole duration), and never before the nearby floor has
 * assembled. Input stays held until both have finished.
 */
export function worldStandUpProgress(floorReady: number, handoffMs: number) {
    const endsWithReveal =
        1 - Math.max(0, Number(handoffMs) || 0) / WORLD_TILE_REVEAL_MS;
    const floor = Number.isFinite(floorReady) ? floorReady : 1;
    return Math.min(1, Math.max(0, floor, endsWithReveal));
}
export const WORLD_TILE_SPAN = 0.28;
export const WORLD_TILE_MAX_DELAY = 1 - WORLD_TILE_SPAN;
const CHARGE_END = 0.18;
const SETTLE_START = 0.84;
type Point = { x: number; y: number; z: number };
export interface WorldCellMotionInput {
    center: Point;
    anchor: Point;
    delay: number;
    cellSize: number;
    seed: number;
    mode?: "reveal" | "dissolve";
    /** Area-weighted absolute surface normal; choose a turn within its plane. */
    surfaceNormal?: Point;
}
export interface WorldCellMotion {
    offset: Point;
    rotation: Point;
    scale: number;
    glow: number;
    visible: boolean;
    phase:
        | "hidden"
        | "charge"
        | "assemble"
        | "settle"
        | "dissolve"
        | "complete";
}
const finite = (value: number, fallback = 0) =>
    Number.isFinite(value) ? value : fallback;
const clamp = (value: number) => Math.max(0, Math.min(1, finite(value)));
const smooth = (value: number) => {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
};
const random = (seed: number) => {
    const number = finite(seed),
        integer = Math.floor(number);
    let value =
        Math.imul(integer, 0x9e3779b1) ^
        Math.floor((number - integer) * 4294967296);
    value = Math.imul(value ^ 0x9e3779b9, 0x85ebca6b);
    value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
};

/** Compact, overlapping turns retain the source surface at completion. All
 * offsets are real world metres; no screen mask or surface overlay is involved. */
export function sampleWorldCell(
    progress: number,
    input: WorldCellMotionInput,
    out: WorldCellMotion = {
        offset: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1,
        glow: 0,
        visible: true,
        phase: "complete",
    }
): WorldCellMotion {
    const p = clamp(progress);
    const delay = Math.max(
        0,
        Math.min(WORLD_TILE_MAX_DELAY, finite(input.delay))
    );
    const phase = clamp((p - delay) / WORLD_TILE_SPAN);
    const local = p === 1 ? 1 : phase;
    out.offset.x = out.offset.y = out.offset.z = 0;
    out.rotation.x = out.rotation.y = out.rotation.z = 0;
    out.scale = 1;
    out.glow = 0;
    out.visible = true;
    out.phase = "complete";
    // A wall must fold around a tangent, not spin like a diamond in its plane.
    // Absolute area weights also work when a cell contains opposite-facing walls.
    const nx = Math.abs(finite(input.surfaceNormal?.x));
    const ny = Math.abs(finite(input.surfaceNormal?.y));
    const nz = Math.abs(finite(input.surfaceNormal?.z));
    const secondAxis = random(input.seed + 43) >= 0.5;
    const axis =
        !input.surfaceNormal || (ny >= nx && ny >= nz)
            ? secondAxis
                ? "z"
                : "x"
            : nx >= nz
            ? secondAxis
                ? "z"
                : "y"
            : secondAxis
            ? "y"
            : "x";
    if (input.mode === "dissolve") {
        // Depart in place with one quiet flip. Arrival's charging lift, lateral
        // drift and settling bounce should not play backwards on the way out.
        if (p === 0 || phase <= 0) return out;
        if (p === 1 || phase >= 1) {
            out.scale = 0;
            out.visible = false;
            out.phase = "hidden";
            return out;
        }
        const sign = random(input.seed) < 0.5 ? -1 : 1;
        out.rotation[axis] = sign * (Math.PI / 2) * smooth(phase);
        out.phase = "dissolve";
        return out;
    }
    if (local >= 1) return out;
    if (local <= 0) {
        out.scale = 0;
        out.visible = false;
        out.phase = "hidden";
        return out;
    }
    const size = Math.max(0.05, Math.min(8, finite(input.cellSize, 0.5)));
    const variation = random(input.seed),
        sign = variation < 0.5 ? -1 : 1;
    let dx = finite(input.center.x) - finite(input.anchor.x);
    let dz = finite(input.center.z) - finite(input.anchor.z);
    const distance = Math.hypot(dx, dz);
    if (distance > 1e-6) {
        dx /= distance;
        dz /= distance;
    } else {
        const angle = variation * Math.PI * 2;
        dx = Math.cos(angle);
        dz = Math.sin(angle);
    }
    const side = (random(input.seed + 17) - 0.5) * 0.16;
    // Travel stays centimetre-sized even for coarse distant cells: small rooms
    // should assemble in place rather than throw wall panels through the camera.
    const travel = Math.min(size * 0.22, 0.04);
    const lift = Math.min(size * 0.18, 0.04);
    const startX = travel * (dx - dz * side);
    const startZ = travel * (dz + dx * side);
    const quarterTurn = (sign * Math.PI) / 2;
    if (local < CHARGE_END) {
        out.phase = "charge";
        out.scale = smooth(local / CHARGE_END);
        out.glow = smooth(local / CHARGE_END);
        out.offset.x = startX;
        out.offset.y = lift;
        out.offset.z = startZ;
        out.rotation[axis] = quarterTurn;
        return out;
    }
    if (local < SETTLE_START) {
        out.phase = "assemble";
        const t = (local - CHARGE_END) / (SETTLE_START - CHARGE_END);
        const ease = smooth(t),
            remaining = 1 - ease;
        out.offset.x = startX * remaining;
        out.offset.z = startZ * remaining;
        out.offset.y =
            lift * remaining +
            Math.min(size * 0.22, 0.04) * Math.sin(Math.PI * ease);
        out.rotation[axis] = quarterTurn * remaining;
        out.glow = 1 - smooth((local - CHARGE_END) / 0.52);
        return out;
    }
    out.phase = "settle";
    const t = (local - SETTLE_START) / (1 - SETTLE_START);
    const settle = Math.sin(Math.PI * t) ** 2;
    out.offset.y = -Math.min(size * 0.018, 0.008) * settle;
    out.rotation[axis] = -sign * 0.025 * settle;
    return out;
}
