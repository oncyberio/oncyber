import assert from "assert";
import { mintLobbyIdentity, lobbyPartyIdentity } from "../src/identity/lobby";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { Server, getMessageBytes, Protocol } from "colyseus";
import { CrowdLobbyRoom } from "../src/rooms/crowd";
import { registerCrowdRoom } from "../src/rooms/crowd/join";
const wait = (ms = 230) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(predicate: () => boolean) {
    const deadline = Date.now() + 3000;
    while (!predicate() && Date.now() < deadline) await wait(20);
    assert(predicate(), "Expected network state before timeout");
}
function observe(room: any) {
    const messages: Record<string, any[]> = {};
    room.onMessage("*", (type: string, value: any) => (messages[type] ||= []).push(value));
    return messages;
}
describe("crowd lobby real websocket protocol", () => {
    let server: ColyseusTestServer;
    before(async () => {
        const game = new Server();
        registerCrowdRoom(game);
        await game.listen(2570, "127.0.0.1");
        server = new ColyseusTestServer(game);
    });
    after(async () => server.shutdown());
    beforeEach(async () => server.cleanup());
    it("stamps party identity only from a valid account proof and preserves it across profile edits", async () => {
        const previous = process.env.LOBBY_IDENTITY_SECRET;
        process.env.LOBBY_IDENTITY_SECRET = "wire-lobby-identity-secret-at-least-32";
        try {
            const identity = lobbyPartyIdentity("canonical-alice");
            const room = (await server.createRoom("crowd-lobby", { region: "local" })) as CrowdLobbyRoom;
            const a = await server.connectTo(room, { userId: "arbitrary", partyIdentity: "forged", lobbyIdentityToken: mintLobbyIdentity("canonical-alice").token });
            const b = await server.connectTo(room, { userId: "canonical-alice", partyIdentity: identity });
            const am = observe(a), bm = observe(b);
            a.send("lobby-ready", {}); b.send("lobby-ready", {}); await wait();
            assert.equal(am["lobby-welcome"][0].partyIdentity, identity);
            assert.equal(room.model.people.get(b.sessionId)!.profile.partyIdentity, undefined);
            a.send("lobby-profile", { username: "Changed", partyIdentity: "B".repeat(43) }); await wait();
            assert.equal(room.model.people.get(a.sessionId)!.profile.partyIdentity, identity);
            assert(bm["lobby-roster"].some(m => m.enter.some((p: any) => p.sessionId === a.sessionId && p.partyIdentity === identity)));
            assert(!JSON.stringify(am).includes("lobbyIdentityToken"));
            assert(!JSON.stringify(am).includes("canonical-alice"));
            assert.equal(room.model.people.get(b.sessionId)!.profile.userId, `guest:${b.sessionId}`);
        } finally { if (previous === undefined) delete process.env.LOBBY_IDENTITY_SECRET; else process.env.LOBBY_IDENTITY_SECRET = previous; }
    });
    it("lets signed admins run lobby voice: add, request, mute, kick, and only the owner manages admins", async () => {
        const previous = process.env.LOBBY_IDENTITY_SECRET;
        process.env.LOBBY_IDENTITY_SECRET = "wire-lobby-identity-secret-at-least-32";
        try {
            const room = (await server.createRoom("crowd-lobby", { region: "local" })) as CrowdLobbyRoom;
            const owner = await server.connectTo(room, { userId: "o", lobbyIdentityToken: mintLobbyIdentity("rayan", undefined, undefined, "owner").token });
            const bob = await server.connectTo(room, { userId: "b", lobbyIdentityToken: mintLobbyIdentity("bob").token });
            const guest = await server.connectTo(room, { userId: "g" });
            const om = observe(owner), bm = observe(bob), gm = observe(guest);
            for (const c of [owner, bob, guest]) { c.send("lobby-ready", {}); c.send("rtc-ready", { enabled: true }); }
            await wait();
            assert.equal(om["lobby-welcome"][0].role, "owner");
            assert.equal(bm["lobby-welcome"][0].role, undefined);
            const last = (m: Record<string, any[]>, type: string) => m[type]?.[m[type].length - 1];
            // Non-admins cannot moderate; they can only ask.
            bob.send("lobby-admin", { action: "stage-add", sessionId: bob.sessionId });
            guest.send("lobby-voice-request", {});
            await wait();
            assert.equal(room.model.speakers.size, 0);
            assert.deepStrictEqual(last(om, "lobby-stage").requests.map((r: any) => r.sessionId), [guest.sessionId]);
            assert.deepStrictEqual(last(bm, "lobby-stage").requests, []);
            owner.send("lobby-admin", { action: "stage-add", sessionId: guest.sessionId });
            await wait();
            assert.equal(last(om, "lobby-admin-result").ok, true);
            assert.deepStrictEqual(last(bm, "lobby-stage").speakers.map((s: any) => s.sessionId), [guest.sessionId]);
            assert.deepStrictEqual(last(om, "lobby-stage").requests, []);
            owner.send("lobby-admin", { action: "mute", sessionId: guest.sessionId });
            await wait();
            assert.equal(room.model.speakers.size, 0);
            assert.equal(last(gm, "lobby-stage").muted, true);
            assert(last(gm, "lobby-voice").peers.every((id: string) => last(gm, "lobby-voice").listenOnly.includes(id)));
            owner.send("lobby-admin", { action: "grant-admin", sessionId: bob.sessionId });
            await wait();
            assert.equal(last(bm, "lobby-stage").role, "admin");
            bob.send("lobby-admin", { action: "kick", sessionId: owner.sessionId });
            await wait();
            assert.equal(last(bm, "lobby-admin-result").ok, false);
            bob.send("lobby-admin", { action: "kick", sessionId: guest.sessionId });
            await waitFor(() => !room.connections.has(guest.sessionId));
            assert(gm.kick);
        } finally { if (previous === undefined) delete process.env.LOBBY_IDENTITY_SECRET; else process.env.LOBBY_IDENTITY_SECRET = previous; }
    });
    it("sends authoritative spawn, capped metadata/quantized poses and no Schema", async () => {
        const room = (await server.createRoom("crowd-lobby", { region: "local" })) as CrowdLobbyRoom;
        const a = await server.connectTo(room, { userId: "a", position: { x: 999999, y: -500, z: 999999 } });
        const am = observe(a);
        a.send("lobby-ready", {});
        const b = await server.connectTo(room, { userId: "b", username: "Bee" });
        const bm = observe(b);
        b.send("lobby-ready", {});
        await wait();
        assert.strictEqual(room.state, undefined);
        assert.strictEqual(am["lobby-welcome"].length, 1);
        const initial = am["lobby-welcome"][0].position;
        assert(Math.abs(initial[0]) <= 8);
        assert.strictEqual(initial[1], 0);
        assert(am["lobby-roster"].some((m) => m.enter.some((p: any) => p.sessionId === b.sessionId && p.username === "Bee")));
        assert(!am["lobby-roster"].some((m) => m.enter.some((p: any) => p.sessionId === a.sessionId)));
        const pose = am["lobby-snapshot"][0].poses[0];
        assert.strictEqual(pose.length, 7);
        assert(Number.isInteger(pose[1]));
        a.send("lobby-move", [1, 150, 0, 150, 0, -1, true]);
        await wait(60);
        assert(am["lobby-ack"][0].corrected);
        assert.strictEqual(am["lobby-ack"][0].seq, 1);
        a.send("lobby-ping", { id: 3, clientTime: 12 });
        await wait(60);
        assert.strictEqual(am["lobby-pong"][0].id, 3);
        b.send("lobby-profile", { username: "Changed" });
        await wait();
        assert(am["lobby-roster"].some((m) => m.enter.some((p: any) => p.username === "Changed")));
        await b.leave();
        await wait();
        assert(am["lobby-roster"].some((m) => m.leave.includes(b.sessionId)));
    });
    it("admits only mutual nearby voice peers and filters chat payloads", async () => {
        const room = (await server.createRoom("crowd-lobby", { region: "local" })) as CrowdLobbyRoom;
        const a = await server.connectTo(room, { userId: "a" }),
            b = await server.connectTo(room, { userId: "b" });
        const am = observe(a),
            bm = observe(b);
        a.send("lobby-ready", {});
        b.send("lobby-ready", {});
        for (const p of room.model.people.values()) {
            p.x = 0;
            p.z = 0;
            room.model.index(p);
        }
        a.send("rtc-signal", { to: b.sessionId, payload: { kind: "offer" } });
        await wait(60);
        assert(!bm["rtc-signal"]);
        a.send("rtc-ready", {});
        b.send("rtc-ready", {});
        await waitFor(() => !!am["lobby-voice"]?.some((m) => m.peers.includes(b.sessionId)));
        assert(am["lobby-voice"].some((m) => m.peers.includes(b.sessionId)));
        a.send("rtc-signal", { to: b.sessionId, payload: { kind: "offer" } });
        await wait(60);
        assert.strictEqual(bm["rtc-signal"].length, 1);
        const target = room.connections.get(b.sessionId)!;
        const socket = target.client.ref as any;
        let buffered = 300000;
        Object.defineProperty(socket, "bufferedAmount", { configurable: true, get: () => buffered });
        a.send("rtc-signal", { to: b.sessionId, payload: { kind: "answer", answer: { type: "answer", sdp: "queued" } } });
        await wait(60);
        assert.strictEqual(bm["rtc-signal"].length, 1);
        assert.strictEqual(target.controls.length, 1);
        buffered = 0;
        await waitFor(() => bm["rtc-signal"]?.length === 2);
        assert.strictEqual(bm["rtc-signal"].length, 2);
        assert.strictEqual(bm["rtc-signal"][1].payload.answer.sdp, "queued");
        assert.strictEqual(target.controlBytes, 0);
        a.send("chat-channel", { type: "RTM_COMMAND", text: "bad" });
        a.send("chat-channel", { type: "MESSAGE", text: "hello" });
        await wait(60);
        assert.strictEqual(bm["chat-channel"].length, 1);
        b.send("rtc-ready", { enabled: false });
        await waitFor(() => am["lobby-voice"]?.slice(-1)[0]?.peers.length === 0);
        assert.strictEqual(am["lobby-voice"].slice(-1)[0].peers.length, 0);
        a.send("rtc-signal", { to: b.sessionId, payload: { kind: "offer" } });
        await wait(60);
        assert.strictEqual(bm["rtc-signal"].length, 2);
    });
    it("routes direct messages only to the selected ready participant", async () => {
        const room = (await server.createRoom("crowd-lobby", { region: "local" })) as CrowdLobbyRoom;
        const a = await server.connectTo(room, { userId: "sender" }),
            b = await server.connectTo(room, { userId: "recipient" }),
            c = await server.connectTo(room, { userId: "bystander" });
        const am = observe(a), bm = observe(b), cm = observe(c);
        for (const client of [a, b, c]) client.send("lobby-ready", {});
        await waitFor(() => !!am["lobby-welcome"] && !!bm["lobby-welcome"] && !!cm["lobby-welcome"]);
        a.send("chat-peer", { to: b.sessionId, from: c.sessionId, data: { type: "MESSAGE", text: " Private hello ", username: "spoofed" } });
        await waitFor(() => bm["chat-peer"]?.length === 1);
        assert.deepStrictEqual(bm["chat-peer"][0].data, { type: "MESSAGE", text: "Private hello" });
        assert.strictEqual(bm["chat-peer"][0].from, a.sessionId);
        assert.strictEqual(bm["chat-peer"][0].to, b.sessionId);
        assert.strictEqual(bm["chat-peer"][0].profile.username, room.connections.get(a.sessionId)!.person.profile.username);
        assert.strictEqual(typeof bm["chat-peer"][0].server_ts, "number");
        assert(!am["chat-peer"] && !cm["chat-peer"]);
        assert(!am["chat-channel"] && !bm["chat-channel"] && !cm["chat-channel"]);
        a.send("chat-peer", { to: "missing", data: { type: "MESSAGE", text: "No target" } });
        a.send("chat-peer", { to: b.sessionId, data: { type: "RTM_COMMAND", text: "Not chat" } });
        a.send("chat-peer", { to: a.sessionId, data: { type: "MESSAGE", text: "Self" } });
        await wait(80);
        assert.strictEqual(bm["chat-peer"].length, 1);
        assert(!am["chat-peer"] && !cm["chat-peer"]);
    });
    it("keeps near motion20Hz while bounding far replication and confirming stationary poses", async () => {
        const room = (await server.createRoom("crowd-lobby", { region: "local" })) as CrowdLobbyRoom;
        const a = await server.connectTo(room, { userId: "viewer" });
        observe(a);
        a.send("lobby-ready", {});
        await wait(60);
        room.setSimulationInterval(() => {}, 50000);
        const c = room.connections.get(a.sessionId)!;
        c.person.x = 0;
        c.person.z = 0;
        room.model.index(c.person);
        const people = Array.from({ length: 128 }, (_, i) => {
            const id = `peer-${i}`,
                p = room.model.add(id, { sessionId: id, userId: id, username: id, avatar: "", VRM: "", scale: 1 }, Date.now());
            p.x = (i + 1) * 0.05;
            p.z = 0;
            room.model.index(p);
            c.visible.set(id, p.profileRevision);
            c.poses.set(id, p.revision);
            return p;
        });
        room.model.selectVisible(c.person);
        const counts = new Map<string, number>(),
            prefix = getMessageBytes[Protocol.ROOM_DATA]("lobby-snapshot").length;
        const decode = require("notepack.io").decode;
        const original = c.client.enqueueRaw.bind(c.client);
        c.client.enqueueRaw = (bytes) => {
            const raw = Buffer.from(Uint8Array.from(bytes));
            if (!raw.subarray(0, prefix).equals(Buffer.from(getMessageBytes[Protocol.ROOM_DATA]("lobby-snapshot")))) return original(bytes);
            const packet = decode(raw.subarray(prefix));
            for (const pose of packet.poses) counts.set(pose[0], (counts.get(pose[0]) || 0) + 1);
        };
        for (let i = 0; i < 20; i++) {
            for (const p of people) p.revision++;
            room.step();
        }
        assert.strictEqual(counts.get("peer-0"), 20);
        assert((counts.get("peer-40") || 0) >= 10 && counts.get("peer-40")! <= 12);
        assert((counts.get("peer-100") || 0) >= 5 && counts.get("peer-100")! <= 7);
        for (let i = 0; i < 4; i++) room.step(); // flush the last far-tier movement delta
        counts.clear();
        for (let i = 0; i < 20; i++) room.step();
        assert.strictEqual(counts.get("peer-0"), 2);
        assert.strictEqual(counts.get("peer-100"), 2, "all idle tiers receive500ms pose confirmation");
        c.client.enqueueRaw = original;
    });
    it("shards a full room using reservation-aware matchmaking", async () => {
        const previous = process.env.LOBBY_MAX_CLIENTS;
        process.env.LOBBY_MAX_CLIENTS = "2";
        try {
            const join = (userId: string) => server.sdk.joinOrCreate("crowd-lobby", { userId, label: "oncyber-lobby-v1", region: "local" });
            const [a, b, c] = await Promise.all([join("one"), join("two"), join("three")]);
            const ids = new Set([a.id, b.id, c.id]);
            assert.strictEqual(ids.size, 2);
            for (const id of ids) assert(server.getRoomById(id).clients.length <= 2);
        } finally {
            if (previous === undefined) delete process.env.LOBBY_MAX_CLIENTS;
            else process.env.LOBBY_MAX_CLIENTS = previous;
        }
    });
    it("defers slow-client deltas without consuming them and closes a hard backlog", async () => {
        const room = (await server.createRoom("crowd-lobby", { region: "local" })) as CrowdLobbyRoom;
        const a = await server.connectTo(room, { userId: "a" });
        observe(a);
        a.send("lobby-ready", {});
        await wait(60);
        const c = room.connections.get(a.sessionId)!;
        const ref = c.client.ref as any;
        let amount = 300000;
        Object.defineProperty(ref, "bufferedAmount", { configurable: true, get: () => amount });
        const p = room.model.add("synthetic-peer", { sessionId: "synthetic-peer", userId: "peer", username: "peer", avatar: "", VRM: "", scale: 1 }, Date.now());
        p.x = c.person.x;
        p.z = c.person.z;
        room.model.index(p);
        room.model.selectVisible(c.person);
        room.step();
        assert(!c.visible.has(p.id));
        assert(room.metrics().droppedSnapshots > 0);
        amount = 0;
        room.step();
        assert(c.visible.has(p.id), "metadata is delivered after backpressure clears");
        let closeCode = 0;
        const leave = c.client.leave.bind(c.client);
        c.client.leave = (code?: number) => {
            closeCode = code!;
        };
        amount = 2000000;
        room.step();
        assert.strictEqual(closeCode, 4008);
        closeCode = 0;
        amount = 300000;
        for (let i = 0; i < 17; i++) (room as any).sendControl(c, "rtc-signal", { from: "peer", payload: { kind: "candidate" } });
        assert.strictEqual(c.controls.length, 16);
        assert.strictEqual(closeCode, 4008);
        c.controls.length = 0;
        c.controlBytes = 0;
        closeCode = 0;
        amount = 0;
        c.controls.push({ type: "rtc-signal", data: {}, bytes: 1, at: Date.now() - 6000 });
        (room as any).flushControls(c);
        assert.strictEqual(closeCode, 4008);
        c.controls.length = 0;
        c.client.leave = leave;
    });
});
