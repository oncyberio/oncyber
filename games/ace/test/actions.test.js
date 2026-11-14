import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readActions } from "../src/actions.js";

const manifest = JSON.parse(
    readFileSync(new URL("../game.json", import.meta.url), "utf8")
);
const names = Object.keys(manifest.runtime.input);
/** The lifecycle's input view with some actions held and some just pressed. */
function context(held = {}, pressed = []) {
    return {
        input: Object.fromEntries(names.map((n) => [n, held[n] ?? 0])),
        pressed: Object.fromEntries(names.map((n) => [n, pressed.includes(n)])),
    };
}
const types = (result) => result.events.map((e) => e.shot ?? e.dir ?? e.type);

test("every action the reader uses is declared in game.json", () => {
    const source = readFileSync(
        new URL("../src/actions.js", import.meta.url),
        "utf8"
    );
    const used = [
        ...source.matchAll(
            /\b(?:pressed|input)\.([a-zA-Z]+)|held\("([a-zA-Z]+)"\)/g
        ),
    ]
        .map((m) => m[1] ?? m[2])
        .filter((name) => name !== "js");
    for (const action of [
        ...used,
        "flat",
        "topspin",
        "slice",
        "lob",
        "drop",
        "up",
        "down",
        "left",
        "right",
    ])
        assert.ok(names.includes(action), `${action} is not declared`);
});

test("keys make a unit move vector; a deflected stick wins", () => {
    const keys = readActions(context({ up: 1, right: 1 }), {});
    assert.ok(Math.abs(Math.hypot(keys.x, keys.y) - 1) < 1e-9);
    assert.ok(keys.x > 0 && keys.y > 0);
    const stick = readActions(context({ up: 1, moveX: -0.5, moveY: 0 }), {});
    assert.deepEqual([stick.x, stick.y], [-0.5, 0]);
});

test("a press is a shot, letting go of every shot is a release", () => {
    const memory = {};
    assert.deepEqual(
        types(readActions(context({ flat: 1 }, ["flat"]), memory)),
        ["flat"]
    );
    assert.deepEqual(types(readActions(context({ flat: 1 }), memory)), []);
    assert.deepEqual(types(readActions(context(), memory)), ["release"]);
    assert.deepEqual(types(readActions(context(), memory)), []);
});

test("cut and topspin together play a drop shot", () => {
    assert.deepEqual(
        types(readActions(context({ slice: 1, topspin: 1 }, ["topspin"]), {})),
        ["drop"]
    );
    assert.deepEqual(types(readActions(context({ drop: 1 }, ["drop"]), {})), [
        "drop",
    ]);
});

test("one key can be a shot and a menu action; Escape pauses without backing out", () => {
    assert.deepEqual(
        types(
            readActions(
                context({ flat: 1, confirm: 1 }, ["flat", "confirm"]),
                {}
            )
        ),
        ["flat", "confirm"]
    );
    assert.deepEqual(types(readActions(context({}, ["pause", "back"]), {})), [
        "pause",
    ]);
    assert.deepEqual(types(readActions(context({}, ["back"]), {})), ["back"]);
    assert.deepEqual(
        types(readActions(context({ down: 1 }, ["down", "mute"]), {})),
        ["mute", "down"]
    );
});
