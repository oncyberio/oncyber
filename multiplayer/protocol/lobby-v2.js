/* Shared browser/server wire format. No Node globals or transport dependencies. */
"use strict";

const VERSION = 2;
const MOVEMENT = 1;
const SNAPSHOT = 2;
const MOVEMENT_BYTES = 24;
const SNAPSHOT_HEADER_BYTES = 22;
const POSE_BYTES = 26;
const DEFAULT_DATAGRAM_BYTES = 1200;
const DEFAULT_CONTROL_BYTES = 16384;
let encoder;

function bytesOf(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    throw new TypeError("Expected binary lobby packet");
}
function uint(value) {
    return Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
}
function validPose(x, y, z, yaw, animation, floor) {
    return [x, y, z, yaw].every((v) => Number.isFinite(v) && Math.abs(v) <= 3.4028234663852886e38) && Number.isInteger(animation) && animation >= -1 && animation <= 127 && (floor === true || floor === false || floor === 0 || floor === 1);
}
function encodeMovement(move) {
    if (!move || !uint(move.sequence) || !validPose(move.x, move.y, move.z, move.yaw, move.animation, move.floor)) throw new RangeError("Invalid movement");
    const bytes = new Uint8Array(MOVEMENT_BYTES);
    const view = new DataView(bytes.buffer);
    bytes[0] = VERSION;
    bytes[1] = MOVEMENT;
    view.setUint32(2, move.sequence, true);
    view.setFloat32(6, move.x, true);
    view.setFloat32(10, move.y, true);
    view.setFloat32(14, move.z, true);
    view.setFloat32(18, move.yaw, true);
    view.setInt8(22, move.animation);
    bytes[23] = Number(move.floor);
    return bytes;
}
function decodeMovement(input) {
    let bytes;
    try {
        bytes = bytesOf(input);
    } catch {
        return null;
    }
    if (bytes.length !== MOVEMENT_BYTES || bytes[0] !== VERSION || bytes[1] !== MOVEMENT) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const move = { sequence: view.getUint32(2, true), x: view.getFloat32(6, true), y: view.getFloat32(10, true), z: view.getFloat32(14, true), yaw: view.getFloat32(18, true), animation: view.getInt8(22), floor: bytes[23] === 1 };
    if (bytes[23] > 1 || !validPose(move.x, move.y, move.z, move.yaw, move.animation, move.floor)) return null;
    return move;
}
function encodePose(pose) {
    if (!Array.isArray(pose) || pose.length !== 8 || !uint(pose[0]) || !uint(pose[1]) || !validPose(pose[2], pose[3], pose[4], pose[5], pose[6], pose[7])) throw new RangeError("Invalid snapshot pose");
    const bytes = new Uint8Array(POSE_BYTES);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, pose[0], true);
    view.setUint32(4, pose[1], true);
    view.setFloat32(8, pose[2], true);
    view.setFloat32(12, pose[3], true);
    view.setFloat32(16, pose[4], true);
    view.setFloat32(20, pose[5], true);
    view.setInt8(24, pose[6]);
    bytes[25] = Number(pose[7]);
    return bytes;
}
/** Centimetre positions and 1/256m/s velocity within the lobby's bounded world. */
function encodeMotionPose(pose, target) {
    if (!Array.isArray(pose) || pose.length !== 11 || !uint(pose[0]) || !uint(pose[1]) || !validPose(...pose.slice(2, 8)) || pose.slice(2, 5).some((v) => Math.abs(v) > 327.67) || pose.slice(8).some((v) => !Number.isFinite(v) || Math.abs(v) > 127)) throw new RangeError("Invalid motion pose");
    const bytes = target || new Uint8Array(24);
    if (!(bytes instanceof Uint8Array) || bytes.length !== 24) throw new RangeError("Invalid motion target");
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    v.setUint32(0, pose[0], true);
    v.setUint32(4, pose[1], true);
    for (let n = 0; n < 3; n++) {
        v.setInt16(8 + n * 2, Math.round(pose[2 + n] * 100), true);
        v.setInt16(16 + n * 2, Math.round(pose[8 + n] * 256), true);
    }
    const yaw = ((pose[5] % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    v.setUint16(14, Math.round((yaw / (2 * Math.PI)) * 65535), true);
    v.setInt8(22, pose[6]);
    bytes[23] = Number(pose[7]);
    return bytes;
}
/** Call encodePose once per changed actor, then reuse the immutable result. */
function encodeSnapshotParts(frame, maxBytes = DEFAULT_DATAGRAM_BYTES) {
    const recordBytes = frame?.motion ? 24 : POSE_BYTES;
    if (!frame || !uint(frame.epoch) || !uint(frame.tick) || !Number.isFinite(frame.serverTime) || frame.serverTime < 0 || !Array.isArray(frame.poses)) throw new RangeError("Invalid snapshot header");
    if (!Number.isInteger(maxBytes) || maxBytes < SNAPSHOT_HEADER_BYTES + recordBytes || maxBytes > 65535) throw new RangeError("Invalid datagram size");
    const perPacket = Math.floor((maxBytes - SNAPSHOT_HEADER_BYTES) / recordBytes);
    if (Math.ceil(frame.poses.length / perPacket) > 65536) throw new RangeError("Too many snapshot chunks");
    const output = [];
    for (let start = 0, chunk = 0; start < frame.poses.length; start += perPacket, chunk++) {
        const count = Math.min(perPacket, frame.poses.length - start);
        const bytes = new Uint8Array(SNAPSHOT_HEADER_BYTES + recordBytes * count);
        const view = new DataView(bytes.buffer);
        bytes[0] = VERSION;
        bytes[1] = frame.motion ? 4 : SNAPSHOT;
        view.setUint32(2, frame.epoch, true);
        view.setUint32(6, frame.tick, true);
        view.setFloat64(10, frame.serverTime, true);
        view.setUint16(18, chunk, true);
        view.setUint16(20, count, true);
        for (let i = 0; i < count; i++) {
            const pose = frame.poses[start + i];
            if (!(pose instanceof Uint8Array) || pose.length !== recordBytes) throw new RangeError("Invalid encoded pose");
            bytes.set(pose, SNAPSHOT_HEADER_BYTES + i * recordBytes);
        }
        output.push(bytes);
    }
    return output;
}
function encodeSnapshots(frame, maxBytes = DEFAULT_DATAGRAM_BYTES) {
    if (!frame || !Array.isArray(frame.poses)) throw new RangeError("Invalid snapshot header");
    return encodeSnapshotParts({ ...frame, poses: frame.poses.map((pose) => (frame.motion ? encodeMotionPose(pose) : encodePose(pose))) }, maxBytes);
}
function decodeSnapshot(input) {
    let bytes;
    try {
        bytes = bytesOf(input);
    } catch {
        return null;
    }
    if (bytes.length < SNAPSHOT_HEADER_BYTES || bytes[0] !== VERSION || (bytes[1] !== SNAPSHOT && bytes[1] !== 4)) return null;
    const recordBytes = bytes[1] === 4 ? 24 : POSE_BYTES;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const count = view.getUint16(20, true);
    if (bytes.length !== SNAPSHOT_HEADER_BYTES + count * recordBytes) return null;
    const serverTime = view.getFloat64(10, true);
    if (!Number.isFinite(serverTime) || serverTime < 0) return null;
    const poses = [];
    for (let i = 0; i < count; i++) {
        const offset = SNAPSHOT_HEADER_BYTES + i * recordBytes;
        const pose = bytes[1] === 4 ? [view.getUint32(offset, true), view.getUint32(offset + 4, true), view.getInt16(offset + 8, true) / 100, view.getInt16(offset + 10, true) / 100, view.getInt16(offset + 12, true) / 100, (view.getUint16(offset + 14, true) / 65535) * 2 * Math.PI, view.getInt8(offset + 22), bytes[offset + 23], view.getInt16(offset + 16, true) / 256, view.getInt16(offset + 18, true) / 256, view.getInt16(offset + 20, true) / 256] : [view.getUint32(offset, true), view.getUint32(offset + 4, true), view.getFloat32(offset + 8, true), view.getFloat32(offset + 12, true), view.getFloat32(offset + 16, true), view.getFloat32(offset + 20, true), view.getInt8(offset + 24), bytes[offset + 25]];
        if (!validPose(...pose.slice(2, 8))) return null;
        poses.push(pose);
    }
    return { epoch: view.getUint32(2, true), tick: view.getUint32(6, true), serverTime, chunk: view.getUint16(18, true), poses };
}
function validControl(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value) && typeof value.type === "string" && /^[a-z][a-z0-9:_-]{0,47}$/.test(value.type) && Object.prototype.hasOwnProperty.call(value, "data");
}
function controlLimit(options) {
    const limit = options?.maxFrameBytes ?? DEFAULT_CONTROL_BYTES;
    if (!Number.isInteger(limit) || limit < 64 || limit > 1048576) throw new RangeError("Invalid control frame limit");
    return limit;
}
function encodeControl(type, data, options) {
    const value = { type, data };
    if (!validControl(value) || data === undefined) throw new TypeError("Invalid control message");
    const bytes = (encoder || (encoder = new TextEncoder())).encode(JSON.stringify(value) + "\n");
    if (bytes.length - 1 > controlLimit(options)) throw new RangeError("Control frame too large");
    return bytes;
}
function createControlDecoder(onMessage, options) {
    const limit = controlLimit(options);
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let pending = new Uint8Array(limit);
    let length = 0;
    let ended = false;
    const fail = (message) => {
        ended = true;
        pending = new Uint8Array(0);
        throw new Error(message);
    };
    return {
        push(input) {
            if (ended) throw new Error("Control decoder is closed");
            const bytes = bytesOf(input);
            let start = 0;
            try {
                for (let i = 0; i <= bytes.length; i++) {
                    if (i !== bytes.length && bytes[i] !== 10) continue;
                    const size = i - start;
                    if (length + size > limit) fail("Control frame too large");
                    pending.set(bytes.subarray(start, i), length);
                    length += size;
                    if (i === bytes.length) break;
                    if (!length) fail("Empty control frame");
                    const value = JSON.parse(decoder.decode(pending.subarray(0, length)));
                    if (!validControl(value)) fail("Invalid control message");
                    length = 0;
                    onMessage(value);
                    start = i + 1;
                }
            } catch (error) {
                ended = true;
                pending = new Uint8Array(0);
                throw error;
            }
        },
        finish() {
            if (ended) return;
            ended = true;
            pending = new Uint8Array(0);
            if (length) throw new Error("Truncated control frame");
        },
    };
}

module.exports = { encodeMotionPose, VERSION, MOVEMENT_BYTES, SNAPSHOT_HEADER_BYTES, POSE_BYTES, DEFAULT_DATAGRAM_BYTES, DEFAULT_CONTROL_BYTES, encodeMovement, decodeMovement, encodePose, encodeSnapshotParts, encodeSnapshots, decodeSnapshot, encodeControl, createControlDecoder };
