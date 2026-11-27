// Binds the lobby's actions to a page: keys, a drag or wheel on the view, an
// optional touch stick, and the first connected gamepad. Browser only.
import {
    dragLook,
    turnLook,
    updateCamera,
    wheelLook,
    type FollowCamera,
} from "./camera.ts";
import {
    createJumpInput,
    keyCode,
    MOVE_CODES,
    readGamepad,
    readKeys,
    stickVector,
} from "./input.ts";
import { KEYS } from "./constants.ts";
import type { MoveInput } from "./motion.ts";

export interface ControlsOptions {
    /** The element the visitor drags to look around: usually the canvas. */
    view: HTMLElement;
    camera: FollowCamera;
    /** A fixed touch stick, if the game shows one. Games with a stick of
     * their own call `setStick` instead. */
    stick?: HTMLElement;
    /** Return false while the visitor is not walking (a menu, a match). */
    enabled?(): boolean;
    /** Return false for a pointer that should not look (one on a stick). */
    acceptLook?(event: PointerEvent): boolean;
}

export interface Controls {
    /** Once per frame: steers and eases the camera, then returns the frame's
     * movement relative to it. */
    read(seconds: number): MoveInput;
    /** Tilt of the game's own touch stick: right and down are positive. */
    setStick(strafe: number, forward: number): void;
    /** Point the controls at another camera (after `arrival`). */
    setCamera(camera: FollowCamera): void;
    clear(): void;
    dispose(): void;
}

const editing = (target: EventTarget | null) =>
    typeof Element !== "undefined" &&
    target instanceof Element &&
    !!target.closest(
        "input, textarea, select, [contenteditable]:not([contenteditable=false]), [role=textbox]"
    );

export function bindControls(options: ControlsOptions): Controls {
    const { view, stick } = options;
    let camera = options.camera;
    const enabled = () => options.enabled?.() !== false;
    const keys = new Set<string>();
    const jump = createJumpInput();
    const touch = { strafe: 0, forward: 0 };
    let drag: { id: number; x: number; y: number } | null = null;
    let stickId: number | null = null;
    let padJump = false;

    const onKeyDown = (event: KeyboardEvent) => {
        if (
            !enabled() ||
            event.isComposing ||
            editing(event.target) ||
            event.metaKey ||
            event.ctrlKey ||
            event.altKey
        )
            return;
        const code = keyCode(event);
        if ((KEYS.jump as readonly string[]).includes(code)) {
            if (!event.repeat && !keys.has(code)) jump.queue();
            keys.add(code);
            event.preventDefault();
        }
        if ((KEYS.run as readonly string[]).includes(code)) keys.add(code);
        if (MOVE_CODES.has(code)) {
            keys.add(code);
            event.preventDefault();
        }
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(keyCode(event));
    const onPointerDown = (event: PointerEvent) => {
        if (
            !enabled() ||
            event.button !== 0 ||
            options.acceptLook?.(event) === false
        )
            return;
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    };
    const onPointerMove = (event: PointerEvent) => {
        if (!drag || event.pointerId !== drag.id) return;
        if (enabled())
            dragLook(camera, event.clientX - drag.x, event.clientY - drag.y);
        drag.x = event.clientX;
        drag.y = event.clientY;
    };
    const onPointerUp = (event: PointerEvent) => {
        if (drag?.id === event.pointerId) drag = null;
    };
    const onWheel = (event: WheelEvent) => {
        // Pinch-zoom stays the browser's.
        if (event.ctrlKey || event.metaKey) return;
        event.preventDefault();
        if (!enabled()) return;
        const unit =
            event.deltaMode === 1
                ? 16
                : event.deltaMode === 2
                ? view.clientHeight
                : 1;
        wheelLook(camera, event.deltaY * unit);
    };
    const onStickMove = (event: PointerEvent) => {
        if (event.pointerId !== stickId || !stick) return;
        const rect = stick.getBoundingClientRect();
        Object.assign(
            touch,
            stickVector(
                event.clientX - rect.left - rect.width / 2,
                event.clientY - rect.top - rect.height / 2
            )
        );
        event.preventDefault();
    };
    const onStickDown = (event: PointerEvent) => {
        if (!enabled() || !stick) return;
        stickId = event.pointerId;
        stick.setPointerCapture(event.pointerId);
        onStickMove(event);
    };
    const onStickUp = (event: PointerEvent) => {
        if (event.pointerId !== stickId) return;
        stickId = null;
        touch.strafe = touch.forward = 0;
    };
    const clear = () => {
        keys.clear();
        jump.clear();
        drag = null;
        stickId = null;
        touch.strafe = touch.forward = 0;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clear);
    view.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    view.addEventListener("wheel", onWheel, { passive: false });
    stick?.addEventListener("pointerdown", onStickDown);
    stick?.addEventListener("pointermove", onStickMove);
    stick?.addEventListener("pointerup", onStickUp);
    stick?.addEventListener("pointercancel", onStickUp);

    return {
        read(seconds) {
            if (!enabled()) {
                if (keys.size || drag) clear();
                updateCamera(camera, seconds);
                return {
                    strafe: 0,
                    forward: 0,
                    yaw: camera.yaw,
                    running: false,
                    jump: false,
                };
            }
            const keyboard = readKeys(keys, seconds);
            const pad = readGamepad(
                typeof navigator !== "undefined" && navigator.getGamepads
                    ? [...navigator.getGamepads()].find(Boolean)
                    : null,
                seconds
            );
            // One press, one jump: a held button does not repeat.
            if (pad.jump && !padJump) jump.queue();
            padJump = pad.jump;
            const strafe = keyboard.strafe + touch.strafe + pad.strafe;
            const forward = keyboard.forward + touch.forward + pad.forward;
            turnLook(camera, keyboard.turn + pad.lookYaw, pad.lookPitch);
            updateCamera(
                camera,
                seconds,
                Math.abs(strafe) + Math.abs(forward) > 0.01
            );
            return {
                strafe,
                forward,
                yaw: camera.yaw,
                running: keyboard.running || pad.running,
                jump: jump.read(seconds),
            };
        },
        setStick(strafe, forward) {
            touch.strafe = Number.isFinite(strafe) ? strafe : 0;
            touch.forward = Number.isFinite(forward) ? forward : 0;
        },
        setCamera(next) {
            camera = next;
        },
        clear,
        dispose() {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            window.removeEventListener("blur", clear);
            view.removeEventListener("pointerdown", onPointerDown);
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            window.removeEventListener("pointercancel", onPointerUp);
            view.removeEventListener("wheel", onWheel);
            stick?.removeEventListener("pointerdown", onStickDown);
            stick?.removeEventListener("pointermove", onStickMove);
            stick?.removeEventListener("pointerup", onStickUp);
            stick?.removeEventListener("pointercancel", onStickUp);
        },
    };
}
