import EventEmitter from "events/events.js";
import { installStableEmit } from "./stableemit";

function make() {
    EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
    return installStableEmit(new EventEmitter());
}

test("listeners get the arguments the emit was given, as many as given", () => {
    const emitter = make();
    const seen = [];
    emitter.on("frame", function (...args) {
        seen.push([this, args]);
    });
    emitter.on("frame", (...args) => seen.push(args.length));
    expect(emitter.emit("frame")).toBe(true);
    emitter.emit("frame", 1, 2, 3, 4);
    emitter.emit("frame", 1, 2, 3, 4, 5, 6);
    expect(seen).toEqual([
        [emitter, []],
        0,
        [emitter, [1, 2, 3, 4]],
        4,
        [emitter, [1, 2, 3, 4, 5, 6]],
        6,
    ]);
    expect(emitter.emit("nobody")).toBe(false);
});

test("a frame of emits reuses one copy of the listeners", () => {
    const emitter = make();
    for (let i = 0; i < 300; i++) emitter.on("post_update", () => {});
    const slice = jest.spyOn(Array.prototype, "slice");
    try {
        for (let frame = 0; frame < 60; frame++) emitter.emit("post_update");
        expect(slice).toHaveBeenCalledTimes(1);
    } finally {
        slice.mockRestore();
    }
});

test("listeners removed or added during an emit do not change that emit", () => {
    const emitter = make();
    const calls = [];
    const late = () => calls.push("late");
    const second = () => calls.push("second");
    emitter.on("frame", () => {
        calls.push("first");
        emitter.off("frame", second);
        emitter.on("frame", late);
    });
    emitter.on("frame", second);
    emitter.emit("frame");
    expect(calls).toEqual(["first", "second"]);
    calls.length = 0;
    emitter.emit("frame");
    expect(calls).toEqual(["first", "late"]);
});

test("once, prepend, on_prior style binding and removeAllListeners still work", () => {
    const emitter = make();
    const calls = [];
    emitter.on("frame", () => calls.push("on"));
    emitter.once("frame", () => calls.push("once"));
    const prior = emitter.prependListener.bind(emitter);
    prior("frame", () => calls.push("prior"));
    emitter.emit("frame");
    emitter.emit("frame");
    expect(calls).toEqual(["prior", "on", "once", "prior", "on"]);
    emitter.removeAllListeners("frame");
    expect(emitter.emit("frame")).toBe(false);
});

test("a removed listener is not kept alive by a cached copy", () => {
    const emitter = make();
    const a = jest.fn(),
        b = jest.fn();
    emitter.on("rare", a);
    emitter.on("rare", b);
    emitter.emit("rare");
    emitter.off("rare", a);
    emitter.emit("rare");
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
});

test("an unhandled error event still throws", () => {
    const emitter = make();
    expect(() => emitter.emit("error", new Error("boom"))).toThrow("boom");
});
