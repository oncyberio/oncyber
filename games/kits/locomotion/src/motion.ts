// The lobby's walk, run and jump as pure logic: no renderer, no DOM.
// The step is the lobby's own (multiplayer/protocol/movement.js) with two
// additions a game needs: a scale for avatars that are not 1.8 m tall, and
// a `constrain` hook for the game's walls.
import { MOTION } from "./constants.ts";

/** One frame of controls, in the lobby's own terms. */
export interface MoveInput {
    /** -1 left … 1 right, relative to the camera. */
    strafe: number;
    /** -1 ahead (away from the camera) … 1 back toward it. */
    forward: number;
    /** The camera's yaw, radians. At 0 the camera sits on +z and looks down -z. */
    yaw: number;
    /** Run is held. */
    running: boolean;
    /** Jump is down this step. A second jump needs a release in between. */
    jump: boolean;
}

export interface WalkerState {
    /** Feet, in the game's units. `y` is height above the ground. */
    x: number;
    y: number;
    z: number;
    /** The body's heading, radians. At 0 it faces -z. */
    rotation: number;
    /** Velocity relative to the camera, in lobby metres per second. */
    vx: number;
    vz: number;
    vy: number;
    jumpHeld: boolean;
    jumpCount: number;
    /** Standing on the ground. */
    floor: boolean;
    /** Seconds simulated so far. */
    time: number;
}

export const STEP = MOTION.step;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const angle = (v: number) => Math.atan2(Math.sin(v), Math.cos(v));
const finite = (v: number) => (Number.isFinite(v) ? v : 0);

export function walkerState(p: Partial<WalkerState> = {}): WalkerState {
    return {
        x: p.x || 0,
        y: p.y || 0,
        z: p.z || 0,
        rotation: p.rotation || 0,
        vx: 0,
        vz: 0,
        vy: 0,
        jumpHeld: false,
        jumpCount: (p.y || 0) > 0 ? 1 : 0,
        floor: !(p.y && p.y > 0),
        time: 0,
    };
}

/** Ease the camera-relative velocity toward the input, as the lobby does. */
export function advanceVelocity(
    s: { vx: number; vz: number },
    strafe: number,
    forward: number,
    running: boolean,
    dt: number
) {
    dt = clamp(finite(dt), 0, MOTION.maxFrame);
    const moving = Math.abs(strafe) + Math.abs(forward) > MOTION.inputDeadzone;
    const length = Math.max(1, Math.hypot(strafe, forward));
    const target = running ? MOTION.runSpeed : MOTION.walkSpeed;
    const previous = Math.hypot(s.vx, s.vz);
    const ease =
        1 - Math.exp(-(moving ? MOTION.steerRate : MOTION.brakeRate) * dt);
    s.vx += ((strafe / length) * target - s.vx) * ease;
    s.vz += ((forward / length) * target - s.vz) * ease;
    const speed = Math.hypot(s.vx, s.vz);
    const maximum = previous + MOTION.acceleration * dt;
    if (moving && speed > maximum) {
        s.vx *= maximum / speed;
        s.vz *= maximum / speed;
    }
    if (!moving && speed < MOTION.restSpeed) s.vx = s.vz = 0;
}

