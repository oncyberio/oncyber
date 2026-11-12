import fs from "fs";
import path from "path";

const data = (url: string) => {
    const buffer = fs.readFileSync(path.join(__dirname, "../../public", url));
    return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
    );
};
beforeEach(() => jest.resetModules());

test("travel keys decode on demand once, with durations and looping from the shipped pack", async () => {
    const loader =
        require("./travelAnimationPack") as typeof import("./travelAnimationPack");
    const fetchAsset = jest.fn(async (url: string) => data(url));
    const [a, b] = await Promise.all([
        loader.loadTravelAnimationPack(fetchAsset),
        loader.loadTravelAnimationPack(fetchAsset),
    ]);
    expect(a).toBe(b);
    expect(fetchAsset).toHaveBeenCalledTimes(1);
    expect(fetchAsset).toHaveBeenCalledWith(loader.TRAVEL_PACK_URL);
    expect(Object.keys(a.clips).sort()).toEqual(
        [...loader.TRAVEL_ANIMATION_NAMES].sort()
    );
    for (const name of loader.TRAVEL_ANIMATION_NAMES) {
        expect(a.metadata[name].duration * 1000).toBeCloseTo(
            loader.TRAVEL_ANIMATION_DURATION_MS[name],
            6
        );
        expect(a.metadata[name].loop).toBe(name === "TRAVEL_CROUCH_IDLE");
    }
    const hips = (name: string) =>
        a.clips[name].tracks.find(
            (track) => track.name === "mixamorigHips.position"
        ).values;
    const down = hips("TRAVEL_CROUCH_DOWN");
    const hold = hips("TRAVEL_CROUCH_IDLE");
    const up = hips("TRAVEL_STAND_UP");
    expect(down.at(-2)).toBeLessThan(down[1] * 0.7);
    expect(hold[1]).toBeCloseTo(down.at(-2), 3);
    expect(up[1]).toBeCloseTo(hold.at(-2), 3);
    expect(up.at(-2)).toBeGreaterThan(up[1] * 1.4);
    expect(new Set(Object.values(a.clips).map((clip) => clip.uuid)).size).toBe(
        4
    );
});

test("failed or malformed travel assets can be retried without poisoning the cache", async () => {
    const loader =
        require("./travelAnimationPack") as typeof import("./travelAnimationPack");
    const fetchAsset = jest
        .fn()
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce(new ArrayBuffer(8))
        .mockImplementation(async (url: string) => data(url));
    await expect(loader.loadTravelAnimationPack(fetchAsset)).rejects.toThrow(
        "offline"
    );
    await expect(loader.loadTravelAnimationPack(fetchAsset)).rejects.toThrow(
        "Invalid LCP1 locomotion pack"
    );
    await expect(
        loader.loadTravelAnimationPack(fetchAsset)
    ).resolves.toHaveProperty("clips.TRAVEL_STAND_UP");
    expect(fetchAsset).toHaveBeenCalledTimes(3);
});
