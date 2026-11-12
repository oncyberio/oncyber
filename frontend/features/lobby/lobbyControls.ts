import { STEP } from "../../../multiplayer/protocol/movement";

/** Match the native controls: arrows steer, while A/D strafe. */
export function readLobbyKeyboard(keys: Set<string>, dt: number) {
    return {
        strafe: Number(keys.has("KeyD")) - Number(keys.has("KeyA")),
        forward:
            Number(keys.has("KeyS") || keys.has("ArrowDown")) -
            Number(keys.has("KeyW") || keys.has("ArrowUp")),
        turn:
            (Number(keys.has("ArrowLeft")) - Number(keys.has("ArrowRight"))) *
            (Math.PI / 2) *
            (Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0),
    };
}

export function lobbyKeyCode(event: Pick<KeyboardEvent, "code" | "key">) {
    if (event.code) return event.code;
    if (event.key === " " || event.key === "Spacebar") return "Space";
    if (/^[a-z]$/i.test(event.key)) return `Key${event.key.toUpperCase()}`;
    if (/^[1-9]$/.test(event.key)) return `Digit${event.key}`;
    if (event.key === "Shift") return "ShiftLeft";
    return event.key;
}

/** Preserve short taps and a release between jumps across 60 Hz simulation ticks. */
export function createLobbyJumpInput() {
    let queued = 0;
    let pressed = false;
    let remaining = 0;
    return {
        queue() {
            queued = Math.min(2, queued + 1);
        },
        read(dt: number) {
            if (remaining <= 1e-9) {
                if (pressed) {
                    pressed = false;
                    remaining = STEP;
                } else if (queued) {
                    queued--;
                    pressed = true;
                    remaining = STEP;
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
        get pending() {
            return queued > 0 || pressed;
        },
    };
}
