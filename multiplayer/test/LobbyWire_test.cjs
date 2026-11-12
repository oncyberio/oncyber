"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const wire = require("../protocol/lobby-v2.js");
const pose = (id = 7) => [id, 19, 1.25, 0, -4.5, 0.5, -1, true];
const frame = (poses = [pose()]) => ({ epoch: 55, tick: 100, serverTime: 1791300000123, poses });
const move = () => ({ sequence: 32, x: 1.25, y: 0, z: -4.5, yaw: 0.5, animation: -1, floor: true });

test("movement is 24 bytes and preserves finite pose/sequence", () => {
    const bytes = wire.encodeMovement(move());
    assert.equal(bytes.length, 24);
    assert.deepEqual(wire.decodeMovement(bytes), move());
});
test("reads typed-array offsets without reading unrelated pooled bytes", () => {
    const bytes = Buffer.alloc(100, 255);
    bytes.set(wire.encodeMovement(move()), 21);
    assert.deepEqual(wire.decodeMovement(bytes.subarray(21, 45)), move());
    const snapshot = wire.encodeSnapshots(frame())[0];
    bytes.set(snapshot, 12);
    assert.deepEqual(wire.decodeSnapshot(bytes.subarray(12, 12 + snapshot.length)).poses[0], [...pose().slice(0, 7), 1]);
});
test("rejects invalid version, kind, truncated and oversized movement", () => {
    for (const bytes of [new Uint8Array(0), new Uint8Array(23), new Uint8Array(25)]) assert.equal(wire.decodeMovement(bytes), null);
    const bytes = wire.encodeMovement(move());
    bytes[0] = 1;
    assert.equal(wire.decodeMovement(bytes), null);
    bytes[0] = 2;
    bytes[1] = 2;
    assert.equal(wire.decodeMovement(bytes), null);
});
test("rejects nonfinite coordinates, float overflow, invalid floor/emote/sequence", () => {
    for (const change of [{ x: Infinity }, { yaw: NaN }, { x: 1e100 }, { sequence: -1 }, { sequence: 2 ** 32 }, { animation: -2 }, { floor: 2 }]) assert.throws(() => wire.encodeMovement({ ...move(), ...change }));
    const bytes = wire.encodeMovement(move());
    new DataView(bytes.buffer).setFloat32(6, NaN, true);
    assert.equal(wire.decodeMovement(bytes), null);
    const floor = wire.encodeMovement(move());
    floor[23] = 2;
    assert.equal(wire.decodeMovement(floor), null);
});
test("128 actors split into independently decodable MTU-sized datagrams", () => {
    const packets = wire.encodeSnapshots(frame(Array.from({ length: 128 }, (_, id) => pose(id))));
    assert.equal(packets.length, 3);
    assert.ok(packets.every((p) => p.length <= 1200));
    const decoded = packets.map(wire.decodeSnapshot);
    assert.deepEqual(
        decoded.map((d) => d.chunk),
        [0, 1, 2]
    );
    assert.ok(decoded.every((d) => d.epoch === 55 && d.tick === 100 && d.serverTime === frame().serverTime));
    assert.equal(decoded.flatMap((d) => d.poses).length, 128);
});
test("lost or reordered datagrams do not make other chunks undecodable", () => {
    const packets = wire.encodeSnapshots(frame(Array.from({ length: 128 }, (_, id) => pose(id))));
    const delivered = [packets[2], packets[0]].flatMap((p) => wire.decodeSnapshot(p).poses);
    assert.equal(new Set(delivered.map((p) => p[0])).size, 83);
    assert.equal(delivered[0][0], 90);
});
test("cached actor encoding exactly matches tuple encoding", () => {
    const f = frame(Array.from({ length: 10000 }, (_, id) => pose(id)));
    const a = wire.encodeSnapshots(f);
    const b = wire.encodeSnapshotParts({ ...f, poses: f.poses.map(wire.encodePose) });
    assert.deepEqual(a, b);
    assert.equal(a.flatMap((p) => wire.decodeSnapshot(p).poses).length, 10000);
});
test("snapshot rejects malformed headers, lengths, records, and packet budgets", () => {
    assert.throws(() => wire.encodeSnapshots(frame(), 47));
    assert.throws(() => wire.encodeSnapshots({ ...frame(), epoch: -1 }));
    assert.throws(() => wire.encodePose([-1, ...pose().slice(1)]));
    assert.throws(() => wire.encodeSnapshotParts({ ...frame(), poses: [new Uint8Array(25)] }));
    const bytes = wire.encodeSnapshots(frame())[0];
    assert.equal(wire.decodeSnapshot(bytes.subarray(0, bytes.length - 1)), null);
    new DataView(bytes.buffer).setFloat32(22 + 8, Infinity, true);
    assert.equal(wire.decodeSnapshot(bytes), null);
    const badFloor = wire.encodeSnapshots(frame())[0];
    badFloor[badFloor.length - 1] = 2;
    assert.equal(wire.decodeSnapshot(badFloor), null);
});
test("UTF8 reliable controls survive every single-byte stream boundary", () => {
    const expected = { type: "chat-message", data: { text: "hello 👋 世界\nnext line" } };
    const received = [];
    const decoder = wire.createControlDecoder((message) => received.push(message));
    for (const byte of wire.encodeControl(expected.type, expected.data)) decoder.push(Uint8Array.of(byte));
    decoder.finish();
    assert.deepEqual(received, [expected]);
});
test("several controls coalesce into a single stream chunk", () => {
    const received = [];
    const decoder = wire.createControlDecoder((message) => received.push(message));
    decoder.push(Buffer.concat([wire.encodeControl("ping", { id: 1 }), wire.encodeControl("lobby-roster", { enter: [], leave: [] })]));
    decoder.finish();
    assert.deepEqual(
        received.map((m) => m.type),
        ["ping", "lobby-roster"]
    );
});
test("oversized unterminated stream fails at bounded bytes and stays closed", () => {
    const decoder = wire.createControlDecoder(() => assert.fail("must not deliver"), { maxFrameBytes: 64 });
    decoder.push(new Uint8Array(64).fill(32));
    assert.throws(() => decoder.push(Uint8Array.of(32)), /too large/);
    assert.throws(() => decoder.push(wire.encodeControl("ping", {})), /closed/);
});
test("control frame limits count UTF8 bytes, not JS code units", () => {
    assert.throws(() => wire.encodeControl("chat-message", { text: "🌏".repeat(20) }, { maxFrameBytes: 64 }), /too large/);
});
test("invalid JSON, UTF8, envelope and truncated stream fail closed", () => {
    for (const input of [Buffer.from("{broken}\n"), Uint8Array.from([0xff, 10]), Buffer.from('{"type":"bad type","data":{}}\n'), Buffer.from('{"type":"ping"}\n'), Buffer.from("null\n"), Buffer.from("\n")]) {
        const decoder = wire.createControlDecoder(() => assert.fail("invalid frame delivered"));
        assert.throws(() => decoder.push(input));
    }
    const decoder = wire.createControlDecoder(() => assert.fail("truncated frame delivered"));
    decoder.push(Buffer.from('{"type":"ping"'));
    assert.throws(() => decoder.finish(), /Truncated/);
});
test("empty snapshots produce no stale work and uint32 limits round-trip", () => {
    assert.deepEqual(wire.encodeSnapshots(frame([])), []);
    const bytes = wire.encodeMovement({ ...move(), sequence: 0xffffffff });
    assert.equal(wire.decodeMovement(bytes).sequence, 0xffffffff);
    const p = wire.decodeSnapshot(wire.encodeSnapshots({ ...frame([pose(0xffffffff)]), epoch: 0xffffffff, tick: 0xffffffff })[0]);
    assert.equal(p.poses[0][0], 0xffffffff);
    assert.equal(p.epoch, 0xffffffff);
});

