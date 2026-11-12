import { Blob } from "buffer";
import { Texture, SRGBColorSpace } from "three";
import DonorWorker from "./roomTextureDonor.worker.js";
import { cacheStorages } from "./cachestorage";
import {
    loadRoomTextureDonor,
    rehydrateRoomTextureDonor,
} from "./roomTextureDonor";
jest.mock("./roomTextureDonor.worker.js", () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock("./cachestorage", () => ({
    cacheStorages: { room: { fetch: jest.fn() } },
}));
const originalWorker = global.Worker;
let worker, buffer;
const flush = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
};
const payload = () => ({
    type: "ready",
    textures: [
        {
            image: {
                width: 2048,
                height: 1024,
                encodedBlob: new Blob(["encoded"]),
            },
            state: {
                name: "wall",
                colorSpace: SRGBColorSpace,
                channel: 1,
                flipY: false,
                offset: [0.2, 0.3],
                repeat: [2, 1],
                center: [0.5, 0.5],
                matrix: [1, 0, 0, 0, 1, 0, 0.2, 0.3, 1],
                matrixAutoUpdate: false,
            },
        },
    ],
    records: [
        { textureId: 0, path: "/walls", slot: "map", geometry: "3:hash" },
        {
            textureId: 0,
            path: "/walls",
            slot: "emissiveMap",
            geometry: "3:hash",
        },
    ],
});
beforeEach(() => {
    jest.clearAllMocks();
    global.Worker = jest.fn();
    buffer = new ArrayBuffer(32);
    worker = { terminate: jest.fn(), postMessage: jest.fn() };
    DonorWorker.mockImplementation(() => worker);
    cacheStorages.room.fetch.mockResolvedValue({
        ok: true,
        headers: { get: () => null },
        arrayBuffer: async () => buffer,
    });
});
afterAll(() => {
    global.Worker = originalWorker;
});
test("preserves cache URL, transfers encoded bytes, reconstructs UV state and shared image identity", async () => {
    const controller = new AbortController(),
        url = "https://assets.test/room.glb?signature=a%2Fb&v=2";
    const pending = loadRoomTextureDonor(url, { signal: controller.signal });
    await flush();
    expect(cacheStorages.room.fetch).toHaveBeenCalledWith(url, {
        signal: controller.signal,
    });
    expect(worker.postMessage).toHaveBeenCalledWith({ buffer }, [buffer]);
    const message = payload();
    worker.onmessage({ data: message });
    const donor = await pending;
    expect(donor.textures[0]).toBeInstanceOf(Texture);
    expect(donor.textures[0].image.encodedBlob).toBe(
        message.textures[0].image.encodedBlob
    );
    expect(donor.textures[0].colorSpace).toBe(SRGBColorSpace);
    expect(donor.textures[0].repeat.toArray()).toEqual([2, 1]);
    expect(donor.textures[0].matrix.toArray()).toEqual(
        message.textures[0].state.matrix
    );
    expect(donor.roomTextureRecords[0].texture).toBe(
        donor.roomTextureRecords[1].texture
    );
    expect(donor.textures[0].version).toBe(0);
    expect(donor.scene).toBeUndefined();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
});
test("abort before fetching does no work", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
        loadRoomTextureDonor("/room.glb", { signal: controller.signal })
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(cacheStorages.room.fetch).not.toHaveBeenCalled();
});
test("abort during worker parsing terminates it and ignores late donor", async () => {
    const controller = new AbortController();
    const pending = loadRoomTextureDonor("/room.glb", {
        signal: controller.signal,
    });
    await flush();
    const receive = worker.onmessage;
    controller.abort();
    receive({ data: payload() });
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
});
test("abort during body loading never creates a decoder", async () => {
    let finish;
    cacheStorages.room.fetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () =>
            new Promise((resolve) => {
                finish = resolve;
            }),
    });
    const controller = new AbortController(),
        pending = loadRoomTextureDonor("/room.glb", {
            signal: controller.signal,
        });
    await flush();
    controller.abort();
    finish(buffer);
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(DonorWorker).not.toHaveBeenCalled();
});
test.each(["onerror", "onmessageerror"])("%s fails safely", async (event) => {
    const pending = loadRoomTextureDonor("/room.glb");
    await flush();
    worker[event]({});
    await expect(pending).rejects.toMatchObject({
        code: "ROOM_TEXTURE_DONOR_UNSUPPORTED",
    });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
});
test("unsupported worker result releases worker", async () => {
    const pending = loadRoomTextureDonor("/room.glb");
    await flush();
    worker.onmessage({ data: { type: "error" } });
    await expect(pending).rejects.toMatchObject({
        code: "ROOM_TEXTURE_DONOR_UNSUPPORTED",
    });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
});
test("missing worker support avoids high download", async () => {
    global.Worker = undefined;
    await expect(loadRoomTextureDonor("/room.glb")).rejects.toMatchObject({
        code: "ROOM_TEXTURE_DONOR_UNSUPPORTED",
    });
    expect(cacheStorages.room.fetch).not.toHaveBeenCalled();
});
test("oversized response is rejected before allocating body", async () => {
    const arrayBuffer = jest.fn();
    cacheStorages.room.fetch.mockResolvedValue({
        ok: true,
        headers: { get: () => String(129 * 1024 * 1024) },
        arrayBuffer,
    });
    await expect(loadRoomTextureDonor("/room.glb")).rejects.toMatchObject({
        code: "ROOM_TEXTURE_DONOR_UNSUPPORTED",
    });
    expect(arrayBuffer).not.toHaveBeenCalled();
});
test("invalid texture references dispose created descriptors", () => {
    const dispose = jest.spyOn(Texture.prototype, "dispose"),
        message = payload();
    message.records[0].textureId = 9;
    expect(() => rehydrateRoomTextureDonor(message)).toThrow();
    expect(dispose).toHaveBeenCalledTimes(1);
    dispose.mockRestore();
});
