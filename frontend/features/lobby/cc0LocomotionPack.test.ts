import { readFileSync } from "fs";
import path from "path";
import { createHash } from "crypto";
import { TextDecoder, TextEncoder } from "util";
import * as THREE from "three";
import { decodeCC0LocomotionPack } from "./cc0LocomotionPack";

const directory = path.join(__dirname, "../../public/lobby/cc0");
const manifest = JSON.parse(
    readFileSync(path.join(directory, "manifest.json"), "utf8")
);
const readBytes = (file: string): Uint8Array =>
    Uint8Array.from(readFileSync(file));
const core = readBytes(path.join(directory, manifest.packs[0].file));
const dataView = (bytes: Uint8Array): DataView =>
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const concatenate = (...parts: Uint8Array[]): Uint8Array => {
    const result = new Uint8Array(
        parts.reduce((sum, part) => sum + part.length, 0)
    );
    let offset = 0;
    for (const part of parts) {
        result.set(part, offset);
        offset += part.length;
    }
    return result;
};

interface TestHeader {
    version: number;
    clips: {
        name: string;
        tracks: {
            count: number;
            offset: number;
            bone: number;
            min?: number[];
        }[];
    }[];
}

function readHeader(bytes: Uint8Array): TestHeader {
    const length = dataView(bytes).getUint32(4, true);
    return JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + length)));
}

beforeAll(() => {
    global.TextDecoder = TextDecoder as typeof global.TextDecoder;
});

function replaceHeader(
    bytes: Uint8Array,
    change: (header: TestHeader) => void
): Uint8Array {
    const headerLength = dataView(bytes).getUint32(4, true);
    const header = readHeader(bytes);
    change(header);
    const json = new TextEncoder().encode(JSON.stringify(header));
    const prefix = new Uint8Array(8);
    prefix.set([0x4c, 0x43, 0x50, 0x31]);
    dataView(prefix).setUint32(4, json.length, true);
    return concatenate(prefix, json, bytes.subarray(8 + headerLength));
}

