/** @jest-environment jsdom */
import { VideoController } from "./videocontroller";
import Emitter from "@3emitter";
import * as constants from "@3constants";

jest.mock("@3emitter", () => new (require("events").EventEmitter)(), {
    virtual: true,
});
jest.mock(
    "@3events",
    () => ({ PLAY: "play", PAUSE: "pause", PRE_UPDATE: "update" }),
    { virtual: true }
);
jest.mock("@3camera", () => ({}), { virtual: true });
jest.mock(
    "@3constants",
    () => {
        const state = {
            EDIT_MODE: false,
            IS_RECORDING: false,
            MAX_PLAY_DISTANCE_SQ: 100,
            VIDEO_PLAYBACK_TYPES: { AUTO: "auto", MANUAL: "manual" },
        };
        state.USER_INTERACTED = new Promise((resolve) => {
            state.interact = resolve;
        });
        return state;
    },
    { virtual: true }
);
jest.mock("@utils/js", () => ({ noop: () => {} }));
jest.mock("../abstract", () => ({ SpaceArtwork: class {} }));

function media() {
    const video = document.createElement("video");
    video.src = "https://example.com/artwork.mp4";
    video.pause = jest.fn();
    video.play = jest.fn().mockResolvedValue(undefined);
    video.load = jest.fn();
    return video;
}
function controller(video) {
    return new VideoController({ video, mesh: { parent: {} } });
}
afterEach(() => {
    Emitter.removeAllListeners();
    jest.restoreAllMocks();
});

test("leaving a space with an unavailable video completes cleanup", () => {
    const control = controller(null);
    expect(() => control.dispose()).not.toThrow();
    expect(control.wasDisposed).toBe(true);
    expect(control.mesh).toBeNull();
    expect(() => control.dispose()).not.toThrow();
});

test("repeated cleanup releases media and subscriptions only once", () => {
    const video = media();
    const control = controller(video);
    control.addEvents();
    expect(Emitter.listenerCount("update")).toBe(1);
    control.dispose();
    control.dispose();
    expect(video.pause).toHaveBeenCalledTimes(1);
    expect(video.getAttribute("src")).toBeNull();
    expect(video.srcObject).toBeNull();
    expect(control.video).toBeNull();
    expect(control.mesh).toBeNull();
    expect(Emitter.listenerCount("update")).toBe(0);
});

test("late playback and seek callbacks cannot restart or reattach disposed media", async () => {
    const video = media();
    const control = controller(video);
    control.dispose();
    await expect(control.play()).resolves.toBeUndefined();
    await expect(control.pause()).resolves.toBeUndefined();
    await expect(control.onStateChange()).resolves.toBeUndefined();
    expect(() => control.seek(10)).not.toThrow();
    control.handleClick();
    control.addEvents();
    control.setVideo(media());
    expect(control.video).toBeNull();
    expect(control.getCurrentTime()).toBe(-1);
    expect(video.play).not.toHaveBeenCalled();
    expect(Emitter.listenerCount("update")).toBe(0);
});

test("a seek that finishes starting playback after exit does not touch released media", async () => {
    const video = media();
    let played;
    video.play.mockImplementation(
        () =>
            new Promise((resolve) => {
                played = resolve;
            })
    );
    const control = controller(video);
    const seek = jest.spyOn(control, "_setHTMLVideoCurrentTime");
    const pending = control.cinematic_seek(5);
    control.dispose();
    played();
    await expect(pending).resolves.toBe(false);
    expect(seek).not.toHaveBeenCalled();
});

test("interaction permission arriving after exit cannot unmute released media", async () => {
    const video = media();
    const control = controller(video);
    expect(video.muted).toBe(true);
    control.dispose();
    constants.interact();
    await constants.USER_INTERACTED;
    expect(video.muted).toBe(true);
});

test("ordinary playback and source replacement still work", async () => {
    const first = media();
    first.currentTime = 12;
    const control = controller(first);
    await control.play();
    expect(first.play).toHaveBeenCalledTimes(1);
    Object.defineProperty(first, "paused", {
        configurable: true,
        value: false,
    });
    await control.pause();
    expect(first.pause).toHaveBeenCalledTimes(1);
    const next = media();
    control.setVideo(next);
    expect(next.currentTime).toBe(12);
    expect(control.video).toBe(next);
    expect(first.getAttribute("src")).toBeNull();
    control.setVideo(next);
    expect(next.pause).not.toHaveBeenCalled();
    control.dispose();
});

test("cleanup also supports the embedded video player adapter", () => {
    const video = { pause: jest.fn(), src: "embed", currentTime: 0 };
    const control = controller(video);
    control.dispose();
    expect(video.pause).toHaveBeenCalledTimes(1);
    expect(video.src).toBeNull();
});

test("pending seek listeners settle and detach when leaving", async () => {
    const video = media();
    Object.defineProperty(video, "paused", { value: false });
    const control = controller(video);
    const remove = jest.spyOn(video, "removeEventListener");
    const pending = control.seek(4);
    expect(control.pendingSeeks.size).toBe(1);
    control.dispose();
    await expect(pending).resolves.toBeUndefined();
    expect(control.pendingSeeks.size).toBe(0);
    expect(remove).toHaveBeenCalledWith("seeked", expect.any(Function));
});

test("a blob download completing after exit cannot attach a new source", async () => {
    const originalFetch = global.fetch;
    let finish;
    global.fetch = jest.fn(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            })
    );
    const originalCreate = window.URL.createObjectURL;
    window.URL.createObjectURL = jest.fn();
    try {
        const video = media();
        const control = controller(video);
        const pending = control.loadBlob();
        const signal = global.fetch.mock.calls[0][1].signal;
        control.dispose();
        expect(signal.aborted).toBe(true);
        finish({ blob: async () => new Blob(["video"]) });
        await pending;
        expect(window.URL.createObjectURL).not.toHaveBeenCalled();
        expect(video.getAttribute("src")).toBeNull();
    } finally {
        global.fetch = originalFetch;
        window.URL.createObjectURL = originalCreate;
    }
});

test("exit revokes controller-owned blob URLs and cancels their capture timer", async () => {
    jest.useFakeTimers();
    const originalFetch = global.fetch;
    const originalCreate = window.URL.createObjectURL;
    const originalRevoke = window.URL.revokeObjectURL;
    global.fetch = jest
        .fn()
        .mockResolvedValue({ blob: async () => new Blob(["video"]) });
    let created;
    const createdUrl = new Promise((resolve) => {
        created = resolve;
    });
    window.URL.createObjectURL = jest.fn(() => {
        created();
        return "blob:video-capture";
    });
    window.URL.revokeObjectURL = jest.fn();
    try {
        const video = media();
        const control = controller(video);
        const pending = control.loadBlob();
        await createdUrl;
        expect(video.getAttribute("src")).toBe("blob:video-capture");
        control.dispose();
        await pending;
        expect(window.URL.revokeObjectURL).toHaveBeenCalledWith(
            "blob:video-capture"
        );
        expect(jest.getTimerCount()).toBe(0);
    } finally {
        jest.useRealTimers();
        global.fetch = originalFetch;
        window.URL.createObjectURL = originalCreate;
        window.URL.revokeObjectURL = originalRevoke;
    }
});
