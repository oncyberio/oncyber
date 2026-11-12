import assert from "assert";
import { InputAuthority } from "../src/world/input";
import { input, state, step } from "../protocol/movement";
import { WorldGateway } from "../src/world/gateway";
import { createSharedWorld } from "../src/world/shared";
import { encodeInputs } from "../protocol/movement";
import { encodeMovement, decodeSnapshot } from "../protocol/lobby-v2";
const command = (sequence: number) => ({ ...input({ strafe: 1, forward: 0, yaw: 0, running: false, jump: false, animation: -1 }), sequence });
describe("authoritative input simulation", () => {
    it("bounds time credit and ignores repeated/outdated input", () => {
        const a = new InputAuthority({}, 1000);
        a.receive(Array.from({ length: 120 }, (_, i) => command(i + 1)));
        assert.equal(a.advance(1000)!.seq, 6);
        assert.equal(a.advance(1000), null);
        assert.equal(a.advance(1050)!.seq, 9);
        a.receive([command(1)]);
        assert.equal(a.advance(1050), null);
        assert(a.state.x < 1);
    });
    it("fills a missing input after bounded grace and resumes in order", () => {
        const a = new InputAuthority({}, 1000);
        a.receive([command(1), command(3)]);
        assert.equal(a.advance(1000)!.seq, 1);
        assert.equal(a.advance(1050), null);
        assert.equal(a.advance(1101)!.seq, 3);
        assert.equal(a.missing, 1);
        a.receive([command(2)]);
        assert.equal(a.advance(1200), null);
    });
    it("resets an unbounded input gap without trusting client coordinates", () => {
        const a = new InputAuthority({ x: 7 }, 1000);
        a.receive([command(300)]);
        const ack = a.advance(1000)!;
        assert(ack.resetInputs);
        assert.equal(ack.seq, 300);
        assert.equal(ack.state.x, 7);
        a.receive([command(301)]);
        assert.equal(a.advance(1050)!.seq, 301);
    });
    it("negotiates input simulation, ignores pose injection, and publishes compact velocity snapshots", async () => {
        const messages: any[] = [],
            packets: Uint8Array[] = [];
        const g = new WorldGateway({ owner: 0, shared: createSharedWorld(2), epoch: 1, roomId: "test", region: "local", post: () => {} });
        const endpoint = {
            sendControl: (type: string, data: any) => {
                messages.push({ type, data });
                return true;
            },
            sendDatagram: (b: Uint8Array) => {
                packets.push(b);
                return true;
            },
            bufferedAmount: () => 0,
            close: () => {},
        };
        for (let id = 1; id <= 2; id++) {
            g.reserve({ id, slot: id - 1, owner: 0, token: String(id), expires: Date.now() + 1000, profile: { sessionId: String(id), userId: "", username: "test", avatar: "", VRM: "", scale: 1 } });
            await g.accept(String(id), endpoint);
            g.receiveControl(String(id), "lobby-ready", { movement: "input-v1", motion: "velocity-v1" });
        }
        const welcome = messages.find((m) => m.type === "lobby-welcome").data;
        assert.equal(welcome.movement, "input-v1");
        g.receiveDatagram("1", encodeMovement({ sequence: 1, x: 100, y: 0, z: 100, yaw: 0, animation: -1, floor: true }));
        g.step();
        assert.equal(g.sessions.get("1")!.pose.x, welcome.position[0]);
        g.receiveDatagram("1", encodeInputs([command(1), command(2), command(3)]));
        g.step();
        assert(g.sessions.get("1")!.pose.x > welcome.position[0]);
        assert(packets.every((p) => p[1] === 4));
        assert(packets.map(decodeSnapshot).some((p) => p!.poses.some((p) => p[0] === 1 && p[8]! > 0)));
        g.stop();
    });
});

describe("gateway scheduling", () => {
    it("spreads interest selection when worker IDs share the same modulo", async () => {
        const g = new WorldGateway({ owner: 0, shared: createSharedWorld(4), epoch: 1, roomId: "test", region: "local", post: () => {} });
        const endpoint = { sendControl: () => true, sendDatagram: () => true, bufferedAmount: () => 0, close: () => {} };
        for (let slot = 0; slot < 4; slot++) {
            const id = 1 + 8 * slot;
            g.reserve({ id, slot, owner: 0, token: String(id), expires: Date.now() + 1000, profile: { sessionId: String(id), userId: "", username: "test", avatar: "", VRM: "", scale: 1 } });
            await g.accept(String(id), endpoint);
            g.receiveControl(String(id), "lobby-ready", {});
        }
        g.step();
        const index = (g as any).index,
            select = index.select.bind(index);
        let calls = 0;
        index.select = (...args: any[]) => {
            calls++;
            return select(...args);
        };
        const counts = [];
        for (let i = 0; i < 4; i++) {
            calls = 0;
            g.step();
            counts.push(calls);
        }
        assert.deepEqual(counts, [1, 1, 1, 1]);
        g.stop();
    });
});

describe("input latency after worker stalls", () => {
    it("drains queued commands after a 500ms worker pause instead of retaining permanent input lag", () => {
        const a = new InputAuthority({}, 1000);
        for (let tick = 1; tick <= 60; tick++) {
            a.receive([command(tick * 3 - 2), command(tick * 3 - 1), command(tick * 3)]);
            if (tick >= 10 && tick < 20) continue;
            a.advance(1000 + tick * 50);
        }
        assert(a.sequence >= 177, `Still ${180 - a.sequence} input steps behind after recovery`);
        assert(a.diagnostics().queued <= 3);
    });
    it("idle connections cannot bank seconds of movement credit", () => {
        const a = new InputAuthority({}, 1000);
        for (let tick = 1; tick <= 200; tick++) a.advance(1000 + tick * 50);
        a.receive(Array.from({ length: 120 }, (_, i) => command(i + 1)));
        for (let n = 0; n < 100; n++) a.advance(11000);
        assert(a.sequence <= 12, `Idle client banked ${a.sequence} movement steps`);
    });
});

describe("input latency after network stalls", () => {
    it("recovers reliable input buffered in transit while the server keeps ticking", () => {
        const a = new InputAuthority({}, 1000);
        const held = [];
        for (let tick = 1; tick <= 60; tick++) {
            const batch = [command(tick * 3 - 2), command(tick * 3 - 1), command(tick * 3)];
            if (tick >= 10 && tick < 20) held.push(batch);
            else {
                for (const pending of held.splice(0)) a.receive(pending);
                a.receive(batch);
            }
            a.advance(1000 + tick * 50);
            assert(a.simulated <= 6 + tick * 3, "Simulation exceeded elapsed wall-time allowance");
        }
        assert(a.sequence >= 177);
        assert(a.diagnostics().queued <= 3);
    });
});
