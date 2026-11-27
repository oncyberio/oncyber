/** Optional, animation-only CC0 pack decoder. No Three.js dependency or fetch. */
export interface CC0AnimationTrack {
    name: string;
    type: "quaternion" | "vector";
    times: number[];
    values: number[];
}

export interface CC0AnimationClip {
    uuid: string;
    blendMode: 2500;
    name: string;
    duration: number;
    tracks: CC0AnimationTrack[];
}

export interface CC0ClipMetadata {
    duration: number;
    loop: boolean;
}

export interface CC0LocomotionPack {
    clips: Record<string, CC0AnimationClip>;
    metadata: Record<string, CC0ClipMetadata>;
}

interface PackedTrack {
    bone: number;
    kind: "q" | "p";
    offset: number;
    count: number;
    min?: number[];
    max?: number[];
}

// AnimationClip.parse preserves JSON UUIDs; each decode must have a distinct
// namespace so separate loaded packs cannot share AnimationMixer actions.
let decodedPackSerial = 0;

const fail = (): never => {
    throw new Error("Invalid LCP1 locomotion pack");
};
const integer = (value: unknown, min: number, max: number): value is number =>
    Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
const identifier = (value: unknown): value is string =>
    typeof value === "string" && /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(value);

/**
 * Expand key data once when an optional pack is selected; then hand the returned
 * clips to AnimationClip.parse and the existing per-avatar retarget/bake cache.
 * This decoder does no work during animation updates.
 */
export function decodeCC0LocomotionPack(
    input: ArrayBuffer | Uint8Array
): CC0LocomotionPack {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (bytes.byteLength < 10 || bytes.byteLength > 262144) fail();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(0, false) !== 0x4c435031) fail(); // LCP1
    const headerLength = view.getUint32(4, true);
    if (headerLength > 65536 || headerLength + 8 >= bytes.byteLength) fail();
    let header: {
        version: number;
        bones: string[];
        clips: {
            name: string;
            duration: number;
            loop: boolean;
            tracks: PackedTrack[];
        }[];
    };
    try {
        header = JSON.parse(
            new TextDecoder("utf-8", { fatal: true }).decode(
                bytes.subarray(8, 8 + headerLength)
            )
        );
    } catch {
        fail();
    }
    if (
        !header ||
        header.version !== 1 ||
        !Array.isArray(header.bones) ||
        header.bones.length < 1 ||
        header.bones.length > 64 ||
        !header.bones.every(identifier) ||
        new Set(header.bones).size !== header.bones.length ||
        !Array.isArray(header.clips) ||
        header.clips.length < 1 ||
        header.clips.length > 16
    )
        fail();
    const packSerial = ++decodedPackSerial;
    const result: CC0LocomotionPack = {
        clips: Object.create(null),
        metadata: Object.create(null),
    };
    const dataStart = 8 + headerLength;
    let expectedOffset = 0;
    for (const clip of header.clips) {
        if (
            !clip ||
            !identifier(clip.name) ||
            result.clips[clip.name] ||
            !Number.isFinite(clip.duration) ||
            clip.duration <= 0 ||
            clip.duration > 60 ||
            typeof clip.loop !== "boolean" ||
            !Array.isArray(clip.tracks) ||
            clip.tracks.length < 1 ||
            clip.tracks.length > 64
        )
            fail();
        const names = new Set<string>();
        const tracks = clip.tracks.map((track): CC0AnimationTrack => {
            if (
                !track ||
                !integer(track.bone, 0, header.bones.length - 1) ||
                (track.kind !== "q" && track.kind !== "p") ||
                !integer(track.count, 2, 4096) ||
                track.offset !== expectedOffset
            )
                fail();
            const quaternion = track.kind === "q";
            const components = quaternion ? 4 : 3;
            const stride = 2 + components * 2;
            const byteLength = track.count * stride;
            if (dataStart + track.offset + byteLength > bytes.byteLength)
                fail();
            expectedOffset += byteLength;
            if (
                !quaternion &&
                (!Array.isArray(track.min) ||
                    !Array.isArray(track.max) ||
                    track.min.length !== 3 ||
                    track.max.length !== 3 ||
                    !track.min.every(
                        (n, i) =>
                            Number.isFinite(n) &&
                            Number.isFinite(track.max[i]) &&
                            n <= track.max[i] &&
                            Math.abs(n) <= 10000 &&
                            Math.abs(track.max[i]) <= 10000
                    ) ||
                    header.bones[track.bone] !== "mixamorigHips")
            )
                fail();
            const name = `${header.bones[track.bone]}.${
                quaternion ? "quaternion" : "position"
            }`;
            if (names.has(name)) fail();
            names.add(name);
            const times = new Array<number>(track.count);
            const values = new Array<number>(track.count * components);
            let previous = -1;
            for (let key = 0; key < track.count; key++) {
                let cursor = dataStart + track.offset + key * stride;
                const time = view.getUint16(cursor, true);
                if (
                    time <= previous ||
                    (key === 0 && time !== 0) ||
                    (key === track.count - 1 && time !== 65535)
                )
                    fail();
                previous = time;
                times[key] = (time / 65535) * clip.duration;
                cursor += 2;
                let lengthSquared = 0;
                for (let component = 0; component < components; component++) {
                    const value = quaternion
                        ? view.getInt16(cursor, true) / 32767
                        : track.min[component] +
                          (view.getUint16(cursor, true) / 65535) *
                              (track.max[component] - track.min[component]);
                    values[key * components + component] = value;
                    lengthSquared += value * value;
                    cursor += 2;
                }
                if (quaternion) {
                    if (lengthSquared < 0.99 || lengthSquared > 1.01) fail();
                    const inverseLength = 1 / Math.sqrt(lengthSquared);
                    for (let component = 0; component < 4; component++)
                        values[key * 4 + component] *= inverseLength;
                }
            }
            return {
                name,
                type: quaternion ? "quaternion" : "vector",
                times,
                values,
            };
        });
        result.clips[clip.name] = {
            uuid: `cc0-${packSerial}-${clip.name}`,
            blendMode: 2500, // THREE.NormalAnimationBlendMode in both backends.
            name: clip.name,
            duration: clip.duration,
            tracks,
        };
        result.metadata[clip.name] = {
            duration: clip.duration,
            loop: clip.loop,
        };
    }
    if (dataStart + expectedOffset !== bytes.byteLength) fail();
    return result;
}
