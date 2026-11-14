import assert from "node:assert/strict";
import test from "node:test";
import { RuntimeSession } from "../src/index.ts";
import {
    bindPausing,
    createPausing,
    sessionPausing,
    simulateMissed,
} from "../src/pausing.ts";

function make(mode) {
    const events = [];
    let clock = 0,
        timer = null;
    const state = { mode };
    const pausing = createPausing({
        mode: () => state.mode,
        now: () => clock,
        pause: (reason) => events.push(`pause:${reason}`),
        resume: (info) => events.push(`resume:${info.reason}:${info.awayMs}`),
        catchUp: (seconds) => events.push(`catchUp:${seconds}`),
        every: (tick) => {
            timer = tick;
            return () => {
                timer = null;
            };
        },
    });
    return {
        pausing,
        events,
        state,
        advance: (ms) => {
            clock += ms;
        },
        tick: () => timer?.(),
        get timer() {
            return timer;
        },
    };
}

test("a solo game pauses on the first reason and resumes when the last one is gone", () => {
    const f = make("solo");
    f.pausing.hold("hidden");
    f.pausing.hold("hidden");
    f.pausing.hold("menu");
    assert.equal(f.pausing.paused, true);
    f.advance(4000);
    f.pausing.release("hidden");
    assert.equal(f.pausing.paused, true, "the menu is still open");
    f.advance(1000);
    f.pausing.release("menu");
    f.pausing.release("menu");
    assert.deepEqual(f.events, ["pause:hidden", "resume:menu:5000"]);
    assert.deepEqual(f.pausing.report(), {
        mode: "solo",
        paused: false,
        reasons: [],
        pauses: 1,
        resumes: 1,
        caughtUp: 0,
        fingerprint: null,
    });
    f.pausing.hold("nonsense");
    assert.equal(f.pausing.paused, false);
});

test("a multiplayer match does not pause: it keeps simulating while hidden and catches up", () => {
    const f = make("multiplayer");
    f.pausing.hold("menu");
    assert.equal(f.pausing.paused, false);
    assert.equal(f.timer, null);
    f.pausing.hold("hidden");
    assert.equal(f.pausing.paused, false);
    f.advance(1000);
    f.tick();
    f.advance(1000);
    f.tick();
    f.advance(400);
    f.pausing.release("hidden");
    assert.deepEqual(f.events, ["catchUp:1", "catchUp:1", "catchUp:0.4"]);
    assert.equal(f.timer, null, "the timer stops with the reason");
    assert.equal(f.pausing.report().caughtUp, 2.4);
    f.pausing.release("menu");
    assert.equal(f.events.length, 3, "nothing to resume");
});

test("a game that was solo when it paused still resumes after a match starts", () => {
    const f = make("solo");
    f.pausing.hold("menu");
    f.state.mode = "multiplayer";
    f.pausing.hold("hidden");
    f.advance(500);
    f.pausing.release("hidden");
    f.pausing.release("menu");
    assert.deepEqual(f.events, ["pause:menu", "resume:menu:500"]);
});

test("missed time is simulated in bounded steps", () => {
    const steps = [];
    assert.equal(
        simulateMissed(0.25, (s) => steps.push(s), 0.1),
        0.25
    );
    assert.equal(steps.length, 3);
    assert.ok(Math.abs(steps[2] - 0.05) < 1e-9);
    let count = 0;
    assert.equal(
        simulateMissed(3600, () => count++, 0.1, 10),
        10
    );
    assert.equal(count, 100);
    assert.equal(
        simulateMissed(-1, () => count++),
        0
    );
});

test("the tab's visibility and the page's menu messages drive the pauses", () => {
    const f = make("solo");
    const listeners = {};
    const on = (type, l) => {
            listeners[type] = l;
        },
        off = (type) => {
            delete listeners[type];
        };
    const parent = {};
    const document = {
        hidden: false,
        addEventListener: on,
        removeEventListener: off,
    };
    const window = { parent, addEventListener: on, removeEventListener: off };
    const stop = bindPausing(f.pausing, { prefix: "ace:", document, window });
    document.hidden = true;
    listeners.visibilitychange();
    document.hidden = false;
    listeners.visibilitychange();
    listeners.message({
        source: {},
        data: { type: "ace:pause", reason: "menu" },
    }); // not the page
    listeners.message({
        source: parent,
        data: { type: "ace:pause", reason: "hidden" },
    }); // not the page's to say
    listeners.message({
        source: parent,
        data: { type: "garden:pause", reason: "menu" },
    });
    assert.equal(f.pausing.paused, false);
    listeners.message({
        source: parent,
        data: { type: "ace:pause", reason: "menu" },
    });
    assert.equal(f.pausing.paused, true);
    listeners.message({
        source: parent,
        data: { type: "ace:resume", reason: "menu" },
    });
    assert.deepEqual(f.events, [
        "pause:hidden",
        "resume:hidden:0",
        "pause:menu",
        "resume:menu:0",
    ]);
    stop();
    assert.deepEqual(listeners, {});
});

const continuity = {
    avatar: { id: "v", position: [0, 0, 0], rotation: [0, 0, 0, 1] },
    camera: {
        position: [0, 1, 2],
        target: [0, 1, 0],
        fov: 50,
        mode: "third-person",
    },
    party: [],
};
async function session() {
    const events = [];
    let time = 0;
    const s = new RuntimeSession(
        () => ({
            async prepare() {},
            enter() {},
            update(seconds) {
                time += seconds;
            },
            suspend() {
                events.push("suspend");
                return { time };
            },
            restore(v) {
                time = v.time;
                events.push("restore");
            },
            dispose() {},
            inspect() {
                return { time: Math.round(time * 100) / 100 };
            },
        }),
        {
            manifest: { input: {}, assets: [], capabilities: [] },
            graphics: {},
            services: {
                identity: { id: "v", name: "V" },
                asset: async () => new ArrayBuffer(0),
                call: async () => null,
            },
            sendUI() {},
        }
    );
    await s.prepare();
    await s.enter(continuity);
    return { s, events };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

test("solo pauses are suspend() and restore(), in order, and the state holds", async () => {
    const { s, events } = await session();
    const pausing = sessionPausing(s, { mode: "solo" });
    s.tick(0.05);
    // A quick hide and show must not leave the session half way.
    pausing.hold("hidden");
    pausing.release("hidden");
    pausing.hold("menu");
    await settle();
    assert.equal(s.phase, "suspended");
    const held = pausing.report().fingerprint;
    s.tick(0.05);
    s.tick(0.05);
    assert.deepEqual(
        pausing.report().fingerprint,
        held,
        "nothing moves while paused"
    );
    pausing.release("menu");
    await settle();
    assert.equal(s.phase, "entered");
    assert.deepEqual(events, ["suspend", "restore", "suspend", "restore"]);
    s.tick(0.05);
    assert.notDeepEqual(pausing.report().fingerprint, held);
    await s.dispose();
});

test("a multiplayer session is never suspended and is ticked through the time it missed", async () => {
    const { s, events } = await session();
    let clock = 0,
        timer = null;
    const pausing = sessionPausing(s, {
        mode: "multiplayer",
        now: () => clock,
        every: (tick) => {
            timer = tick;
            return () => {
                timer = null;
            };
        },
    });
    pausing.hold("hidden");
    pausing.hold("menu");
    clock += 1000;
    timer();
    clock += 500;
    pausing.release("hidden");
    await settle();
    assert.equal(s.phase, "entered");
    assert.deepEqual(events, []);
    assert.equal(s.inspect().time, 1.5);
    await s.dispose();
});
