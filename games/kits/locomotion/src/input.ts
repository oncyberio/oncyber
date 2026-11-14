// The lobby's actions as pure functions: which keys, how a touch stick and
// a gamepad turn into the same strafe / forward / run / jump. No DOM here;
// controls.ts binds these to a page.
import { CAMERA, GAMEPAD, KEYS, MOTION, TOUCH } from "./constants.ts";

const any = (keys: ReadonlySet<string>, codes: readonly string[]) =>
    codes.some((code) => keys.has(code));
const frame = (dt: number) =>
    Number.isFinite(dt) ? Math.max(0, Math.min(dt, MOTION.maxFrame)) : 0;

/** Held keys (KeyboardEvent.code) to movement. Arrows steer; A and D strafe. */
export function readKeys(keys: ReadonlySet<string>, dt: number) {
    return {
        strafe: Number(any(keys, KEYS.right)) - Number(any(keys, KEYS.left)),
        forward: Number(any(keys, KEYS.back)) - Number(any(keys, KEYS.forward)),
        /** Radians to turn the view this frame; positive turns left. */
        turn:
            (Number(any(keys, KEYS.turnLeft)) -
                Number(any(keys, KEYS.turnRight))) *
            CAMERA.keyTurnRate *
            frame(dt),
        running: any(keys, KEYS.run),
    };
}

/** Every code the kit acts on, so a page can stop them scrolling. */
export const MOVE_CODES: ReadonlySet<string> = new Set([
    ...KEYS.forward,
    ...KEYS.back,
    ...KEYS.left,
    ...KEYS.right,
    ...KEYS.turnLeft,
    ...KEYS.turnRight,
]);

/** A key event's code, for keyboards and remotes that only send `key`. */
export function keyCode(event: { code?: string; key?: string }): string {
    if (event.code) return event.code;
    const key = event.key ?? "";
    if (key === " " || key === "Spacebar") return "Space";
    if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
    if (key === "Shift") return "ShiftLeft";
    return key;
}

/** Keeps a short tap, and the release between two jumps, across 60 Hz steps. */
export function createJumpInput() {
    let queued = 0,
        pressed = false,
        remaining = 0;
    return {
        /** Call once per press (not on key repeat). */
        queue() {
            queued = Math.min(MOTION.maxJumps, queued + 1);
        },
        /** Whether jump is down for this frame. */
        read(dt: number) {
            if (remaining <= 1e-9) {
                if (pressed) {
                    pressed = false;
                    remaining = MOTION.step;
                } else if (queued) {
                    queued--;
                    pressed = true;
                    remaining = MOTION.step;
                }
            }
            const jump = pressed;
            remaining -= Number.isFinite(dt) ? Math.max(0, dt) : 0;
            return jump;
        },
        clear() {
            queued = remaining = 0;
            pressed = false;
        },
    };
}

/** A touch stick: pixels from its centre to { strafe, forward }, at most length 1. */
export function stickVector(
    dx: number,
    dy: number,
    radius: number = TOUCH.stickRadius
) {
    let strafe = dx / radius,
        forward = dy / radius;
    const length = Math.hypot(strafe, forward);
    if (length > 1) {
        strafe /= length;
        forward /= length;
    }
    return { strafe, forward };
}

export interface PadLike {
    axes: readonly number[];
    buttons: readonly { pressed: boolean }[];
}

/** A standard-mapping gamepad: left stick moves, right stick looks, A jumps,
 * left stick press or right trigger runs. */
export function readGamepad(pad: PadLike | null | undefined, dt: number) {
    const none = {
        strafe: 0,
        forward: 0,
        lookYaw: 0,
        lookPitch: 0,
        running: false,
        jump: false,
    };
    if (!pad) return none;
    const stick = ([a, b]: readonly number[]) => {
        const x = pad.axes[a] || 0,
            y = pad.axes[b] || 0,
            length = Math.hypot(x, y);
        if (length < GAMEPAD.deadzone) return [0, 0];
        return length > 1 ? [x / length, y / length] : [x, y];
    };
    const [strafe, forward] = stick(GAMEPAD.moveAxes);
    const [lookX, lookY] = stick(GAMEPAD.lookAxes);
    const down = (index: number) => !!pad.buttons[index]?.pressed;
    return {
        strafe,
        forward,
        /** Radians to add to the view's yaw and pitch this frame. */
        lookYaw: 0 - lookX * GAMEPAD.lookYawRate * frame(dt),
        lookPitch: 0 - lookY * GAMEPAD.lookPitchRate * frame(dt),
        running: GAMEPAD.runButtons.some(down),
        jump: down(GAMEPAD.jumpButton),
    };
}
