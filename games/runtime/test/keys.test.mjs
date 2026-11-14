import assert from "node:assert/strict";
import test from "node:test";
import {
    RuntimeSession,
    RESERVED_KEYS,
    InputGate,
    HeldActions,
    checkBindings,
    keyMap,
} from "../src/index.ts";
import {
    bindPageKeys,
    bindSessionKeys,
    relayPageKeys,
} from "../src/keysBrowser.ts";

const input = {
    up: { keyboard: ["KeyW", "ArrowUp"] },
    hit: { keyboard: ["Space"] },
    look: { touch: "stick" },
};

/** A window and document with just the events the binder uses. */
function fakeFrame() {
    const make = () => {
        const listeners = new Map();
        return {
            listeners,
            addEventListener(type, f) {
                listeners.set(type, [...(listeners.get(type) ?? []), f]);
            },
            removeEventListener(type, f) {
                listeners.set(
                    type,
                    (listeners.get(type) ?? []).filter((g) => g !== f)
                );
            },
            fire(type, event = {}) {
                for (const f of listeners.get(type) ?? []) f(event);
            },
        };
    };
    const posted = [];
    const parent = { postMessage: (message) => posted.push(message) };
    const document = Object.assign(make(), {
        pointerLockElement: null,
        exits: 0,
        exitPointerLock() {
            this.exits++;
            this.pointerLockElement = null;
            this.fire("pointerlockchange");
        },
    });
    const window = Object.assign(make(), { parent, document });
    const key = (type, code, more = {}) => {
        const event = {
            type,
            code,
            target: {},
            prevented: false,
            preventDefault() {
                this.prevented = true;
            },
            ...more,
        };
        window.fire(type, event);
        return event;
    };
    const page = (data) => window.fire("message", { source: parent, data });
    return { window, document, posted, key, page };
}

test("the page and the runtime reserve the same keys", async () => {
    const page = await import("../../../frontend/features/games/gameInput.ts");
    assert.deepEqual({ ...page.GAME_RESERVED_KEYS }, { ...RESERVED_KEYS });
});

test("reserved keys cannot be bound and never map to an action", () => {
    assert.deepEqual(Object.keys(RESERVED_KEYS), [
        "Escape",
        "Enter",
        "NumpadEnter",
        "KeyM",
    ]);
    assert.deepEqual(checkBindings(input), []);
    const findings = checkBindings({
        pause: { keyboard: ["Escape", "KeyP"] },
        mute: { keyboard: ["KeyM"] },
        "bad name": { keyboard: ["w"] },
    });
    assert.deepEqual(
        findings.map((f) => f.code),
        ["KEY_RESERVED", "KEY_RESERVED", "ACTION_INVALID", "KEY_INVALID"]
    );
    assert.equal(checkBindings(undefined)[0].code, "ACTION_INVALID");
    assert.deepEqual(
        [...keyMap({ pause: { keyboard: ["Escape", "KeyP"] } })],
        [["KeyP", ["pause"]]]
    );
});

test("the gate reports one pause and one resume across overlapping reasons", () => {
    const events = [];
    const gate = new InputGate({
        paused: (r) => events.push(`paused:${r}`),
        resumed: () => events.push("resumed"),
    });
    gate.set(true, "chat");
    gate.hold("modal");
    gate.set(true, "menu");
    assert.equal(gate.paused, true);
    assert.equal(gate.reason, "menu");
    gate.set(false);
    assert.equal(gate.paused, true);
    gate.release("modal");
    gate.release("modal");
    gate.set(false);
    assert.deepEqual(events, ["paused:chat", "resumed"]);
    gate.hold("Not A Reason");
    assert.equal(gate.paused, false);
});

test("two keys on one action hold it until both are up", () => {
    const held = new HeldActions(input);
    assert.deepEqual(held.key("KeyW", true), [["up", 1]]);
    assert.deepEqual(held.key("ArrowUp", true), []);
    assert.deepEqual(held.key("KeyW", false), []);
    assert.deepEqual(held.key("ArrowUp", false), [["up", 0]]);
    held.key("Space", true);
    assert.deepEqual(held.releaseAll(), ["hit"]);
    assert.deepEqual(held.held(), []);
});

test("declared keys become actions; reserved keys go to the page", () => {
    const f = fakeFrame(),
        actions = [];
    const keys = bindPageKeys({
        game: "ace",
        input,
        action: (n, v) => actions.push([n, v]),
        window: f.window,
    });
    assert.equal(f.key("keydown", "KeyW").prevented, true);
    f.key("keydown", "KeyW", { repeat: true });
    f.key("keyup", "KeyW");
    assert.equal(f.key("keydown", "KeyZ").prevented, false);
    f.key("keydown", "KeyW", { ctrlKey: true });
    f.key("keydown", "KeyW", { target: { tagName: "INPUT" } });
    assert.deepEqual(actions, [
        ["up", 1],
        ["up", 0],
    ]);
    for (const code of ["Escape", "Enter", "KeyM"])
        assert.equal(f.key("keydown", code).prevented, true);
    f.key("keydown", "Escape", { repeat: true });
    f.key("keyup", "Escape");
    assert.deepEqual(
        f.posted,
        ["Escape", "Enter", "KeyM"].map((code) => ({ type: "ace:key", code }))
    );
    assert.deepEqual(actions.length, 2);
    keys.dispose();
    f.key("keydown", "KeyW");
    assert.equal(actions.length, 2);
});