/** Advance one step of at most STEP seconds. `scale` is game units per lobby metre. */
export function stepWalker(
    s: WalkerState,
    i: MoveInput,
    dt: number = STEP,
    scale = 1
): WalkerState {
    dt = clamp(finite(dt), 0, STEP);
    const yaw = finite(i.yaw);
    advanceVelocity(
        s,
        clamp(finite(i.strafe), -1, 1),
        clamp(finite(i.forward), -1, 1),
        !!i.running,
        dt
    );
    if (!s.y && s.vy <= 0) s.jumpCount = 0;
    if (i.jump && !s.jumpHeld && s.jumpCount < MOTION.maxJumps) {
        s.vy = MOTION.jumpSpeed;
        s.jumpCount++;
    }
    s.jumpHeld = !!i.jump;
    if (s.y > 0 || s.vy > 0) {
        s.vy -= MOTION.gravity * dt;
        s.y = Math.max(0, s.y + s.vy * dt * scale);
        if (!s.y) {
            s.vy = 0;
            s.jumpCount = 0;
        }
    }
    const dx = Math.cos(yaw) * s.vx + Math.sin(yaw) * s.vz;
    const dz = -Math.sin(yaw) * s.vx + Math.cos(yaw) * s.vz;
    s.x += dx * dt * scale;
    s.z += dz * dt * scale;
    if (Math.hypot(dx, dz) > MOTION.faceMinSpeed)
        s.rotation = angle(
            s.rotation +
                angle(yaw + Math.atan2(-s.vx, -s.vz) - s.rotation) *
                    (1 - Math.exp(-MOTION.faceRate * dt))
        );
    s.floor = s.y === 0;
    s.time += dt;
    return s;
}

export interface WalkerOptions {
    /** Game units per lobby metre: the avatar's height in the game / 1.8. */
    scale?: number;
    /** Keep the walker inside the game's walls: adjust `state.x` and `state.z`. */
    constrain?(state: WalkerState): void;
}

export interface Walker {
    /** The simulated state, at whole steps. Checks read this. */
    readonly state: WalkerState;
    scale: number;
    /** Run the frame's seconds in fixed steps; returns the pose to draw. */
    advance(seconds: number, input: MoveInput): WalkerState;
    /** Put the walker somewhere, at rest. */
    place(pose: Partial<WalkerState>): void;
    /** Where and when the walker last stood still, so a check can time a
     * walk from rest exactly. */
    readonly rest: { x: number; z: number; time: number };
    /** Ground speed in lobby metres per second, for picking a gait. */
    speed(): number;
    /** World velocity in game units per second. */
    velocity(yaw: number): { x: number; z: number };
}

/** A walker the game advances once per frame. The host owns the clock. */
export function createWalker(
    start: Partial<WalkerState> = {},
    options: WalkerOptions = {}
): Walker {
    let state = walkerState(start);
    let accumulator = 0;
    let rest = { x: state.x, z: state.z, time: state.time };
    const walker: Walker = {
        get rest() {
            return rest;
        },
        get state() {
            return state;
        },
        scale: options.scale && options.scale > 0 ? options.scale : 1,
        advance(seconds, input) {
            accumulator = Math.min(
                MOTION.maxFrame,
                accumulator + Math.max(0, finite(seconds))
            );
            while (accumulator + 1e-9 >= STEP) {
                accumulator -= STEP;
                stepWalker(state, input, STEP, walker.scale);
                options.constrain?.(state);
                if (!state.vx && !state.vz)
                    rest = { x: state.x, z: state.z, time: state.time };
            }
            // Draw the part of a step that has not been simulated yet.
            const shown = stepWalker(
                { ...state },
                input,
                accumulator,
                walker.scale
            );
            options.constrain?.(shown);
            return shown;
        },
        place(pose) {
            const time = state.time;
            state = walkerState({ ...state, ...pose });
            // The clock only runs forward, so a check can time across a move.
            state.time = time;
            rest = { x: state.x, z: state.z, time };
            accumulator = 0;
        },
        speed: () => Math.hypot(state.vx, state.vz),
        velocity: (yaw) => ({
            x:
                (Math.cos(yaw) * state.vx + Math.sin(yaw) * state.vz) *
                walker.scale,
            z:
                (-Math.sin(yaw) * state.vx + Math.cos(yaw) * state.vz) *
                walker.scale,
        }),
    };
    return walker;
}

/** Ground covered from rest with forward held for `seconds`, in lobby metres. */
export function distanceFromRest(seconds: number, running = false): number {
    const s = walkerState();
    const steps = Math.round(seconds / STEP);
    for (let n = 0; n < steps; n++)
        stepWalker(s, { strafe: 0, forward: -1, yaw: 0, running, jump: false });
    return Math.hypot(s.x, s.z);
}
