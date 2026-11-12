import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import * as THREE from "three";
import { TextDecoder } from "util";

const directory = path.join(__dirname, "../../public/lobby/flash");
const manifest = JSON.parse(
    fs.readFileSync(path.join(directory, "manifest.json"), "utf8")
);
const pack = manifest.packs[0];
const bytes = fs.readFileSync(path.join(directory, pack.file));
const data = () => Uint8Array.from(bytes).buffer;
beforeEach(() => {
    jest.resetModules();
    global.TextDecoder = TextDecoder as typeof global.TextDecoder;
});

test("the exact supplied gesture ships without its model as a compact validated skeletal clip", async () => {
    const loader = require("./flashAnimationPack");
    const fetchAsset = jest.fn(async () => data());
    const [a, b] = await Promise.all([
        loader.loadFlashAnimationPack(fetchAsset),
        loader.loadFlashAnimationPack(fetchAsset),
    ]);
    expect(a).toBe(b);
    expect(fetchAsset).toHaveBeenCalledTimes(1);
    expect(fetchAsset).toHaveBeenCalledWith(loader.FLASH_PACK_URL);
    expect(bytes.byteLength).toBeLessThan(20000);
    expect(bytes.byteLength).toBe(pack.bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(pack.sha256);
    expect(pack.file).toContain(pack.sha256.slice(0, 12));
    const clip = THREE.AnimationClip.parse(a.clips.FLASH_POINT);
    expect(clip.duration).toBeCloseTo(55 / 30, 6);
    expect(clip.tracks).toHaveLength(53);
    expect(
        clip.tracks.filter((track) =>
            /Hand(Thumb|Index|Middle|Ring|Pinky)[123]\.quaternion$/.test(
                track.name
            )
        )
    ).toHaveLength(30);
    expect(a.metadata.FLASH_POINT.loop).toBe(false);
    expect(loader.FLASH_HOLD_TIME_MS).toBeCloseTo((13 / 30) * 1000, 6);
    expect(loader.FLASH_ANIMATION_DURATION_MS).toBeCloseTo((55 / 30) * 1000, 3);
    expect(pack.measuredMaxAngularErrorDegrees).toBeLessThan(0.25);
    expect(pack.measuredMaxPositionErrorCm).toBeLessThan(0.1);
    expect(pack.measuredMaxRetargetFkErrorCm).toBeLessThan(0.05);
    // Keep authored hand articulation, but anchor horizontal player displacement.
    const hips = clip.tracks.find(
        (track) => track.name === "mixamorigHips.position"
    );
    for (const i of [0, 2, hips.values.length - 3, hips.values.length - 1])
        expect(Math.abs(hips.values[i])).toBeLessThan(0.001);
    const hand = clip.tracks.find(
        (track) => track.name === "mixamorigRightHand.quaternion"
    );
    const interpolant = hand.createInterpolant();
    const start = new THREE.Quaternion().fromArray(interpolant.evaluate(0));
    const pointing = new THREE.Quaternion().fromArray(interpolant.evaluate(1));
    expect(start.angleTo(pointing)).toBeGreaterThan(0.3);
});

test("a missing or malformed gesture can be retried", async () => {
    const loader = require("./flashAnimationPack");
    const fetchAsset = jest
        .fn()
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce(new ArrayBuffer(8))
        .mockResolvedValue(data());
    await expect(loader.loadFlashAnimationPack(fetchAsset)).rejects.toThrow(
        "offline"
    );
    await expect(loader.loadFlashAnimationPack(fetchAsset)).rejects.toThrow(
        "Invalid LCP1"
    );
    await expect(
        loader.loadFlashAnimationPack(fetchAsset)
    ).resolves.toHaveProperty("clips.FLASH_POINT");
});
