import { getMessageBytes, Protocol } from "colyseus";
import { AOI_LIMIT, Pose } from "./protocol";
const messageType = "lobby-snapshot";
const prefixLength = getMessageBytes[Protocol.ROOM_DATA](messageType).length;
/** Encode each changed avatar once, then reuse its immutable MessagePack tuple across viewers. */
export function encodePose(pose: Pose): Buffer {
    return Buffer.from(getMessageBytes[Protocol.ROOM_DATA](messageType, pose)).subarray(prefixLength);
}
/** Identical Colyseus v0.14 ROOM_DATA packet and public v1 object shape, without repeated tuple encoding. */
export function encodeSnapshot(tick: number, serverTime: number, poses: readonly Buffer[]): Buffer {
    if (poses.length > AOI_LIMIT) throw new Error("Snapshot exceeds AOI limit");
    const header = Buffer.from(getMessageBytes[Protocol.ROOM_DATA](messageType, { tick, serverTime, poses: [] }));
    // poses is the final map entry; replace its empty fixarray marker with the real array header.
    if (header[header.length - 1] !== 0x90) throw new Error("Unexpected Colyseus MessagePack envelope");
    const array = poses.length < 16 ? Buffer.from([0x90 | poses.length]) : Buffer.from([0xdc, poses.length >> 8, poses.length & 0xff]);
    return Buffer.concat([header.subarray(0, -1), array, ...poses]);
}
