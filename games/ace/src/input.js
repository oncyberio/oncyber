// Keyboard, mouse, gamepad and touch merged into one small per-frame snapshot.

// J regular, K topspin, H cut (slice), U lob. H and K together play a drop shot.
const SHOT_KEYS = {
    KeyJ: "flat",
    Space: "flat",
    KeyK: "topspin",
    KeyH: "slice",
    KeyU: "lob",
};
const DROP_CHORD = { KeyH: "KeyK", KeyK: "KeyH" };

export function createInput(target, touchRoot) {
    const held = new Set();
    const queue = [];
    const input = {
        enabled: true,
        held,
        queue,
        touch: { active: false, x: 0, y: 0, id: null },
        lastDevice: "keyboard",
        padPrev: [],
    };
    const push = (e) => queue.push(e);
    const onKey = (e) => {
        if (e.repeat) {
            if (["Space", "ArrowUp", "ArrowDown"].includes(e.code))
                e.preventDefault();
            return;
        }
        input.lastDevice = "keyboard";
        held.add(e.code);
        if (DROP_CHORD[e.code] && held.has(DROP_CHORD[e.code]))
            push({ type: "shot", shot: "drop" });
        else if (SHOT_KEYS[e.code])
            push({ type: "shot", shot: SHOT_KEYS[e.code] });
        if (e.code === "Escape" || e.code === "KeyP") push({ type: "pause" });
        if (e.code === "Enter" || e.code === "Space" || e.code === "KeyJ")
            push({ type: "confirm", code: e.code });
        if (e.code === "Escape" || e.code === "Backspace" || e.code === "KeyK")
            push({ type: "back" });
        if (e.code === "KeyM") push({ type: "mute" });
        const nav = {
            ArrowUp: "up",
            KeyW: "up",
            ArrowDown: "down",
            KeyS: "down",
            ArrowLeft: "left",
            KeyA: "left",
            ArrowRight: "right",
            KeyD: "right",
        }[e.code];
        if (nav) push({ type: "nav", dir: nav });
        if (
            [
                "Space",
                "ArrowUp",
                "ArrowDown",
                "ArrowLeft",
                "ArrowRight",
            ].includes(e.code)
        )
            e.preventDefault();
    };
    const shotHeld = () => Object.keys(SHOT_KEYS).some((k) => held.has(k));
    const onKeyUp = (e) => {
        held.delete(e.code);
        if (SHOT_KEYS[e.code] && !shotHeld()) push({ type: "release" });
    };
    const onBlur = () => held.clear();
    const onMouse = (e) => {
        if (e.target.closest && e.target.closest("button, .touch-pad")) return;
        input.lastDevice = "mouse";
        const shot =
            e.button === 2 ? "slice" : e.button === 1 ? "lob" : "flat";
        push({ type: "shot", shot, mouse: true });
    };
    const onMouseUp = () => push({ type: "release" });
    const noMenu = (e) => e.preventDefault();
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    target.addEventListener("mousedown", onMouse);
    window.addEventListener("mouseup", onMouseUp);
    target.addEventListener("contextmenu", noMenu);

    // Touch: a floating stick on the left, three shot buttons on the right.
    const stick = touchRoot.querySelector(".touch-stick");
    const knob = touchRoot.querySelector(".touch-knob");
    const buttonTouches = new Set();
    const onTouchStart = (e) => {
        input.lastDevice = "touch";
        document.body.classList.add("is-touch");
        for (const t of e.changedTouches) {
            const btn = t.target.closest && t.target.closest("[data-shot]");
            if (btn) {
                push({ type: "shot", shot: btn.dataset.shot });
                push({ type: "confirm" });
                buttonTouches.add(t.identifier);
                btn.classList.add("down");
                setTimeout(() => btn.classList.remove("down"), 140);
                continue;
            }
            if (t.target.closest && t.target.closest("button")) continue;
            if (
                t.clientX < window.innerWidth * 0.5 &&
                input.touch.id === null
            ) {
                input.touch = {
                    active: true,
                    id: t.identifier,
                    ox: t.clientX,
                    oy: t.clientY,
                    x: 0,
                    y: 0,
                };
                stick.style.left = `${t.clientX}px`;
                stick.style.top = `${t.clientY}px`;
                stick.classList.add("on");
            }
        }
    };
    const onTouchMove = (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier !== input.touch.id) continue;
            const dx = t.clientX - input.touch.ox;
            const dy = t.clientY - input.touch.oy;
            const r = 46;
            const d = Math.hypot(dx, dy);
            const k = d > r ? r / d : 1;
            input.touch.x = (dx * k) / r;
            input.touch.y = (-dy * k) / r;
            knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
        }
        e.preventDefault();
    };
    const onTouchEnd = (e) => {
        for (const t of e.changedTouches) {
            if (buttonTouches.delete(t.identifier)) {
                if (!buttonTouches.size) push({ type: "release" });
                continue;
            }
            if (t.identifier !== input.touch.id) continue;
            input.touch = { active: false, id: null, x: 0, y: 0 };
            knob.style.transform = "";
            stick.classList.remove("on");
        }
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);

    input.dispose = () => {
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", onBlur);
        target.removeEventListener("mousedown", onMouse);
        window.removeEventListener("mouseup", onMouseUp);
        target.removeEventListener("contextmenu", noMenu);
        window.removeEventListener("touchstart", onTouchStart);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("touchend", onTouchEnd);
        window.removeEventListener("touchcancel", onTouchEnd);
    };
    return input;
}

