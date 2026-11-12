/**
 * The avatar motion clips (animations/compute2.json) as a compact binary
 * container: a small JSON header and two typed arrays of integers.
 *
 *   bytes 0-3   magic "OCAC"
 *   bytes 4-7   uint32 format version (AVATAR_CLIPS_VERSION)
 *   bytes 8-11  uint32 header length in bytes, a multiple of 4
 *   header      UTF-8 JSON, padded with spaces
 *   int32[]     header.int32 integers
 *   int16[]     header.int16 integers
 *   (all little-endian)
 *
 * Every number in the JSON has at most a few decimals, so a sequence is
 * stored as integers `n` with `value = n / 10 ** decimals`, delta coded per
 * component (stride 4 for quaternions, 3 for positions, 1 for key times) in
 * int16, or int32 when a delta does not fit. The encoder checks that every
 * decoded number is the exact double JSON.parse gives, so the Float32Arrays
 * three builds from either source are bit for bit the same. This is not a
 * lossy quantisation. Identical key-time lists within a clip are stored once.
 *
 * Header: { version, source, int32, int16, names: [track names], clips: [{
 *   name, duration, uuid, blendMode,
 *   times: [[decimals, count, wide]],
 *   tracks: [[nameIndex, typeIndex, timesIndex, decimals, wide]] }] }
 * A track has times.count * stride values. The streams hold, clip by clip,
 * that clip's key times and then its tracks' values, in header order.
 *
 * Decoded clips have AnimationClip.parse's JSON shape, with Float32Array
 * `times` and `values`; tracks of a clip that share key times share one
 * Float32Array, which three only reads. Pure module: the bake workers, the
 * main thread, the tests and the pack script share it.
 */

export const AVATAR_CLIPS_VERSION = 1;

const MAGIC = [0x4f, 0x43, 0x41, 0x43]; // "OCAC"
const PREAMBLE = 12;
const MAX_DECIMALS = 6;
const INT16_MIN = -32768;
const INT16_MAX = 32767;
const INT32_LIMIT = 0x7fffffff;
const TYPES = ["vector", "quaternion"];
const STRIDES = [3, 4];

function toBytes(bytes) {
    if (bytes instanceof Uint8Array) return bytes;
    if (ArrayBuffer.isView(bytes))
        return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return new Uint8Array(bytes);
}

/** True when `bytes` (ArrayBuffer or view) starts with the container magic. */
export function isAvatarClipContainer(bytes) {
    const view = toBytes(bytes);
    return view.byteLength >= PREAMBLE && MAGIC.every((b, i) => view[i] === b);
}

/** Fewest decimals that give back every value exactly, or -1. */
function decimalsOf(values) {
    for (let decimals = 0; decimals <= MAX_DECIMALS; decimals++) {
        const scale = 10 ** decimals;
        let exact = true;
        for (let i = 0; i < values.length && exact; i++) {
            const n = Math.round(values[i] * scale);
            // The decoder divides the stored integer (never -0) by `scale`.
            exact =
                Math.abs(n) <= INT32_LIMIT &&
                Object.is((n === 0 ? 0 : n) / scale, values[i]);
        }
        if (exact) return decimals;
    }
    return -1;
}

/**
 * @param {Array} clips the parsed compute2.json
 * @param {object} [extra] more header fields (provenance)
 * @returns {Uint8Array} the uncompressed container
 */
export function encodeAvatarClips(clips, extra = {}) {
    const int16 = [];
    const int32 = [];
    const names = [];
    const nameIndex = new Map();
    const nameOf = (name) => {
        if (!nameIndex.has(name)) {
            nameIndex.set(name, names.length);
            names.push(name);
        }
        return nameIndex.get(name);
    };
    // Pushes one sequence's integers; returns [decimals, wide].
    const sequence = (values, stride, label) => {
        const decimals = decimalsOf(values);
        if (decimals < 0)
            throw new Error(
                `${label}: values need more than ${MAX_DECIMALS} decimals`
            );
        const scale = 10 ** decimals;
        const ints = Array.from(values, (v) => Math.round(v * scale));
        const deltas = ints.map((n, i) =>
            i < stride ? n : n - ints[i - stride]
        );
        if (deltas.some((d) => Math.abs(d) > INT32_LIMIT))
            throw new Error(`${label}: deltas exceed int32`);
        const wide = deltas.some((d) => d < INT16_MIN || d > INT16_MAX);
        for (const d of deltas) (wide ? int32 : int16).push(d);
        return [decimals, wide ? 1 : 0];
    };
    const encodeClip = (clip) => {
        const times = [];
        const timesIndex = new Map();
        const tracks = clip.tracks.map((track) => {
            const label = `${clip.name}/${track.name}`;
            const unknown = Object.keys(track).filter(
                (key) => !["name", "type", "times", "values"].includes(key)
            );
            if (unknown.length)
                throw new Error(`${label}: unsupported fields ${unknown}`);
            const type = TYPES.indexOf(track.type);
            if (type < 0)
                throw new Error(`${label}: unsupported type ${track.type}`);
            if (
                !track.times?.length ||
                track.values?.length !== track.times.length * STRIDES[type]
            )
                throw new Error(`${label}: unexpected key count`);
            const key = Array.from(track.times).join(",");
            if (!timesIndex.has(key)) {
                timesIndex.set(key, times.length);
                times.push(track.times);
            }
            return { track, type, times: timesIndex.get(key) };
        });
        const encodedTimes = times.map((list, i) => {
            const [decimals, wide] = sequence(
                list,
                1,
                `${clip.name}/times#${i}`
            );
            return [decimals, list.length, wide];
        });
        return {
            name: clip.name,
            duration: clip.duration,
            uuid: clip.uuid,
            blendMode: clip.blendMode,
            times: encodedTimes,
            tracks: tracks.map(({ track, type, times }) => [
                nameOf(track.name),
                type,
                times,
                ...sequence(
                    track.values,
                    STRIDES[type],
                    `${clip.name}/${track.name}`
                ),
            ]),
        };
    };
    const encodedClips = clips.map(encodeClip);
    const header = {
        version: AVATAR_CLIPS_VERSION,
        ...extra,
        int32: int32.length,
        int16: int16.length,
        names,
        clips: encodedClips,
    };

    const json = new TextEncoder().encode(JSON.stringify(header));
    const headerLength = Math.ceil(json.byteLength / 4) * 4;
    const out = new Uint8Array(
        PREAMBLE + headerLength + int32.length * 4 + int16.length * 2
    );
    const view = new DataView(out.buffer);
    MAGIC.forEach((b, i) => (out[i] = b));
    view.setUint32(4, AVATAR_CLIPS_VERSION, true);
    view.setUint32(8, headerLength, true);
    out.fill(0x20, PREAMBLE, PREAMBLE + headerLength);
    out.set(json, PREAMBLE);
    let offset = PREAMBLE + headerLength;
    for (const n of int32) {
        view.setInt32(offset, n, true);
        offset += 4;
    }
    for (const n of int16) {
        view.setInt16(offset, n, true);
        offset += 2;
    }
    return out;
}

const LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

/** The container's JSON header (version, provenance, counts). */
export function readAvatarClipHeader(bytes) {
    const view = toBytes(bytes);
    if (!isAvatarClipContainer(view))
        throw new Error("Not an avatar clip container");
    const data = new DataView(view.buffer, view.byteOffset, view.byteLength);
    const version = data.getUint32(4, true);
    if (version !== AVATAR_CLIPS_VERSION)
        throw new Error(`Unsupported avatar clip container version ${version}`);
    const headerLength = data.getUint32(8, true);
    const header = JSON.parse(
        new TextDecoder().decode(
            view.subarray(PREAMBLE, PREAMBLE + headerLength)
        )
    );
    return { header, dataOffset: PREAMBLE + headerLength };
}

function readStream(view, offset, count, Type) {
    const absolute = view.byteOffset + offset;
    if (LITTLE_ENDIAN && absolute % Type.BYTES_PER_ELEMENT === 0)
        return new Type(view.buffer, absolute, count);
    // Unaligned input or a big-endian platform: read value by value.
    const data = new DataView(
        view.buffer,
        absolute,
        count * Type.BYTES_PER_ELEMENT
    );
    const out = new Type(count);
    for (let i = 0; i < count; i++)
        out[i] =
            Type === Int32Array
                ? data.getInt32(i * 4, true)
                : data.getInt16(i * 2, true);
    return out;
}

/**
 * @param {ArrayBuffer|Uint8Array} bytes the uncompressed container
 * @returns {Array} clips in AnimationClip.parse's JSON shape
 */
export function decodeAvatarClips(bytes) {
    const view = toBytes(bytes);
    const { header, dataOffset } = readAvatarClipHeader(view);
    if (view.byteLength < dataOffset + header.int32 * 4 + header.int16 * 2)
        throw new Error("Avatar clip container is truncated");
    const int32 = readStream(view, dataOffset, header.int32, Int32Array);
    const int16 = readStream(
        view,
        dataOffset + header.int32 * 4,
        header.int16,
        Int16Array
    );
    let at16 = 0;
    let at32 = 0;
    const read = (count, stride, decimals, wide) => {
        const source = wide ? int32 : int16;
        const start = wide ? at32 : at16;
        if (start + count > source.length)
            throw new Error("Avatar clip container is inconsistent");
        if (wide) at32 += count;
        else at16 += count;
        const scale = 10 ** decimals;
        const out = new Float32Array(count);
        const running = [0, 0, 0, 0];
        for (let i = 0, c = 0; i < count; i++) {
            running[c] += source[start + i];
            out[i] = running[c] / scale;
            if (++c === stride) c = 0;
        }
        return out;
    };
    const clips = header.clips.map((clip) => {
        const times = clip.times.map(([decimals, count, wide]) =>
            read(count, 1, decimals, wide)
        );
        return {
            name: clip.name,
            duration: clip.duration,
            tracks: clip.tracks.map(
                ([name, type, timesIndex, decimals, wide]) => ({
                    name: header.names[name],
                    times: times[timesIndex],
                    values: read(
                        times[timesIndex].length * STRIDES[type],
                        STRIDES[type],
                        decimals,
                        wide
                    ),
                    type: TYPES[type],
                })
            ),
            uuid: clip.uuid,
            blendMode: clip.blendMode,
        };
    });
    if (at16 !== int16.length || at32 !== int32.length)
        throw new Error("Avatar clip container is inconsistent");
    return clips;
}