const movement = require("../protocol/movement.js");
test("input batches repeat twelve commands within 147 bytes and reject malformed packets", () => {
    const inputs = Array.from({ length: 12 }, (_, i) => ({ ...movement.input({ strafe: 0.5, forward: -1, yaw: 9, running: true, jump: i === 1, animation: -1 }), sequence: i + 1 }));
    const bytes = movement.encodeInputs(inputs);
    assert.equal(bytes.length, 147);
    assert.deepEqual(movement.decodeInputs(bytes), inputs);
    for (const offset of [0, 1, 2, 13]) {
        const bad = bytes.slice();
        bad[offset] = 255;
        assert.equal(movement.decodeInputs(bad), null);
    }
    assert.equal(movement.decodeInputs(bytes.slice(1)), null);
    const duplicate = bytes.slice();
    new DataView(duplicate.buffer).setUint32(15, 1, true);
    assert.equal(movement.decodeInputs(duplicate), null);
});
test("compact motion snapshot preserves velocities and centimetre positions inside MTU", () => {
    const { encodeSnapshots, decodeSnapshot } = require("../protocol/lobby-v2.js");
    const poses = Array.from({ length: 128 }, (_, i) => [i + 1, 2, -199.123, 1.111, 199.987, -1, -1, true, 3.21, -6, 0]);
    const packets = encodeSnapshots({ epoch: 1, tick: 2, serverTime: 3, poses, motion: true });
    assert.equal(packets.length, 3);
    assert(packets.every((p) => p.length <= 1200));
    const decoded = packets.flatMap((p) => decodeSnapshot(p).poses);
    assert.equal(decoded.length, 128);
    assert(Math.abs(decoded[0][2] - poses[0][2]) <= 0.005);
    assert(Math.abs(decoded[0][8] - poses[0][8]) < 1 / 256);
    assert.equal(decoded[0][9], -6);
    const bad = packets[0].slice();
    bad[22 + 23] = 2;
    assert.equal(decodeSnapshot(bad), null);
});