/** Read and clear this frame's input. Move is in screen space: +y is up/forward. */
export function readInput(input) {
    const h = input.held;
    let x =
        (h.has("KeyD") || h.has("ArrowRight") ? 1 : 0) -
        (h.has("KeyA") || h.has("ArrowLeft") ? 1 : 0);
    let y =
        (h.has("KeyW") || h.has("ArrowUp") ? 1 : 0) -
        (h.has("KeyS") || h.has("ArrowDown") ? 1 : 0);
    if (input.touch.active) {
        x = input.touch.x;
        y = input.touch.y;
    }
    const events = input.queue.splice(0);
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
        if (!pad) continue;
        const ax = pad.axes[0] || 0;
        const ay = pad.axes[1] || 0;
        if (Math.hypot(ax, ay) > 0.2) {
            x = ax;
            y = -ay;
            input.lastDevice = "pad";
        }
        const b = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
        if (b(12)) y = 1;
        if (b(13)) y = -1;
        if (b(14)) x = -1;
        if (b(15)) x = 1;
        const prev = input.padPrev[pad.index] || [];
        const edge = (i) => b(i) && !prev[i];
        if (edge(0))
            events.push(
                { type: "shot", shot: "flat" },
                { type: "confirm", pad: true }
            );
        if (edge(1))
            events.push({ type: "shot", shot: "slice" }, { type: "back" });
        if (edge(2)) events.push({ type: "shot", shot: "topspin" });
        if (edge(3)) events.push({ type: "shot", shot: "lob" });
        if (edge(4) || edge(5)) events.push({ type: "shot", shot: "drop" });
        const shotBtns = [0, 1, 2, 3, 4, 5];
        if (
            shotBtns.some((i) => prev[i] && !b(i)) &&
            !shotBtns.some((i) => b(i))
        )
            events.push({ type: "release" });
        if (edge(9)) events.push({ type: "pause", pad: true });
        if (edge(12)) events.push({ type: "nav", dir: "up" });
        if (edge(13)) events.push({ type: "nav", dir: "down" });
        if (edge(14)) events.push({ type: "nav", dir: "left" });
        if (edge(15)) events.push({ type: "nav", dir: "right" });
        if ([0, 1, 2, 3, 4, 5, 9, 12, 13, 14, 15].some(edge))
            input.lastDevice = "pad";
        input.padPrev[pad.index] = pad.buttons.map((btn) => btn.pressed);
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
        x /= len;
        y /= len;
    }
    if (!input.enabled) {
        x = 0;
        y = 0;
    }
    return {
        x,
        y,
        events: input.enabled
            ? events
            : events.filter((e) => e.type === "pause"),
    };
}

export function clearInput(input) {
    input.held.clear();
    input.queue.length = 0;
}
