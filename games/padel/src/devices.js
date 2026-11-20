import { bindDeviceControls } from "@oncyber/game-runtime/device-controls";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * The devices bound to the declared actions. The keyboard is bound by the
 * runtime's page keys binder (host.js), so this file adds no key listeners
 * (docs/games/keys-focus.md). The on-screen stick and buttons and the
 * gamepad mapping are the runtime's, built from the same bindings
 * (docs/games/devices.md). Only the mouse is read here: a left click on the
 * court is the control shot, and a drag looks around the club. Everything
 * ends in session.action() and session.delta(), which take nothing while
 * the page has paused input.
 */
export function bindDevices(session, canvas, input) {
    const live = new AbortController();
    const on = (target, type, listener, options) =>
        target.addEventListener(type, listener, {
            ...options,
            signal: live.signal,
        });
    const quietly = (run) => {
        try {
            run();
        } catch {
            /* not entered yet, or disposed */
        }
    };
    let drag = null;
    on(canvas, "mousedown", (event) => {
        if (event.button === 0) quietly(() => session.action("hit", 1));
    });
    on(window, "mouseup", () => quietly(() => session.action("hit", 0)));
    on(canvas, "contextmenu", (event) => event.preventDefault());
    // The drag is the declared `lookX` / `lookY`, in hundreds of pixels.
    const look = (action, pixels) =>
        quietly(() => session.delta(action, clamp(pixels / 100, -1, 1)));
    on(canvas, "pointerdown", (event) => {
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    on(window, "pointermove", (event) => {
        if (drag?.id !== event.pointerId) return;
        look("lookX", event.clientX - drag.x);
        look("lookY", event.clientY - drag.y);
        drag.x = event.clientX;
        drag.y = event.clientY;
    });
    const endDrag = () => (drag = null);
    on(window, "pointerup", endDrag);
    on(window, "pointercancel", endDrag);
    const controls = bindDeviceControls(session, input);
    return {
        dispose() {
            live.abort();
            controls.dispose();
        },
    };
}
