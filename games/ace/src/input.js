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

    // Mouse: left regular, right cut, middle lob. Dragging looks around.
    const mouseShots = ["flat", "lob", "slice"];
    let drag = null;
    on(canvas, "mousedown", (e) => set(mouseShots[e.button] ?? "flat", 1));
    on(window, "mouseup", () => mouseShots.forEach((shot) => set(shot, 0)));
    on(canvas, "contextmenu", (e) => e.preventDefault());
    on(canvas, "pointerdown", (e) => (drag = { id: e.pointerId, x: e.clientX }));
    on(window, "pointermove", (e) => {
        if (drag?.id !== e.pointerId) return;
        const moved = (e.clientX - drag.x) / 100;
        drag.x = e.clientX;
        try {
            session.delta("lookX", Math.max(-1, Math.min(1, moved)));
        } catch {
            /* not entered yet, or disposed */
        }
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