test("a page pause releases held actions, blocks input, and resumes once", () => {
    const f = fakeFrame(),
        log = [];
    bindPageKeys({
        game: "ace",
        input,
        window: f.window,
        action: (n, v) => log.push(`${n}=${v}`),
        paused: (r) => log.push(`paused:${r}`),
        resumed: () => log.push("resumed"),
        muted: (m) => log.push(`muted:${m}`),
        probe: () => ({ position: [1, 0, 2] }),
    });
    f.key("keydown", "KeyW");
    f.key("keydown", "Space");
    f.page({ type: "ace:input", paused: true, reason: "chat" });
    assert.deepEqual(log, ["up=1", "hit=1", "up=0", "hit=0", "paused:chat"]);
    // Still swallowed so the page doesn't scroll, but nothing reaches the game.
    assert.equal(f.key("keydown", "KeyW").prevented, true);
    f.key("keyup", "KeyW");
    f.page({ type: "ace:input", paused: true, reason: "menu" });
    assert.equal(log.length, 5);
    f.page({ type: "ace:input-probe" });
    assert.deepEqual(f.posted.at(-1), {
        type: "ace:input-state",
        paused: true,
        reason: "menu",
        held: [],
        delivered: 2,
        locked: false,
        probe: { position: [1, 0, 2] },
    });
    f.page({ type: "ace:input", paused: false });
    f.page({ type: "ace:muted", muted: true });
    f.key("keydown", "KeyW");
    assert.deepEqual(log.slice(5), ["resumed", "muted:true", "up=1"]);
    // Other senders and other games' messages are ignored.
    f.window.fire("message", {
        source: {},
        data: { type: "ace:input", paused: true },
    });
    f.page({ type: "garden:input", paused: true });
    f.window.fire("blur");
    assert.deepEqual(log.slice(8), ["up=0"]);
});

test("pointer lock is given up on pause, taken back on the next click, and Escape under lock opens the menu", () => {
    const f = fakeFrame();
    let requests = 0;
    const canvas = {
        requestPointerLock() {
            requests++;
            f.document.pointerLockElement = canvas;
            return Promise.resolve();
        },
    };
    const keys = bindPageKeys({
        game: "ace",
        input,
        window: f.window,
        action() {},
    });
    keys.lockPointer(canvas);
    assert.equal(requests, 1);
    f.page({ type: "ace:input", paused: true, reason: "menu" });
    assert.equal(f.document.exits, 1);
    assert.deepEqual(f.posted, []);
    f.window.fire("pointerdown");
    assert.equal(requests, 1);
    f.page({ type: "ace:input", paused: false });
    assert.equal(requests, 1);
    f.window.fire("pointerdown");
    assert.equal(requests, 2);
    // The browser drops the lock on Escape without a key event.
    f.document.pointerLockElement = null;
    f.document.fire("pointerlockchange");
    assert.deepEqual(f.posted, [{ type: "ace:key", code: "Escape" }]);
    keys.lockPointer(canvas);
    keys.unlockPointer();
    f.window.fire("pointerdown");
    assert.equal(requests, 3);
    assert.equal(f.posted.length, 1);
});

test("a session takes no input while paused and tells the game", async () => {
    const calls = [];
    const session = new RuntimeSession(
        () => ({
            async prepare() {},
            enter() {},
            update() {},
            suspend() {
                return null;
            },
            restore() {},
            dispose() {},
            inspect() {
                return {};
            },
            inputPaused: (p, r) => calls.push([p, r]),
        }),
        {
            manifest: {
                profile: "portable-v1",
                version: "1",
                input,
                assets: [],
                capabilities: [],
            },
            graphics: {},
            services: {
                identity: { id: "v", name: "V" },
                asset: async () => new ArrayBuffer(0),
                call: async () => null,
            },
            sendUI() {},
        }
    );
    await session.prepare();
    await session.enter({
        avatar: { id: "v", position: [0, 0, 0], rotation: [0, 0, 0, 1] },
        camera: {
            position: [0, 1, 2],
            target: [0, 0, 0],
            fov: 50,
            mode: "third-person",
        },
        party: [],
    });
    const f = fakeFrame();
    bindSessionKeys(session, { game: "garden", input, window: f.window });
    f.key("keydown", "KeyW");
    assert.equal(session.inspect().hostInputPaused, false);
    f.page({ type: "garden:input", paused: true, reason: "typing" });
    session.action("up", 1);
    session.action("hit", 1);
    session.tick(1 / 60);
    f.page({ type: "garden:input-probe" });
    assert.equal(f.posted.at(-1).probe.hostInputPaused, true);
    f.page({ type: "garden:input", paused: false });
    f.key("keydown", "KeyW");
    f.key("keydown", "ArrowUp");
    assert.deepEqual(calls, [
        [true, "typing"],
        [false, ""],
    ]);
    await session.dispose();
});

test("a nested interface frame's keys reach the page through the relay", () => {
    const f = fakeFrame(),
        sent = [];
    const frame = { contentWindow: { postMessage: (m) => sent.push(m) } };
    const stop = relayPageKeys(frame, "garden", f.window);
    f.window.fire("message", {
        source: frame.contentWindow,
        data: { type: "garden:key", code: "Escape", extra: 1 },
    });
    f.window.fire("message", {
        source: frame.contentWindow,
        data: { type: "garden:key", code: "KeyW" },
    });
    f.window.fire("message", {
        source: frame.contentWindow,
        data: { type: "garden:input", paused: true },
    });
    assert.deepEqual(f.posted, [{ type: "garden:key", code: "Escape" }]);
    f.page({ type: "garden:input", paused: true, reason: "chat" });
    f.page({ type: "garden:identity", name: "x" });
    assert.deepEqual(sent, [
        { type: "garden:input", paused: true, reason: "chat", muted: false },
    ]);
    stop();
    f.page({ type: "garden:muted", muted: true });
    assert.equal(sent.length, 1);
});
