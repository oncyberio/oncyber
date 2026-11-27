import assert from "node:assert/strict";
import test from "node:test";
import {
    HEALTH_PROBE,
    describeError,
    frameWindows,
    reportHealth,
    summarizeFrames,
} from "../src/health.ts";

/** A stand-in for the frame's window. */
function fakeWindow(search = "") {
    const listeners = new Map(),
        frames = [],
        timers = [];
    const parent = {};
    return {
        parent,
        location: { search },
        frames,
        timers,
        document: {
            hidden: false,
            addEventListener() {},
            removeEventListener() {},
        },
        addEventListener: (type, f) => listeners.set(type, f),
        removeEventListener: (type) => listeners.delete(type),
        requestAnimationFrame: (f) => frames.push(f),
        cancelAnimationFrame() {},
        setTimeout: (f) => timers.push(f),
        fire: (type, event) => listeners.get(type)?.(event),
        has: (type) => listeners.has(type),
        /** Runs animation frames 16 ms apart until `ms`. */
        play(ms, from = 0) {
            for (let now = from; now <= from + ms; now += 16)
                frames.shift()?.(now);
        },
    };
}

test("an error is described by name, short message and file:line, nothing else", () => {
    const error = new TypeError(
        "x is not a function\n  secret " + "y".repeat(400)
    );
    error.stack =
        "TypeError: x\n    at hit (https://oncyber.io/game-builds/ace/assets/index-BU5.js?token=abc:120:14)\n    at frame (https://oncyber.io/a.js:1:1)";
    const described = describeError(error);
    assert.equal(described.message.length, 200);
    assert.match(
        described.message,
        /^TypeError: x is not a function secret y+$/
    );
    assert.equal(described.where, "index-BU5.js:120");
    assert.deepEqual(
        describeError("plain", "https://x.test/game-builds/ace/main.js?v=1", 7),
        { message: "plain", where: "main.js:7" }
    );
    assert.deepEqual(describeError(undefined), {
        message: "unknown error",
        where: "",
    });
});

test("frame windows report median and p95 once per window, and skip thin ones", () => {
    assert.deepEqual(
        summarizeFrames([16, 16, 16, 16, 16, 16, 16, 16, 16, 50]),
        { count: 10, medianMs: 16, p95Ms: 50 }
    );
    const windows = frameWindows(1000);
    let summary = null,
        count = 0;
    for (let now = 0; now <= 2100; now += 20) {
        const s = windows.frame(now);
        if (s) {
            summary = s;
            count++;
        }
    }
    assert.equal(count, 2);
    assert.deepEqual(summary, { count: 50, medianMs: 20, p95Ms: 20 });
    // Ten frames in a window (a throttled tab) are not a measurement.
    const slow = frameWindows(1000);
    for (let now = 0; now <= 1000; now += 100)
        assert.equal(slow.frame(now), null);
});

test("uncaught errors and rejections are reported once each, up to a limit", () => {
    const window = fakeWindow(),
        sent = [];
    const health = reportHealth({
        game: "ace",
        target: window,
        post: (m) => sent.push(m),
    });
    window.fire("error", {
        error: new Error("boom"),
        filename: "https://x.test/game-builds/ace/assets/main.js",
        lineno: 3,
    });
    window.fire("error", { error: new Error("boom") });
    window.fire("unhandledrejection", { reason: new RangeError("late") });
    assert.deepEqual(sent, [
        {
            type: "ace:health",
            kind: "error",
            message: "boom",
            where: "main.js:3",
        },
        {
            type: "ace:health",
            kind: "error",
            message: "RangeError: late",
            where: sent[1].where,
        },
    ]);
    for (let i = 0; i < 30; i++)
        window.fire("error", { error: new Error(`e${i}`) });
    assert.equal(sent.length, 10);
    health.dispose();
    assert.equal(window.has("error"), false);
});

test("a failed lifecycle stage is reported and still thrown", async () => {
    const sent = [];
    const health = reportHealth({
        game: "garden",
        target: fakeWindow(),
        post: (m) => sent.push(m),
    });
    assert.equal(await health.stage("prepare", () => 4), 4);
    await assert.rejects(
        health.stage("enter", async () => {
            throw new Error("RUNTIME_TIMEOUT");
        }),
        /RUNTIME_TIMEOUT/
    );
    health.stageFailed("update", new Error("nan"));
    health.stageFailed("not-a-stage", new Error("ignored"));
    assert.deepEqual(
        sent.map((m) => [m.kind, m.stage, m.message]),
        [
            ["stage", "enter", "RUNTIME_TIMEOUT"],
            ["stage", "update", "nan"],
        ]
    );
});

test("frame times are posted every window while the tab is visible", () => {
    const window = fakeWindow(),
        sent = [];
    reportHealth({
        game: "ace",
        target: window,
        post: (m) => sent.push(m),
        windowMs: 1000,
    });
    window.play(1100);
    assert.deepEqual(sent, [
        {
            type: "ace:health",
            kind: "frames",
            count: 63,
            medianMs: 16,
            p95Ms: 16,
        },
    ]);
    window.document.hidden = true;
    window.play(3000, 1200);
    assert.equal(sent.length, 1);
});

test("the check's probe throws only on a page opened with ?check", () => {
    const live = fakeWindow("");
    reportHealth({ game: "ace", target: live, post() {} });
    live.fire("message", {
        source: live.parent,
        data: { type: "ace:health-probe" },
    });
    assert.equal(live.timers.length, 0);

    const checked = fakeWindow("?check"),
        sent = [];
    reportHealth({ game: "ace", target: checked, post: (m) => sent.push(m) });
    checked.fire("message", { source: {}, data: { type: "ace:health-probe" } });
    assert.equal(checked.timers.length, 0, "only the parent page may ask");
    checked.fire("message", {
        source: checked.parent,
        data: { type: "ace:health-probe" },
    });
    assert.throws(() => checked.timers[0](), new RegExp(HEALTH_PROBE));
    let prevented = false;
    checked.fire("error", {
        error: new Error(HEALTH_PROBE),
        preventDefault: () => (prevented = true),
    });
    assert.equal(sent[0].message, HEALTH_PROBE);
    assert.equal(prevented, true);
});

test("a contract game reports and is probed in the one prefix", () => {
    // No id: a game on the contract speaks `oncyber:game:`. An id is only
    // for a build that still speaks its own prefix (the tests above).
    const window = fakeWindow("?check"),
        sent = [];
    const health = reportHealth({ target: window, post: (m) => sent.push(m) });
    health.stageFailed("prepare", new Error("no court"));
    assert.equal(sent[0].type, "oncyber:game:health");
    window.fire("message", {
        source: window.parent,
        data: { type: "oncyber:game:health-probe" },
    });
    assert.throws(() => window.timers[0](), new RegExp(HEALTH_PROBE));
    // An older build still understands the contract's form of the probe.
    const older = fakeWindow("?check");
    reportHealth({ game: "garden", target: older, post() {} });
    older.fire("message", {
        source: older.parent,
        data: { type: "oncyber:game:health-probe" },
    });
    assert.equal(older.timers.length, 1);
});
