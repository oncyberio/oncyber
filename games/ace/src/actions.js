// The declared input actions (game.json) read as one small per-frame
// snapshot: a move vector and the events the menus and the match consume.
// Pure: `context` is the lifecycle's input view, `memory` persists between
// frames. Devices are bound to actions by the host (input.js).

const SHOTS = ["flat", "topspin", "slice", "lob", "drop"];
const NAV = ["up", "down", "left", "right"];

/** Move is in screen space: +y is up/forward. */
export function readActions({ input, pressed }, memory) {
    const held = (name) => input[name] > 0;
    let x = (held("right") ? 1 : 0) - (held("left") ? 1 : 0);
    let y = (held("up") ? 1 : 0) - (held("down") ? 1 : 0);
    // A stick wins over the keys while it is deflected.
    if (Math.hypot(input.moveX, input.moveY) > 0.05) {
        x = input.moveX;
        y = input.moveY;
    }
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
    for (const dir of NAV) if (pressed[dir]) events.push({ type: "nav", dir });
    return { x, y, events };
}
