/** @jest-environment jsdom */

jest.mock("@3constants", () => ({ PIPE_LINE_STATE: {} }), { virtual: true });
jest.mock("@3factory/artwork/controllers/videocontroller", () => ({}), {
    virtual: true,
});
jest.mock("@3factory/artwork/controllers/audiocontroller", () => ({}), {
    virtual: true,
});
jest.mock("@components/_3DExhibit-v2/three/utils/spaceutils", () => ({}));
jest.mock("@components/_3DExhibit-v2/three/constants", () => ({}));
jest.mock("../controllers/pseudoaudiocontroller", () => ({}));
jest.mock("../controllers/players", () => ({}));
jest.mock("@3renderer", () => ({}), { virtual: true });

import { ThreeVideoTexture } from "./ThreeVideoTexture";
import { VideoTexture } from "./videotexture";

function media(withFrameCallbacks = true) {
    const video = {
        readyState: 2,
        HAVE_CURRENT_DATA: 2,
        paused: false,
        ended: false,
    };
    if (withFrameCallbacks) {
        let handle = 0;
        video.requestVideoFrameCallback = jest.fn(() => handle++);
        video.cancelVideoFrameCallback = jest.fn();
    }
    return video;
}

describe.each([
    ["base texture", (video) => new ThreeVideoTexture(video)],
    ["gallery texture", (video) => new VideoTexture({ video, item: {} })],
])("%s leaving a space", (_, createTexture) => {
    test("releases the GPU texture and cancels its pending frame exactly once", () => {
        const video = media();
        const texture = createTexture(video);
        const disposed = jest.fn();
        texture.addEventListener("dispose", disposed);

        texture.dispose();
        texture.dispose();

        expect(video.cancelVideoFrameCallback).toHaveBeenCalledTimes(1);
        expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(0);
        expect(disposed).toHaveBeenCalledTimes(1);
    });

    test("a frame already queued at exit cannot restart updates", () => {
        const video = media();
        const texture = createTexture(video);
        const queued = video.requestVideoFrameCallback.mock.calls[0][0];
        const error = jest.spyOn(console, "error").mockImplementation(() => {});
        texture.dispose();
        texture.image = null;

        expect(() => queued()).not.toThrow();
        expect(() => texture.update()).not.toThrow();
        expect(video.requestVideoFrameCallback).toHaveBeenCalledTimes(1);
        expect(texture.version).toBe(0);
        expect(error).not.toHaveBeenCalled();
        error.mockRestore();
    });

    test("missing media can be updated and disposed safely", () => {
        const texture = createTexture(null);
        const disposed = jest.fn();
        texture.addEventListener("dispose", disposed);

        expect(() => texture.update()).not.toThrow();
        expect(() => texture.updateWithCallback()).not.toThrow();
        expect(() => texture.dispose()).not.toThrow();
        expect(disposed).toHaveBeenCalledTimes(1);
    });

    test("cancels the original video callback when the texture source is cleared", () => {
        const video = media();
        const texture = createTexture(video);
        texture.image = null;

        texture.dispose();

        expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(0);
    });

    test("a queued frame stops scheduling if its source disappears", () => {
        const video = media();
        const texture = createTexture(video);
        const queued = video.requestVideoFrameCallback.mock.calls[0][0];
        texture.image = null;

        expect(() => queued()).not.toThrow();
        expect(video.requestVideoFrameCallback).toHaveBeenCalledTimes(1);
        expect(() => texture.dispose()).not.toThrow();
    });

    test("active playback schedules the next frame and cleans up its latest handle", () => {
        const video = media();
        const texture = createTexture(video);
        video.requestVideoFrameCallback.mock.calls[0][0]();
        expect(texture.version).toBe(1);
        expect(video.requestVideoFrameCallback).toHaveBeenCalledTimes(2);

        texture.dispose();

        expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(1);
    });

    test("fallback updates stop after disposal without frame callback support", () => {
        const texture = createTexture(media(false));
        texture.update();
        expect(texture.version).toBe(1);

        texture.dispose();
        texture.update();

        expect(texture.version).toBe(1);
    });
});

test("gallery texture cleanup releases both controllers once", () => {
    const texture = new VideoTexture({ video: media(), item: {} });
    const videoController = { dispose: jest.fn() };
    const audioController = { dispose: jest.fn() };
    texture.videoController = videoController;
    texture.audioController = audioController;

    texture.dispose();
    texture.dispose();

    expect(videoController.dispose).toHaveBeenCalledTimes(1);
    expect(audioController.dispose).toHaveBeenCalledTimes(1);
    expect(texture.videoController).toBeNull();
    expect(texture.audioController).toBeNull();
});
