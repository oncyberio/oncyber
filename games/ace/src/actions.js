// The declared input actions (game.json) read as one small per-frame
// snapshot: a move vector and the events the menus and the match consume.
// Pure: `context` is the lifecycle's input view, `memory` persists between
// frames. Devices are bound to actions by the runtime and the host (input.js).

const SHOTS = ["flat", "topspin", "slice", "lob", "drop"];
const NAV = ["up", "down", "left", "right"];
/** How far a stick must lean to step through a menu (a key is 1). */
const NAV_LEAN = 0.5;

/** Move is in screen space: +y is up/forward. */
export function readActions({ input, pressed }, memory) {
    const held = (name) => input[name] > 0;
    const lean = (name) => Math.max(0, input[name] || 0);
    // A key is 1; a stick (on screen or on a gamepad) leans 0 to 1.
    let x = lean("right") - lean("left");
    let y = lean("up") - lean("down");
    const len = Math.hypot(x, y);
    if (len > 1) {
        x /= len;
        y /= len;
    }
    const events = [];
    // Cut and topspin together play a drop shot.
    const chord =
        (pressed.slice && held("topspin")) ||
        (pressed.topspin && held("slice"));
    if (pressed.drop || chord) events.push({ type: "shot", shot: "drop" });
    else
        for (const shot of SHOTS)
            if (pressed[shot]) events.push({ type: "shot", shot });
    const shotHeld = SHOTS.some(held);
    if (memory.shotHeld && !shotHeld) events.push({ type: "release" });
    memory.shotHeld = shotHeld;
    if (pressed.pause) events.push({ type: "pause" });
    if (pressed.confirm) events.push({ type: "confirm" });
    // One press that is both pauses, it doesn't also back out of it.
    if (pressed.back && !pressed.pause) events.push({ type: "back" });
    // A direction steps a menu once per press, or once per lean of a stick
    // past half way (a slight lean walks, it doesn't move the focus).
    const leaning = (memory.leaning ??= {});
    for (const dir of NAV) {
        const far = lean(dir) >= NAV_LEAN;
        // A tap that began and ended inside one frame still counts.
        if ((far && !leaning[dir]) || (pressed[dir] && !held(dir)))
            events.push({ type: "nav", dir });
        leaning[dir] = far;
    }
    return { x, y, events };
}