describe("optional CC0 locomotion pack", () => {
    it("decodes both shipped packs as normalized Three animation tracks with recorded hashes", () => {
        for (const pack of manifest.packs) {
            const bytes = readBytes(path.join(directory, pack.file));
            expect(bytes.byteLength).toBe(pack.bytes);
            expect(createHash("sha256").update(bytes).digest("hex")).toBe(
                pack.sha256
            );
            const decoded = decodeCC0LocomotionPack(bytes);
            expect(Object.keys(decoded.clips)).toEqual(Object.keys(pack.clips));
            for (const [name, raw] of Object.entries(decoded.clips)) {
                const clip = THREE.AnimationClip.parse(raw);
                expect(clip.duration).toBeCloseTo(pack.clips[name].duration, 5);
                expect(decoded.metadata[name].loop).toBe(pack.clips[name].loop);
                expect(clip.tracks).toHaveLength(53);
                for (const track of raw.tracks) {
                    expect(track.times[0]).toBe(0);
                    expect(track.times[track.times.length - 1]).toBe(
                        raw.duration
                    );
                    expect(track.values.every(Number.isFinite)).toBe(true);
                    if (track.type !== "quaternion") {
                        expect(track.name).toBe("mixamorigHips.position");
                        continue;
                    }
                    for (let i = 0; i < track.values.length; i += 4) {
                        expect(
                            Math.hypot(...track.values.slice(i, i + 4))
                        ).toBeCloseTo(1, 12);
                    }
                }
            }
        }
    });

    it("supports ArrayBuffers and bounded Uint8Array views without reading surrounding bytes", () => {
        const storage = new Uint8Array(core.length + 16);
        storage.set(core, 8);
        const view = storage.subarray(8, 8 + core.length);
        const expected = decodeCC0LocomotionPack(core);
        for (const input of [view, view.slice().buffer]) {
            const decoded = decodeCC0LocomotionPack(input);
            expect(decoded.metadata).toEqual(expected.metadata);
            expect(Object.keys(decoded.clips)).toEqual(
                Object.keys(expected.clips)
            );
            for (const name of Object.keys(expected.clips)) {
                expect(decoded.clips[name].tracks).toEqual(
                    expected.clips[name].tracks
                );
                expect(decoded.clips[name].duration).toBe(
                    expected.clips[name].duration
                );
            }
        }
    });

    it("creates distinct mixer actions for different clips and independently decoded packs", () => {
        const first = decodeCC0LocomotionPack(core);
        const second = decodeCC0LocomotionPack(core);
        const clips = [
            first.clips.WALK,
            first.clips.RUN,
            second.clips.WALK,
        ].map((raw) => THREE.AnimationClip.parse(raw));
        expect(new Set(clips.map((clip) => clip.uuid)).size).toBe(3);
        expect(
            clips.every(
                (clip) => clip.blendMode === THREE.NormalAnimationBlendMode
            )
        ).toBe(true);
        const mixer = new THREE.AnimationMixer(new THREE.Group());
        const actions = clips.map((clip) => mixer.clipAction(clip));
        expect(new Set(actions).size).toBe(3);
        actions.forEach((action, index) =>
            expect(action.getClip()).toBe(clips[index])
        );
    });

    it("rejects corrupt headers and out-of-bounds or overlapping tracks before use", () => {
        const variants = [
            core.subarray(0, 4),
            core.subarray(0, core.length - 1),
            concatenate(core, new Uint8Array([0])),
            replaceHeader(core, (h) => {
                h.version = 2;
            }),
            replaceHeader(core, (h) => {
                h.clips[0].tracks[0].count = 100000000;
            }),
            replaceHeader(core, (h) => {
                h.clips[0].tracks[0].offset = 1;
            }),
            replaceHeader(core, (h) => {
                h.clips[0].tracks[1].offset = 0;
            }),
            replaceHeader(core, (h) => {
                h.clips[0].tracks[0].bone = 500;
            }),
            replaceHeader(core, (h) => {
                h.clips[0].name = "__proto__";
            }),
            replaceHeader(core, (h) => {
                h.clips[0].tracks.at(-1).min[0] = null;
            }),
        ];
        for (const bytes of variants)
            expect(() => decodeCC0LocomotionPack(bytes)).toThrow(
                "Invalid LCP1"
            );
    });

    it("rejects invalid quaternions and nonmonotonic key times", () => {
        const headerLength = dataView(core).getUint32(4, true);
        const header = readHeader(core);
        const start = 8 + headerLength + header.clips[0].tracks[0].offset;
        const quaternion = core.slice();
        quaternion.fill(0, start + 2, start + 10);
        expect(() => decodeCC0LocomotionPack(quaternion)).toThrow(
            "Invalid LCP1"
        );
        const time = core.slice();
        dataView(time).setUint16(start + 10, 0, true);
        expect(() => decodeCC0LocomotionPack(time)).toThrow("Invalid LCP1");
    });

    it("records quality bounds, source licensing, and separate optional loads", () => {
        expect(manifest.enabledByDefault).toBe(false);
        expect(manifest.provenance.license).toBe("CC0-1.0");
        expect(manifest.rig.measuredMaxRestBasisFkErrorMeters).toBeLessThan(
            0.00001
        );
        expect(manifest.packs.map((p) => p.group)).toEqual(["core", "jump"]);
        expect(
            manifest.packs.reduce((sum, p) => sum + p.bytes, 0)
        ).toBeLessThan(60000);
        for (const p of manifest.packs) {
            expect(p.measuredMaxAngularErrorDegrees).toBeLessThan(0.25);
            expect(p.measuredMaxPositionErrorCm).toBeLessThan(0.1);
        }
        expect(manifest.packs[1].clips.JUMP.contacts).toEqual({
            left: [],
            right: [],
        });
    });
});
