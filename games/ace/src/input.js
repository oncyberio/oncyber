// Keyboard, mouse, gamepad and touch merged into one small per-frame snapshot.
// The keyboard arrives as the actions declared in game.json, through the
// page keys binder: this file adds no key listeners (docs/games/keys-focus.md).
import { bindPageKeys } from "@oncyber/game-runtime/keys-browser";
import manifest from "../game.json";

// flat (J, Space) regular, topspin (K), slice (H) cut, lob (U). Slice and
// topspin together play a drop shot.
const SHOTS = new Set(["flat", "topspin", "slice", "lob"]);
const DROP_CHORD = { slice: "topspin", topspin: "slice" };
const NAV = new Set(["up", "down", "left", "right"]);

/**
 * `page`: `{ paused(reason), resumed(), muted(muted), probe() }`, what the
 * game does when the page pauses input or turns sound off.
 */
export function createInput(target, touchRoot, page = {}) {
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
    const shotHeld = () => [...SHOTS].some((k) => held.has(k));
    const onAction = (name, value) => {
        if (!value) {
            held.delete(name);
            if (SHOTS.has(name) && !shotHeld()) push({ type: "release" });
            return;
        }
        input.lastDevice = "keyboard";
        held.add(name);
        if (DROP_CHORD[name] && held.has(DROP_CHORD[name]))
            push({ type: "shot", shot: "drop" });
        else if (SHOTS.has(name)) push({ type: "shot", shot: name });
        if (name === "pause") push({ type: "pause" });
        if (name === "flat") push({ type: "confirm" });
        if (name === "back" || name === "topspin") push({ type: "back" });
        if (NAV.has(name)) push({ type: "nav", dir: name });
    };
    const keys = bindPageKeys({
        game: "ace",
        input: manifest.input,
        action: onAction,
        paused(reason) {
            // Nothing from any device reaches the game until `resumed`.
            input.enabled = false;
            clearInput(input);
            input.touch = { active: false, id: null, x: 0, y: 0 };
            page.paused?.(reason);
        },
        resumed() {
            input.enabled = true;
            clearInput(input);
            page.resumed?.();
        },
        muted: (muted) => page.muted?.(muted),
        probe: () => page.probe?.(),
    });
    const onMouse = (e) => {
        if (e.target.closest && e.target.closest("button, .touch-pad")) return;
        input.lastDevice = "mouse";
        const shot =
            e.button === 2 ? "slice" : e.button === 1 ? "lob" : "flat";
        push({ type: "shot", shot, mouse: true });
    };
    const onMouseUp = () => push({ type: "release" });
    const noMenu = (e) => e.preventDefault();
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
        keys.dispose();
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
    let x = (h.has("right") ? 1 : 0) - (h.has("left") ? 1 : 0);
    let y = (h.has("up") ? 1 : 0) - (h.has("down") ? 1 : 0);
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
            events.push({ type: "shot", shot: "flat" }, { type: "confirm" });
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
        if (edge(9)) events.push({ type: "pause" });
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
        events: input.enabled ? events : [],
    };
}

export function clearInput(input) {
    input.held.clear();
    input.queue.length = 0;
}
