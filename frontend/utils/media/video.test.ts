/** @jest-environment jsdom */
import {
    loadArtworkHlsVideo,
    loadArtworkVideoElement,
    releaseArtworkVideo,
} from "./video";
import { VideoController } from "../../components/_3DExhibit-v2/three/factory/artwork/controllers/videocontroller";

const mockInstances: any[] = [];
jest.mock("hls.js", () => ({
    __esModule: true,
    default: class {
        static isSupported = () => true;
        static Events = { ERROR: "error", MEDIA_ATTACHED: "attached" };
        listeners = new Map<string, Function>();
        destroy = jest.fn(() => this.listeners.clear());
        loadSource = jest.fn();
        attachMedia = jest.fn();
        on = (name: string, fn: Function) => this.listeners.set(name, fn);
        off = (name: string) => this.listeners.delete(name);
        constructor() {
            mockInstances.push(this);
        }
    },
}));
jest.mock("@3emitter", () => ({ off: jest.fn() }), { virtual: true });
jest.mock("@3events", () => ({}), { virtual: true });
jest.mock("@3camera", () => ({}), { virtual: true });
jest.mock(
    "@3constants",
    () => ({
        USER_INTERACTED: Promise.resolve(),
        VIDEO_PLAYBACK_TYPES: { AUTO: "auto" },
    }),
    { virtual: true }
);
jest.mock("@utils/js", () => ({ noop: () => {} }));
jest.mock(
    "../../components/_3DExhibit-v2/three/factory/artwork/abstract",
    () => ({ SpaceArtwork: class {} })
);

function media() {
    const video = document.createElement("video");
    video.pause = jest.fn();
    video.load = jest.fn();
    return video;
}
const flush = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
};
afterEach(() => {
    mockInstances.length = 0;
    jest.restoreAllMocks();
});

test("successful video loading removes listeners and later cancellation doesn't touch the owned player", async () => {
    const video = media(),
        controller = new AbortController();
    const remove = jest.spyOn(controller.signal, "removeEventListener");
    const pending = loadArtworkVideoElement(
        "/art.mp4",
        video,
        controller.signal
    );
    video.dispatchEvent(new Event("loadeddata"));
    await expect(pending).resolves.toBe(video);
    expect(video.onerror).toBeNull();
    expect(video.onloadeddata).toBeNull();
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    controller.abort();
    expect(video.pause).not.toHaveBeenCalled();
    releaseArtworkVideo(video);
    expect(video.getAttribute("src")).toBeNull();
});

test.each(["abort", "error", "already-aborted"])(
    "failed video loading releases media: %s",
    async (reason) => {
        const video = media(),
            controller = new AbortController();
        if (reason === "already-aborted") controller.abort();
        const pending = loadArtworkVideoElement(
            "/art.mp4",
            video,
            controller.signal
        );
        const failed = expect(pending).rejects.toBeInstanceOf(Error);
        if (reason === "abort") controller.abort();
        if (reason === "error") video.dispatchEvent(new Event("error"));
        await failed;
        expect(video.pause).toHaveBeenCalledTimes(1);
        expect(video.getAttribute("src")).toBeNull();
        expect(video.onerror).toBeNull();
        expect(video.onloadeddata).toBeNull();
    }
);

test("repeated HLS artwork removal destroys each stream once after successful loading", async () => {
    for (let trip = 0; trip < 20; trip++) {
        const video = media(),
            controller = new AbortController();
        const pending = loadArtworkHlsVideo(
            "/art.m3u8",
            video,
            controller.signal
        );
        await flush();
        const hls = mockInstances.at(-1);
        hls.listeners.get("attached")();
        await expect(pending).resolves.toBe(video);
        controller.abort();
        expect(hls.destroy).not.toHaveBeenCalled();
        const owner = new VideoController({
            video,
            mesh: { parent: {} } as any,
        });
        owner.dispose();
        owner.dispose();
        expect(hls.destroy).toHaveBeenCalledTimes(1);
        expect(hls.listeners.size).toBe(0);
        expect(video.getAttribute("src")).toBeNull();
    }
});

test("replacing HLS artwork releases the old stream and keeps the new one alive", async () => {
    const videos = [media(), media()];
    for (const video of videos) {
        const pending = loadArtworkHlsVideo("/art.m3u8", video);
        await flush();
        mockInstances.at(-1).listeners.get("attached")();
        await pending;
    }
    const owner = new VideoController({
        video: videos[0],
        mesh: { parent: {} } as any,
    });
    owner.setVideo(videos[1]);
    expect(mockInstances[0].destroy).toHaveBeenCalledTimes(1);
    expect(mockInstances[1].destroy).not.toHaveBeenCalled();
    owner.dispose();
    expect(mockInstances[1].destroy).toHaveBeenCalledTimes(1);
});

test.each(["abort", "fatal"])(
    "HLS failure before attachment releases listeners and worker: %s",
    async (reason) => {
        const video = media(),
            controller = new AbortController();
        const pending = loadArtworkHlsVideo(
            "/art.m3u8",
            video,
            controller.signal
        );
        const failed = expect(pending).rejects.toBeInstanceOf(Error);
        await flush();
        const hls = mockInstances.at(-1);
        if (reason === "abort") controller.abort();
        else hls.listeners.get("error")("error", { fatal: true });
        await failed;
        releaseArtworkVideo(video);
        expect(hls.destroy).toHaveBeenCalledTimes(1);
        expect(hls.listeners.size).toBe(0);
    }
);

test("HLS fatal errors after attachment stop playback without retaining the worker", async () => {
    const video = media();
    const pending = loadArtworkHlsVideo("/art.m3u8", video);
    await flush();
    const hls = mockInstances.at(-1);
    hls.listeners.get("attached")();
    await pending;
    hls.listeners.get("error")("error", { fatal: true });
    releaseArtworkVideo(video);
    expect(hls.destroy).toHaveBeenCalledTimes(1);
});
