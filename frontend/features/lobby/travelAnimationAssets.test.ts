import { readFileSync } from "fs";
import path from "path";
import { createHash } from "crypto";
import { TextDecoder } from "util";
import * as THREE from "three";
import { decodeCC0LocomotionPack, CC0AnimationClip } from "./cc0LocomotionPack";

const directory = path.join(__dirname, "../../public/lobby/travel");
const manifest = JSON.parse(
    readFileSync(path.join(directory, "manifest.json"), "utf8")
);
const pack = manifest.packs[0];
const bytes = Uint8Array.from(readFileSync(path.join(directory, pack.file)));
let clips: Record<string, CC0AnimationClip>;

beforeAll(() => {
    global.TextDecoder = TextDecoder as typeof global.TextDecoder;
    clips = decodeCC0LocomotionPack(bytes).clips;
});

const hips = (name: string) =>
    clips[name].tracks.find((track) => track.name === "mixamorigHips.position");

test("the four travel FBX motions ship as a small, content-addressed runtime-decodable pack", () => {
    expect(bytes.byteLength).toBe(pack.bytes);
    expect(bytes.byteLength).toBeLessThan(90000);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(pack.sha256);
    expect(pack.file).toContain(pack.sha256.slice(0, 12));
    expect(Object.keys(clips)).toEqual([
        "TRAVEL_ATTACK",
        "TRAVEL_CROUCH_DOWN",
        "TRAVEL_CROUCH_IDLE",
        "TRAVEL_STAND_UP",
    ]);
    expect(clips.TRAVEL_ATTACK.duration).toBeCloseTo(106 / 30, 6);
    expect(clips.TRAVEL_CROUCH_DOWN.duration).toBe(1);
    expect(clips.TRAVEL_CROUCH_IDLE.duration).toBeCloseTo(41 / 30, 6);
    expect(clips.TRAVEL_STAND_UP.duration).toBe(1);
    for (const raw of Object.values(clips)) {
        const clip = THREE.AnimationClip.parse(raw);
        expect(clip.tracks).toHaveLength(53);
        expect(
            raw.tracks.filter((track) =>
                /Hand(Thumb|Index|Middle|Ring|Pinky)[123]\.quaternion$/.test(
                    track.name
                )
            )
        ).toHaveLength(30);
        expect(
            raw.tracks.every((track) => track.values.every(Number.isFinite))
        ).toBe(true);
    }
});

test("crouch and stand preserve a shared absolute hip height without moving the player origin", () => {
    const down = hips("TRAVEL_CROUCH_DOWN").values;
    const hold = hips("TRAVEL_CROUCH_IDLE").values;
    const up = hips("TRAVEL_STAND_UP").values;
    expect(down[1] - down.at(-2)).toBeGreaterThan(30);
    expect(down[1] - down.at(-2)).toBeLessThan(35);
    expect(down.at(-2)).toBeCloseTo(hold[1], 3);
    expect(hold.at(-2)).toBeCloseTo(up[1], 3);
    expect(up.at(-2)).toBeCloseTo(down[1], 3);
    // A per-clip Y-zeroing step would erase the waiting crouch pose.
    expect(
        Math.max(...hold.filter((_, index) => index % 3 === 1))
    ).toBeLessThan(60);
    expect(
        Math.min(...hold.filter((_, index) => index % 3 === 1))
    ).toBeGreaterThan(50);
    for (const name of Object.keys(clips)) {
        const values = hips(name).values;
        for (const value of [
            values[0],
            values[2],
            values.at(-3),
            values.at(-1),
        ])
            expect(Math.abs(value)).toBeLessThan(0.001);
    }
});

test("the authored poses connect across the sequence and the waiting crouch loops without a jump", () => {
    const seams = [
        ["TRAVEL_ATTACK", "TRAVEL_CROUCH_DOWN"],
        ["TRAVEL_CROUCH_DOWN", "TRAVEL_CROUCH_IDLE"],
        ["TRAVEL_CROUCH_IDLE", "TRAVEL_CROUCH_IDLE"],
        ["TRAVEL_CROUCH_IDLE", "TRAVEL_STAND_UP"],
        ["TRAVEL_STAND_UP", "TRAVEL_ATTACK"],
    ];
    for (const [from, to] of seams) {
        for (const track of clips[from].tracks.filter(
            (track) => track.type === "quaternion"
        )) {
            const next = clips[to].tracks.find(
                (other) => other.name === track.name
            );
            const angle = new THREE.Quaternion()
                .fromArray(track.values.slice(-4))
                .angleTo(
                    new THREE.Quaternion().fromArray(next.values.slice(0, 4))
                );
            expect((angle * 180) / Math.PI).toBeLessThan(
                from === to ? 0.01 : 0.4
            );
        }
    }
    expect(
        decodeCC0LocomotionPack(bytes).metadata.TRAVEL_CROUCH_IDLE.loop
    ).toBe(true);
    expect(pack.measuredMaxAngularErrorDegrees).toBeLessThan(0.25);
    expect(pack.measuredMaxPositionErrorCm).toBeLessThan(0.1);
    expect(pack.measuredMaxRetargetFkErrorCm).toBeLessThan(0.05);
});
