import assert from "node:assert/strict";
import test from "node:test";
import {
    answerHudRequests,
    findHudOverlaps,
    hudRects,
    outsideSafeArea,
    readHudRects,
    readSafeInsets,
    requestHud,
    watchSafeArea,
} from "../src/safe-area.ts";

/** A window stand-in: a message target with a parent and a root element. */
function fakeWindow() {
    const variables = {};
    const parent = {
        sent: [],
        postMessage(message) {
            this.sent.push(message);
        },
    };
    const view = Object.assign(new EventTarget(), {
        parent,
        innerWidth: 800,
        innerHeight: 600,
        document: {
            documentElement: {
                style: {
                    setProperty: (name, value) => {
                        variables[name] = value;
                    },
                },
            },
        },
    });
    const receive = (source, data) =>
        view.dispatchEvent(
            Object.assign(new Event("message"), { source, data })
        );
    return { view, parent, variables, receive };
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("insets are whole, non-negative pixels or nothing", () => {
    assert.deepEqual(
        readSafeInsets({ top: 57.2, right: 0, bottom: -4, left: 1e9 }),
        { top: 58, right: 0, bottom: 0, left: 4096 }
    );
    assert.equal(readSafeInsets({ top: 1, right: 2, bottom: 3 }), null);
    assert.equal(
        readSafeInsets({ top: "1", right: 2, bottom: 3, left: 4 }),
        null
    );
    assert.equal(
        readSafeInsets({ top: NaN, right: 2, bottom: 3, left: 4 }),
        null
    );
    assert.equal(readSafeInsets(null), null);
});

test("the watcher sets CSS variables from the page's message and only the page's", () => {
    const { view, parent, variables, receive } = fakeWindow();
    const changes = [];
    const watch = watchSafeArea({
        game: "ace",
        window: view,
        onChange: (insets) => changes.push(insets),
    });
    assert.equal(variables["--oncyber-safe-top"], "0px");
    receive(
        {},
        {
            type: "ace:safe-area",
            insets: { top: 50, right: 0, bottom: 0, left: 0 },
        }
    );
    receive(parent, {
        type: "garden:safe-area",
        insets: { top: 50, right: 0, bottom: 0, left: 0 },
    });
    receive(parent, { type: "ace:safe-area", insets: { top: "50" } });
    assert.deepEqual(changes, []);
    receive(parent, {
        type: "ace:safe-area",
        insets: { top: 58, right: 0, bottom: 64, left: 0 },
    });
    receive(parent, {
        type: "ace:safe-area",
        insets: { top: 58, right: 0, bottom: 64, left: 0 },
    });
    assert.deepEqual(changes, [{ top: 58, right: 0, bottom: 64, left: 0 }]);
    assert.deepEqual(watch.insets, { top: 58, right: 0, bottom: 64, left: 0 });
    assert.equal(variables["--oncyber-safe-top"], "58px");
    assert.equal(variables["--oncyber-safe-bottom"], "64px");
    assert.equal(variables["--oncyber-safe-left"], "0px");
    watch.dispose();
    receive(parent, {
        type: "ace:safe-area",
        insets: { top: 1, right: 1, bottom: 1, left: 1 },
    });
    assert.equal(watch.insets.top, 58);
});

test("the watcher relays insets to the game's UI frame, which reads them without a game id", () => {
    const host = fakeWindow();
    const ui = fakeWindow();
    // The UI frame's window: what the host posts arrives as a message from its parent.
    const frame = Object.assign(new EventTarget(), {
        contentWindow: {
            postMessage: (message) => ui.receive(ui.parent, message),
        },
    });
    watchSafeArea({ game: "garden", window: host.view, relay: [frame] });
    const inner = watchSafeArea({ window: ui.view });
    host.receive(host.parent, {
        type: "garden:safe-area",
        insets: { top: 58, right: 0, bottom: 0, left: 0 },
    });
    assert.equal(inner.insets.top, 58);
    assert.equal(ui.variables["--oncyber-safe-top"], "58px");
    // A frame that loads after the insets arrived gets them on load.
    ui.variables["--oncyber-safe-top"] = "stale";
    const late = fakeWindow();
    frame.contentWindow = {
        postMessage: (message) => late.receive(late.parent, message),
    };
    const lateWatch = watchSafeArea({ window: late.view });
    frame.dispatchEvent(new Event("load"));
    assert.equal(lateWatch.insets.top, 58);
});

test("a game on its own (no parent page) keeps zero insets", () => {
    const { view, receive, variables } = fakeWindow();
    view.parent = view;
    const watch = watchSafeArea({ game: "ace", window: view });
    receive(view, {
        type: "ace:safe-area",
        insets: { top: 9, right: 9, bottom: 9, left: 9 },
    });
    assert.deepEqual(watch.insets, { top: 0, right: 0, bottom: 0, left: 0 });
    assert.equal(variables["--oncyber-safe-right"], "0px");
});

test("hudRects lists laid-out elements by data-hud name or id", () => {
    const element = (attributes, box) => ({
        id: attributes.id ?? "",
        getAttribute: (name) => attributes[name] ?? null,
        getBoundingClientRect: () => ({
            left: box[0],
            top: box[1],
            width: box[2],
            height: box[3],
        }),
    });
    const root = {
        querySelectorAll: (selector) => {
            assert.equal(selector, "[data-hud]");
            return [
                element({ "data-hud": "score" }, [16, 74.04, 200, 90]),
                element({ "data-hud": "", id: "pause-btn" }, [740, 74, 44, 44]),
                element({ "data-hud": "hidden" }, [0, 0, 0, 0]),
                element({ "data-hud": "" }, [1, 2, 3, 4]),
            ];
        },
    };
    assert.deepEqual(hudRects(root), [
        { id: "score", x: 16, y: 74, width: 200, height: 90 },
        { id: "pause-btn", x: 740, y: 74, width: 44, height: 44 },
        { id: "hud-3", x: 1, y: 2, width: 3, height: 4 },
    ]);
});

test("HUD rectangles from inspect() are validated", () => {
    assert.deepEqual(
        readHudRects([
            { id: "a", x: 0, y: 0, width: 10, height: 10 },
            { id: "bad", x: "0", y: 0, width: 10, height: 10 },
            { x: 5, y: 5, width: 0, height: 10 },
            null,
            { x: 5, y: 5, width: 2, height: 2 },
        ]),
        [
            { id: "a", x: 0, y: 0, width: 10, height: 10 },
            { id: "hud-1", x: 5, y: 5, width: 2, height: 2 },
        ]
    );
    assert.deepEqual(readHudRects("nope"), []);
});

test("overlaps: sharing pixels fails, touching edges does not", () => {
    const overlays = [{ id: "controls", x: 20, y: 14, width: 250, height: 44 }];
    assert.deepEqual(
        findHudOverlaps(
            [{ id: "score", x: 16, y: 16, width: 200, height: 90 }],
            overlays
        ),
        [{ hud: "score", overlay: "controls", area: 196 * 42 }]
    );
    assert.deepEqual(
        findHudOverlaps(
            [{ id: "score", x: 16, y: 58, width: 200, height: 90 }],
            overlays
        ),
        []
    );
    assert.deepEqual(
        findHudOverlaps(
            [{ id: "pause", x: 270, y: 14, width: 44, height: 44 }],
            overlays
        ),
        []
    );
    // A rounding sliver is not an overlap.
    assert.deepEqual(
        findHudOverlaps(
            [{ id: "score", x: 16, y: 57.4, width: 200, height: 90 }],
            overlays
        ),
        []
    );
});

test("outsideSafeArea names what crosses an inset", () => {
    const insets = { top: 58, right: 0, bottom: 64, left: 0 };
    assert.deepEqual(
        outsideSafeArea(
            [
                { id: "in", x: 16, y: 58, width: 100, height: 40 },
                { id: "high", x: 16, y: 20, width: 100, height: 40 },
                { id: "low", x: 16, y: 520, width: 100, height: 40 },
            ],
            insets,
            800,
            600
        ),
        ["high", "low"]
    );
});

test("a game answers HUD requests from its parent with inspect().hud", async () => {
    const { view, parent, receive } = fakeWindow();
    const stop = answerHudRequests(
        () => ({
            screen: "hud",
            hud: [
                { id: "score", x: 1, y: 2, width: 3, height: 4 },
                { junk: true },
            ],
        }),
        {
            window: view,
            insets: () => ({ top: 58, right: 0, bottom: 0, left: 0 }),
        }
    );
    receive(
        {
            postMessage() {
                assert.fail("answered a stranger");
            },
        },
        { type: "oncyber:hud-request", request: "x" }
    );
    receive(parent, { type: "oncyber:hud-request", request: "r1" });
    await tick();
    assert.deepEqual(parent.sent, [
        {
            type: "oncyber:hud-report",
            request: "r1",
            hud: [{ id: "score", x: 1, y: 2, width: 3, height: 4 }],
            insets: { top: 58, right: 0, bottom: 0, left: 0 },
            width: 800,
            height: 600,
        },
    ]);
    stop();
    receive(parent, { type: "oncyber:hud-request", request: "r2" });
    await tick();
    assert.equal(parent.sent.length, 1);
});

test("a throwing inspect() still answers, with no rectangles", async () => {
    const { view, parent, receive } = fakeWindow();
    answerHudRequests(
        () => {
            throw new Error("boom");
        },
        { window: view }
    );
    receive(parent, { type: "oncyber:hud-request", request: "r" });
    await tick();
    assert.deepEqual(parent.sent[0].hud, []);
});

test("a host asks its UI frame for HUD rectangles and gives up after the timeout", async () => {
    const { view, receive } = fakeWindow();
    const asked = [];
    const frame = {
        contentWindow: { postMessage: (message) => asked.push(message) },
    };
    const pending = requestHud(frame, { window: view, timeoutMs: 200 });
    assert.equal(asked[0].type, "oncyber:hud-request");
    receive(frame.contentWindow, {
        type: "oncyber:hud-report",
        request: "other",
        hud: [{ id: "x", x: 0, y: 0, width: 1, height: 1 }],
    });
    receive(frame.contentWindow, {
        type: "oncyber:hud-report",
        request: asked[0].request,
        hud: [{ id: "chip", x: 0, y: 0, width: 5, height: 5 }],
    });
    assert.deepEqual(await pending, [
        { id: "chip", x: 0, y: 0, width: 5, height: 5 },
    ]);
    assert.deepEqual(
        await requestHud(frame, { window: view, timeoutMs: 10 }),
        []
    );
});
