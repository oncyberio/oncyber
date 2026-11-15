// Mouse, touch and gamepad bound to the declared actions (game.json). The
// keyboard is bound by the runtime's page keys binder (host.js), so this
// file adds no key listeners (docs/games/keys-focus.md). Nothing here knows
// the game: it only calls session.action(name, value) and session.delta(),
// which take nothing while the page has paused input.

export function bindDevices(session, canvas, touchRoot) {
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
    if (window.matchMedia?.("(pointer: coarse)").matches)
        document.body.classList.add("is-touch");

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

    // Touch: a floating stick on the left, shot buttons on the right.
    const stick = touchRoot.querySelector(".touch-stick");
    const knob = touchRoot.querySelector(".touch-knob");
    let stickTouch = null;
    const shotTouches = new Map();
    const onTouchStart = (e) => {
        document.body.classList.add("is-touch");
        for (const t of e.changedTouches) {
            const button = t.target.closest?.("[data-shot]");
            if (button) {
                set(button.dataset.shot, 1);
                set("confirm", 1);
                shotTouches.set(t.identifier, button.dataset.shot);
                button.classList.add("down");
                setTimeout(() => button.classList.remove("down"), 140);
                continue;
            }
            if (t.target.closest?.("button")) continue;
            if (t.clientX < window.innerWidth * 0.5 && !stickTouch) {
                stickTouch = { id: t.identifier, ox: t.clientX, oy: t.clientY };
                stick.style.left = `${t.clientX}px`;
                stick.style.top = `${t.clientY}px`;
                stick.classList.add("on");
            }
        }
    };
    const onTouchMove = (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier !== stickTouch?.id) continue;
            const dx = t.clientX - stickTouch.ox;
            const dy = t.clientY - stickTouch.oy;
            const r = 46;
            const d = Math.hypot(dx, dy);
            const k = d > r ? r / d : 1;
            set("moveX", (dx * k) / r);
            set("moveY", (-dy * k) / r);
            knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
        }
        e.preventDefault();
    };
    const onTouchEnd = (e) => {
        for (const t of e.changedTouches) {
            const shot = shotTouches.get(t.identifier);
            if (shot) {
                shotTouches.delete(t.identifier);
                set(shot, 0);
                set("confirm", 0);
                continue;
            }
            if (t.identifier !== stickTouch?.id) continue;
            stickTouch = null;
            set("moveX", 0);
            set("moveY", 0);
            knob.style.transform = "";
            stick.classList.remove("on");
        }
    };
    on(window, "touchstart", onTouchStart, { passive: true });
    on(window, "touchmove", onTouchMove, { passive: false });
    on(window, "touchend", onTouchEnd);
    on(window, "touchcancel", onTouchEnd);

    // Gamepad, polled once a frame: button index -> the actions it holds.
    const PAD = {
        0: ["flat", "confirm"],
        1: ["slice", "back"],
        2: ["topspin"],
        3: ["lob"],
        4: ["drop"],
        5: ["drop"],
        9: ["pause"],
        12: ["up"],
        13: ["down"],
        14: ["left"],
        15: ["right"],
    };
    const padHeld = new Set();
    let stickLive = false;
    const poll = () => {
        // Paused by the page: read nothing, so a button still down when
        // input resumes counts as a new press.
        if (session.inputPaused) {
            padHeld.clear();
            return;
        }
        const now = new Set();
        let ax = 0;
        let ay = 0;
        for (const pad of navigator.getGamepads?.() ?? []) {
            if (!pad) continue;
            if (Math.hypot(pad.axes[0] || 0, pad.axes[1] || 0) > 0.2) {
                ax = pad.axes[0] || 0;
                ay = -(pad.axes[1] || 0);
            }
            for (const [index, actions] of Object.entries(PAD))
                if (pad.buttons[index]?.pressed)
                    actions.forEach((action) => now.add(action));
        }
        for (const action of now) if (!padHeld.has(action)) set(action, 1);
        for (const action of padHeld) if (!now.has(action)) set(action, 0);
        padHeld.clear();
        now.forEach((action) => padHeld.add(action));
        const deflected = ax !== 0 || ay !== 0;
        if (deflected || stickLive) {
            const len = Math.max(1, Math.hypot(ax, ay));
            set("moveX", ax / len);
            set("moveY", ay / len);
        }
        stickLive = deflected;
    };
    return { poll, dispose: () => live.abort() };
}
