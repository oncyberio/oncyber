import assert from "node:assert/strict";
import test from "node:test";
import { createLoading, redrawOnResize } from "../src/loading.ts";

function make(options = {}) {
    const sent = [];
    let clock = 0;
    const loading = createLoading({
        post: (kind, data) => sent.push({ kind, ...data }),
        now: () => clock,
        ...options,
    });
    return {
        loading,
        sent,
        advance: (ms) => {
            clock += ms;
        },
    };
}

test("progress is clamped, never goes down and is rate limited, but the last step always arrives", () => {
    const f = make();
    f.loading.progress(0.2, "Building");
    f.loading.progress(0.3); // inside the 100 ms window
    f.loading.progress(Number.NaN);
    f.loading.progress(-4);
    f.advance(150);
    f.loading.progress(0.1); // lower: keeps 0.3
    f.loading.progress(7); // above 1, and inside the window: still sent
    assert.deepEqual(f.sent, [
        { kind: "progress", value: 0.2, label: "Building" },
        { kind: "progress", value: 0.3, label: "" },
        { kind: "progress", value: 1, label: "" },
    ]);
    assert.equal(f.loading.report().progressMessages, 3);
});

test("the first frame is announced once, with its time and size, and ends progress", () => {
    const f = make();
    f.advance(812.4);
    f.loading.firstFrame({ width: 1280.2, height: 720 });
    f.loading.firstFrame({ width: 1, height: 1 });
    f.loading.progress(0.5);
    assert.deepEqual(f.sent, [
        { kind: "first-frame", ms: 812, width: 1280, height: 720 },
    ]);
    assert.deepEqual(f.loading.report(), {
        progress: 1,
        progressMessages: 0,
        firstFrameMs: 812,
        redraws: 0,
        size: { width: 1280, height: 720 },
    });
});

test("a resize draws in the same task and tells the page the new size", () => {
    const f = make();
    const listeners = new Set();
    let draws = 0;
    const target = {
        innerWidth: 800,
        innerHeight: 600,
        addEventListener: (_, l) => listeners.add(l),
        removeEventListener: (_, l) => listeners.delete(l),
    };
    const stop = redrawOnResize(f.loading, () => draws++, target);
    const resize = () => listeners.forEach((l) => l());
    // Before the first frame the game still draws, but there is nothing to announce.
    resize();
    assert.equal(draws, 1);
    assert.equal(f.sent.length, 0);
    f.loading.firstFrame({ width: 800, height: 600 });
    target.innerWidth = 400;
    resize();
    resize(); // same size: drawn again, announced once
    assert.equal(draws, 3);
    assert.deepEqual(f.sent.at(-1), { kind: "frame", width: 400, height: 600 });
    assert.equal(f.loading.report().redraws, 1);
    stop();
    resize();
    assert.equal(draws, 3);
});

test("the check can read the report from inside the frame", () => {
    const f = make();
    f.loading.progress(0.4);
    assert.equal(globalThis.__oncyberGame.loading().progress, 0.4);
});

test("a lifecycle game reports progress through its context, during prepare only", async () => {
    const { RuntimeSession } = await import("../src/index.ts");
    const seen = [];
    let context;
    const session = new RuntimeSession(
        (ctx) => {
            context = ctx;
            return {
                async prepare() {
                    ctx.loading.progress(0.5, "Half");
                },
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
            };
        },
        {
            manifest: { input: {}, assets: [], capabilities: [] },
            graphics: {},
            services: {
                identity: { id: "v", name: "V" },
                asset: async () => new ArrayBuffer(0),
                call: async () => null,
            },
            sendUI() {},
            onProgress: (value, label) => seen.push([value, label]),
        }
    );
    context.loading.progress(0.1); // not preparing yet
    await session.prepare();
    context.loading.progress(0.9); // already prepared
    assert.deepEqual(seen, [[0.5, "Half"]]);
    await session.dispose();
});
