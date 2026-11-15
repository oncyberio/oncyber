// The devices bound to the declared actions (game.json). The keyboard is
// bound by the runtime's page keys binder (host.js), so this file adds no
// key listeners (docs/games/keys-focus.md). The on-screen stick and buttons
// and the gamepad mapping are the runtime's, built from the same bindings
// (docs/games/devices.md); only the mouse and the look drag, which have no
// binding the runtime draws, are read here. Nothing here knows the game: it
// all ends in session.action(name, value) and session.delta(), which take
// nothing while the page has paused input.
import { bindDeviceControls } from "@oncyber/game-runtime/device-controls";

export function bindDevices(session, canvas, input) {
    const live = new AbortController();
    const on = (target, type, listener, options) =>
        target.addEventListener(type, listener, {
            ...options,
            signal: live.signal,
        });
    const set = (action, value) => {
        try {
            session.action(action, value);
        } catch {
            /* not entered yet, or disposed */
        }
    };

    // Mouse: left regular, right cut, middle lob. Dragging looks around
    // (the game turns it into the lobby's camera drag while walking).
    const mouseShots = ["flat", "lob", "slice"];
    let drag = null;
    on(canvas, "mousedown", (e) => set(mouseShots[e.button] ?? "flat", 1));
    on(window, "mouseup", () => mouseShots.forEach((shot) => set(shot, 0)));
    on(canvas, "contextmenu", (e) => e.preventDefault());
    // The drag is the declared `lookX` / `lookY`, in hundreds of pixels.
    const look = (action, pixels) => {
        try {
            session.delta(action, Math.max(-1, Math.min(1, pixels / 100)));
        } catch {
            /* not entered yet, or disposed */
        }
    };
    on(
        canvas,
        "pointerdown",
        (e) => (drag = { id: e.pointerId, x: e.clientX, y: e.clientY })
    );
    on(window, "pointermove", (e) => {
        if (drag?.id !== e.pointerId) return;
        look("lookX", e.clientX - drag.x);
        look("lookY", e.clientY - drag.y);
        drag.x = e.clientX;
        drag.y = e.clientY;
    });
    const endDrag = () => (drag = null);
    on(window, "pointerup", endDrag);
    on(window, "pointercancel", endDrag);

    // Touch and gamepad: the stick, the buttons and the pad mapping the
    // bindings declare. They stop with the session's input.
    const controls = bindDeviceControls(session, input);
    return {
        dispose() {
            live.abort();
            controls.dispose();
        },
    };
}
