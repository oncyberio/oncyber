import assert from "node:assert/strict";
import test from "node:test";
import { browserUI } from "../src/browser.ts";

function setup(t) {
    const original = globalThis.window;
    globalThis.window = new EventTarget();
    const messages = [], actions = [], deltas = [], attributes = {};
    const frame = Object.assign(new EventTarget(), {
        contentWindow: { postMessage: message => messages.push(message) },
        setAttribute: (name, value) => { attributes[name] = value; },
    });
    const bridge = browserUI(frame, () => ({ action: (...args) => actions.push(args), delta: (...args) => deltas.push(args) }));
    const receive = (source, message) => window.dispatchEvent(Object.assign(new Event("message"), { source, data: message }));
    t.after(() => {
        bridge.dispose();
        if (original === undefined) delete globalThis.window; else globalThis.window = original;
    });
    return { frame, bridge, messages, actions, deltas, attributes, receive };
}

test("UI readiness and actions require the isolated frame's source and host channel", async t => {
    const { frame, bridge, messages, actions, deltas, attributes, receive } = setup(t);
    const ready = bridge.ready(200);
    let connected = false;
    void ready.then(() => { connected = true; });
    const channel = messages.at(-1).channel;
    assert.equal(attributes.sandbox, "allow-scripts");
    receive({}, { type: "oncyber:ui-ready", channel });
    receive(frame.contentWindow, { type: "oncyber:ui-ready", channel: "forged" });
    receive({}, { type: "oncyber:action", channel, action: "play" });
    receive(frame.contentWindow, { type: "oncyber:action", channel: "forged", action: "play" });
    await Promise.resolve();
    assert.equal(connected, false);
    assert.deepEqual(actions, []);
    receive(frame.contentWindow, { type: "oncyber:ui-ready", channel });
    await ready;
    receive(frame.contentWindow, { type: "oncyber:action", channel, action: "play", value: 1 });
    assert.deepEqual(actions, [["play", 1]]);
    receive({}, { type: "oncyber:delta", channel, action: "lookX", value: 0.2 });
    receive(frame.contentWindow, { type: "oncyber:delta", channel: "forged", action: "lookX", value: 0.2 });
    assert.deepEqual(deltas, []);
    receive(frame.contentWindow, { type: "oncyber:delta", channel, action: "lookX", value: 0.2 });
    assert.deepEqual(deltas, [["lookX", 0.2]]);
    bridge.publish({ score: 2 });
    assert.deepEqual(messages.at(-1), { type: "oncyber:state", channel, value: { score: 2 } });
});

test("a missing UI or disposed bridge cannot report readiness", async t => {
    const { bridge } = setup(t);
    await assert.rejects(bridge.ready(5), /UI_BRIDGE_NOT_READY/);
    const pending = bridge.ready(200);
    bridge.dispose();
    await assert.rejects(pending, /UI_BRIDGE_DISPOSED/);
    await assert.rejects(bridge.ready(), /UI_BRIDGE_DISPOSED/);
});
