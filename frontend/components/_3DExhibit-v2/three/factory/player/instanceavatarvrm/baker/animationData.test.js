import fs from "fs";
import path from "path";
import { gunzipSync } from "zlib";
import { DecompressionStream } from "stream/web";

const PACKED = path.join(__dirname, "animations/compute2.bin");
const JSON_CLIPS = require("./animations/compute2.json");

jest.mock("./clipAsset.js", () => ({
    __esModule: true,
    default: "/_next/static/media/compute2.test.bin",
}));

let load;
beforeEach(() => {
    jest.resetModules();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    global.DecompressionStream = DecompressionStream;
    global.fetch = jest.fn(async () => {
        const bytes = fs.readFileSync(PACKED);
        return {
            ok: true,
            arrayBuffer: async () =>
                bytes.buffer.slice(
                    bytes.byteOffset,
                    bytes.byteOffset + bytes.byteLength
                ),
        };
    });
    load = () => require("./animationData");
});
afterEach(() => {
    delete global.fetch;
    delete global.DecompressionStream;
    jest.restoreAllMocks();
});

const asFloat32 = (clips) =>
    clips.map((clip) =>
        clip.tracks.map((track) => [
            track.name,
            Buffer.from(Float32Array.from(track.times).buffer).toString("hex"),
            Buffer.from(Float32Array.from(track.values).buffer).toString("hex"),
        ])
    );

test("the clips load once, on demand, and are then read synchronously", async () => {
    const { bakerAnimations, loadBakerAnimations } = load();
    expect(() => bakerAnimations()).toThrow(/not loaded/);
    expect(global.fetch).not.toHaveBeenCalled();
    const [first, second] = await Promise.all([
        loadBakerAnimations(),
        loadBakerAnimations(),
    ]);
    expect(first).toBe(second);
    expect(Array.isArray(first)).toBe(true);
    expect(first.some((clip) => clip.name === "idle")).toBe(true);
    expect(bakerAnimations()).toBe(first);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
        "/_next/static/media/compute2.test.bin"
    );
});

test("the packed file gives the JSON's numbers exactly, and keeps the container for the workers", async () => {
    const { loadBakerClipSource } = load();
    const { bytes, clips } = await loadBakerClipSource();
    expect(Buffer.from(bytes)).toEqual(gunzipSync(fs.readFileSync(PACKED)));
    expect(clips[0].tracks[0].values).toBeInstanceOf(Float32Array);
    expect(
        clips.map(({ name, duration, uuid, blendMode }) => ({
            name,
            duration,
            uuid,
            blendMode,
        }))
    ).toEqual(
        JSON_CLIPS.map(({ name, duration, uuid, blendMode }) => ({
            name,
            duration,
            uuid,
            blendMode,
        }))
    );
    expect(asFloat32(clips)).toEqual(asFloat32(JSON_CLIPS));
});

test("a host that already inflated the file is read as is", async () => {
    const container = gunzipSync(fs.readFileSync(PACKED));
    global.fetch = jest.fn(async () => ({
        ok: true,
        arrayBuffer: async () => container.buffer.slice(0),
    }));
    const { bytes } = await load().loadBakerClipSource();
    expect(bytes.byteLength).toBe(container.byteLength);
});

test.each([
    [
        "the browser has no DecompressionStream",
        () => delete global.DecompressionStream,
    ],
    [
        "the request fails",
        () =>
            (global.fetch = jest.fn(async () => ({ ok: false, status: 404 }))),
    ],
    [
        "the network is down",
        () =>
            (global.fetch = jest.fn(async () =>
                Promise.reject(new TypeError("offline"))
            )),
    ],
    [
        "the file is damaged",
        () => {
            const bytes = fs.readFileSync(PACKED);
            bytes[bytes.length >> 1] ^= 0xff;
            global.fetch = jest.fn(async () => ({
                ok: true,
                arrayBuffer: async () =>
                    bytes.buffer.slice(
                        bytes.byteOffset,
                        bytes.byteOffset + bytes.byteLength
                    ),
            }));
        },
    ],
    [
        "the file is not a clip container",
        () =>
            (global.fetch = jest.fn(async () => ({
                ok: true,
                arrayBuffer: async () => new ArrayBuffer(64),
            }))),
    ],
])("falls back to the JSON clips when %s", async (_, breakIt) => {
    breakIt();
    const { loadBakerClipSource, bakerAnimations } = load();
    const { bytes, clips } = await loadBakerClipSource();
    expect(bytes).toBeNull();
    expect(clips).toEqual(JSON_CLIPS);
    expect(bakerAnimations()).toBe(clips);
    expect(console.warn).toHaveBeenCalledWith(
        "Avatar clips: using the JSON copy",
        expect.anything()
    );
});
