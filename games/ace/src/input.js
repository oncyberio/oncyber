// Named input actions merged into one small per-frame snapshot. The actions
// and their keyboard, touch and gamepad bindings are declared in game.json;
// the Oncyber runtime turns them into key handling, an on-screen stick and
// buttons, and gamepad mapping (docs/games/devices.md). Only the mouse, which
// has no binding, is read here.
import { bindBrowserInput } from "@oncyber/game-runtime/browser";
import manifest from "../game.json";

// Flat, topspin, cut (slice), lob. Cut and topspin together play a drop shot.
const SHOTS = ["flat", "topspin", "slice", "lob", "drop"];
const DROP_CHORD = { slice: "topspin", topspin: "slice" };
const NAV = ["up", "down", "left", "right"];
const EVENTS = ["confirm", "back", "pause", "mute"];
/** How far a stick must lean to step through a menu. */
const NAV_THRESHOLD = 0.5;

export function createInput(target) {
    const values = Object.fromEntries(
        Object.keys(manifest.runtime.input).map((name) => [name, 0]),
    );
    const queue = [];
    const input = { enabled: true, values, queue };
    const push = (e) => queue.push(e);
    const shotHeld = () => SHOTS.some((name) => values[name] > 0);

    // The runtime calls this for every declared action, from any device.
    const sink = {
        phase: "entered",
        action(name, value = 1) {
            const before = values[name] ?? 0;
            values[name] = value;
            if (SHOTS.includes(name)) {
                if (value > 0 && before <= 0)
                    push({
                        type: "shot",
                        shot: values[DROP_CHORD[name]] > 0 ? "drop" : name,
                    });
                else if (value <= 0 && before > 0 && !shotHeld())
                    push({ type: "release" });
            } else if (NAV.includes(name)) {
                if (value >= NAV_THRESHOLD && before < NAV_THRESHOLD)
                    push({ type: "nav", dir: name });
            } else if (EVENTS.includes(name) && value > 0 && before <= 0)
                push({ type: name });
        },
        clearInput() {
            for (const name of Object.keys(values)) values[name] = 0;
        },
    };
    const unbind = bindBrowserInput(sink, manifest.runtime);

    const onMouse = (e) => {
        if (e.target.closest && e.target.closest("button")) return;
        const shot = e.button === 2 ? "slice" : e.button === 1 ? "lob" : "flat";
        push({ type: "shot", shot, mouse: true });
    };
    const onMouseUp = () => push({ type: "release" });
    const noMenu = (e) => e.preventDefault();
    target.addEventListener("mousedown", onMouse);
    window.addEventListener("mouseup", onMouseUp);
    target.addEventListener("contextmenu", noMenu);

    input.dispose = () => {
        unbind();
        target.removeEventListener("mousedown", onMouse);
        window.removeEventListener("mouseup", onMouseUp);
        target.removeEventListener("contextmenu", noMenu);
    };
    return input;
}

/** Read and clear this frame's input. Move is in screen space: +y is up/forward. */
export function readInput(input) {
    const v = input.values;
    let x = v.right - v.left;
    let y = v.up - v.down;
    const events = input.queue.splice(0);
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
    for (const name of Object.keys(input.values)) input.values[name] = 0;
    input.queue.length = 0;
}
