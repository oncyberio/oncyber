// Keyboard, mouse and touch merged into a per-frame snapshot plus a queue of
// one-shot actions (interact, pet, throw, cheer...).

const ACTION_KEYS = {
    KeyE: "interact",
    KeyF: "pet",
    KeyQ: "throw",
    KeyC: "call",
    KeyR: "whistle",
    Space: "jump",
    Tab: "panel",
    KeyB: "panel",
    KeyH: "help",
    KeyM: "mute",
    Escape: "back",
    Enter: "confirm",
    Digit1: "pick1",
    Digit2: "pick2",
    Digit3: "pick3",
    Digit4: "pick4",
    KeyG: "wave",
};

export function createInput(canvas, touchRoot) {
    const held = new Set();
    const queue = [];
    const input = {
        held,
        queue,
        orbit: { dx: 0, dy: 0, zoom: 0 },
        stick: { x: 0, y: 0, id: null },
        look: { id: null, x: 0, y: 0 },
        drag: null,
        petHeld: false,
        lastDevice: "keyboard",
    };
    const typing = (e) =>
        e.target &&
        (e.target.tagName === "INPUT" || e.target.isContentEditable);
    window.addEventListener("keydown", (e) => {
        if (typing(e)) return;
        input.lastDevice = "keyboard";
        if (
            e.code === "Tab" ||
            e.code === "Space" ||
            e.code.startsWith("Arrow")
        )
            e.preventDefault();
        if (e.repeat) return;
        held.add(e.code);
        const a = ACTION_KEYS[e.code];
        if (a) queue.push({ type: a });
    });
    window.addEventListener("keyup", (e) => held.delete(e.code));
    window.addEventListener("blur", () => held.clear());

    // Mouse: drag to orbit, wheel to zoom, right click throws.
    canvas.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "touch") return;
        input.lastDevice = "mouse";
        canvas.focus();
        if (e.button === 2) {
            queue.push({ type: "throw" });
            return;
        }
        input.drag = { x: e.clientX, y: e.clientY, moved: 0, button: e.button };
        canvas.setPointerCapture?.(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
        if (!input.drag || e.pointerType === "touch") return;
        const dx = e.clientX - input.drag.x;
        const dy = e.clientY - input.drag.y;
        input.drag.x = e.clientX;
        input.drag.y = e.clientY;
        input.drag.moved += Math.abs(dx) + Math.abs(dy);
        input.orbit.dx += dx;
        input.orbit.dy += dy;
    });
    canvas.addEventListener("pointerup", (e) => {
        if (!input.drag || e.pointerType === "touch") return;
        if (input.drag.moved < 6)
            queue.push({ type: "click", x: e.clientX, y: e.clientY });
        input.drag = null;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener(
        "wheel",
        (e) => {
            e.preventDefault();
            input.orbit.zoom += Math.sign(e.deltaY);
        },
        { passive: false }
    );

    // Touch: a floating stick on the left half, drag to look on the right,
    // action buttons in the corner.
    const stick = touchRoot.querySelector(".touch-stick");
    const knob = touchRoot.querySelector(".touch-knob");
    const begin = (e) => {
        input.lastDevice = "touch";
        document.body.classList.add("is-touch");
        for (const t of e.changedTouches) {
            const btn = t.target.closest?.("[data-act]");
            if (btn) {
                const a = btn.dataset.act;
                queue.push({ type: a });
                if (a === "pet") input.petHeld = true;
                btn.classList.add("down");
                e.preventDefault();
                continue;
            }
            if (t.target.closest?.("button, .panel, .card")) continue;
            if (
                t.clientX < window.innerWidth * 0.45 &&
                input.stick.id === null
            ) {
                input.stick = {
                    id: t.identifier,
                    ox: t.clientX,
                    oy: t.clientY,
                    x: 0,
                    y: 0,
                };
                stick.style.left = `${t.clientX}px`;
                stick.style.top = `${t.clientY}px`;
                stick.classList.add("on");
            } else if (input.look.id === null) {
                input.look = {
                    id: t.identifier,
                    x: t.clientX,
                    y: t.clientY,
                    sx: t.clientX,
                    sy: t.clientY,
                    t: performance.now(),
                };
            }
        }
    };
    const move = (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier === input.stick.id) {
                const dx = t.clientX - input.stick.ox;
                const dy = t.clientY - input.stick.oy;
                const r = 50;
                const d = Math.hypot(dx, dy);
                const k = d > r ? r / d : 1;
                input.stick.x = (dx * k) / r;
                input.stick.y = (dy * k) / r;
                knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
            } else if (t.identifier === input.look.id) {
                input.orbit.dx += (t.clientX - input.look.x) * 1.2;
                input.orbit.dy += (t.clientY - input.look.y) * 1.2;
                input.look.x = t.clientX;
                input.look.y = t.clientY;
            }
        }
        if (e.cancelable) e.preventDefault();
    };
    const end = (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier === input.stick.id) {
                input.stick = { id: null, x: 0, y: 0 };
                knob.style.transform = "";
                stick.classList.remove("on");
            } else if (t.identifier === input.look.id) {
                const l = input.look;
                if (
                    Math.hypot(t.clientX - l.sx, t.clientY - l.sy) < 10 &&
                    performance.now() - l.t < 300
                )
                    queue.push({ type: "click", x: t.clientX, y: t.clientY });
                input.look = { id: null };
            }
            const btn = t.target.closest?.("[data-act]");
            if (btn) {
                btn.classList.remove("down");
                if (btn.dataset.act === "pet") input.petHeld = false;
            }
        }
    };
    touchRoot.addEventListener("touchstart", begin, { passive: false });
    canvas.addEventListener("touchstart", begin, { passive: false });
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end);
    window.addEventListener("touchcancel", end);
    return input;
}

/** Movement intent in camera space: x right, y forward, plus modifiers. */
export function readMove(input) {
    const h = input.held;
    let x =
        (h.has("KeyD") || h.has("ArrowRight") ? 1 : 0) -
        (h.has("KeyA") || h.has("ArrowLeft") ? 1 : 0);
    let y =
        (h.has("KeyW") || h.has("ArrowUp") ? 1 : 0) -
        (h.has("KeyS") || h.has("ArrowDown") ? 1 : 0);
    if (input.stick.id !== null) {
        x = input.stick.x;
        y = -input.stick.y;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
        x /= len;
        y /= len;
    }
    return {
        x,
        y,
        walk: h.has("ShiftLeft") || h.has("ShiftRight"),
        petting: h.has("KeyF") || input.petHeld,
    };
}

export function drain(input) {
    const q = input.queue.splice(0);
    return q;
}
