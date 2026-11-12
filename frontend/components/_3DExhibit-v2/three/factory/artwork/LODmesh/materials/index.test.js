jest.mock(
    "@3loader",
    () => ({ __esModule: true, default: { loadVideo: jest.fn() } }),
    { virtual: true }
);
jest.mock(
    "@3utils/mediatype",
    () => ({
        IMAGE_MEDIA: "IMAGE_MEDIA",
        PANORAMA_MEDIA: "PANORAMA_MEDIA",
        VIDEO_MEDIA: "VIDEO_MEDIA",
    }),
    { virtual: true }
);
jest.mock("./imagematerial", () => ({ ImageMaterial: jest.fn() }));
jest.mock("./THREE60Material", () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock("./videomaterial", () => ({
    VideoMaterial: jest.fn().mockImplementation(function (opts) {
        this.opts = opts;
        this.videoTexture = { wasDisposed: false };
        this.updateMedia = jest.fn();
    }),
}));

import Loader from "@3loader";
import { ABORT_MSG } from "@components/_3DExhibit-v2/three/utils/abort";
import { VideoMaterial } from "./videomaterial";
import { ImageMaterial } from "./imagematerial";
import MaterialLoader from "./index";

const opts = {
    urls: ["https://media.example/artwork.mp4"],
    videoTextureOpts: { item: { data: {} }, mesh: {} },
    materialParams: { transparent: true },
};
const replacement = {
    url: "https://media.example/replacement.mp4",
    type: "VIDEO_MEDIA",
    opts: opts.videoTextureOpts,
};
const makeVideo = () => ({
    pause: jest.fn(),
    removeAttribute: jest.fn(),
    load: jest.fn(),
    srcObject: {},
});

beforeEach(() => jest.clearAllMocks());

test("normal video loads preserve the media and artwork options", async () => {
    const video = makeVideo();
    Loader.loadVideo.mockResolvedValue(video);

    const material = await MaterialLoader.loadVideoMaterial(opts);

    expect(material).toBeInstanceOf(VideoMaterial);
    expect(Loader.loadVideo).toHaveBeenCalledWith(opts.urls, undefined);
    expect(VideoMaterial).toHaveBeenCalledWith({
        materialParams: opts.materialParams,
        videoOpts: { ...opts.videoTextureOpts, video },
    });
    expect(video.pause).not.toHaveBeenCalled();
});

test("missing URL results reject before creating video controllers", async () => {
    Loader.loadVideo.mockResolvedValue(null);

    await expect(
        MaterialLoader.loadVideoMaterial({ ...opts, urls: [] })
    ).rejects.toThrow("no media source");

    expect(VideoMaterial).not.toHaveBeenCalled();
});

test("an aborted supplied video is never attached or released by this loader", async () => {
    const video = makeVideo();
    const abort = new AbortController();
    abort.abort();

    await expect(
        MaterialLoader.loadVideoMaterial({ ...opts, video }, abort.signal)
    ).rejects.toThrow(ABORT_MSG);

    expect(Loader.loadVideo).not.toHaveBeenCalled();
    expect(VideoMaterial).not.toHaveBeenCalled();
    expect(video.pause).not.toHaveBeenCalled();
});

test("a video that finishes loading after exit is released", async () => {
    const video = makeVideo();
    const abort = new AbortController();
    Loader.loadVideo.mockImplementation(async () => {
        abort.abort();
        return video;
    });

    await expect(
        MaterialLoader.loadVideoMaterial(opts, abort.signal)
    ).rejects.toThrow(ABORT_MSG);

    expect(VideoMaterial).not.toHaveBeenCalled();
    expect(video.pause).toHaveBeenCalledTimes(1);
    expect(video.removeAttribute).toHaveBeenCalledWith("src");
    expect(video.srcObject).toBeNull();
    expect(video.load).toHaveBeenCalledTimes(1);
});

test("a missing replacement keeps the current video intact", async () => {
    const material = new VideoMaterial({});
    Loader.loadVideo.mockResolvedValue(null);

    await expect(
        MaterialLoader.updateMedia(replacement, material)
    ).rejects.toThrow("no media source");

    expect(material.updateMedia).not.toHaveBeenCalled();
});

test.each(["disposed", "removed", "aborted"])(
    "a replacement loaded after its material is %s is released",
    async (state) => {
        const material = new VideoMaterial({});
        const video = makeVideo();
        const abort = new AbortController();
        Loader.loadVideo.mockImplementation(async () => {
            if (state === "disposed") material.videoTexture.wasDisposed = true;
            if (state === "removed") material.videoTexture = null;
            if (state === "aborted") abort.abort();
            return video;
        });

        await expect(
            MaterialLoader.updateMedia(replacement, material, abort.signal)
        ).rejects.toThrow(ABORT_MSG);

        expect(material.updateMedia).not.toHaveBeenCalled();
        expect(video.pause).toHaveBeenCalledTimes(1);
        expect(video.removeAttribute).toHaveBeenCalledWith("src");
        expect(video.srcObject).toBeNull();
        expect(video.load).toHaveBeenCalledTimes(1);
    }
);

test("a loaded replacement updates the live material normally", async () => {
    const material = new VideoMaterial({});
    const video = makeVideo();
    Loader.loadVideo.mockResolvedValue(video);

    await expect(
        MaterialLoader.updateMedia(replacement, material)
    ).resolves.toBe(material);

    expect(material.updateMedia).toHaveBeenCalledWith({
        ...replacement.opts,
        video,
    });
    expect(video.pause).not.toHaveBeenCalled();
});

test("an image is capped to its level of detail before it becomes a texture", async () => {
    class FakeBitmap {
        constructor(width, height) {
            this.width = width;
            this.height = height;
            this.close = jest.fn();
        }
    }
    global.ImageBitmap = FakeBitmap;
    global.createImageBitmap = jest.fn(
        async (_source, { resizeWidth, resizeHeight }) =>
            new FakeBitmap(resizeWidth, resizeHeight)
    );
    try {
        const original = new FakeBitmap(4000, 4000);
        Loader.loadImage = jest.fn().mockResolvedValue(original);

        await MaterialLoader.loadMaterial(
            {
                type: "IMAGE_MEDIA",
                urls: ["https://arweave.net/abc"],
                decodeLimit: { width: 512, height: 512 },
            },
            { materialParams: {} }
        );

        const { image } = ImageMaterial.mock.calls[0][0];
        expect(image).toMatchObject({ width: 512, height: 512 });
        expect(original.close).toHaveBeenCalled();
    } finally {
        delete global.ImageBitmap;
        delete global.createImageBitmap;
    }
});
