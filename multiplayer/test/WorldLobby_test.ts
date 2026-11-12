import assert from "assert";
import { mintLobbyIdentity, lobbyPartyIdentity } from "../src/identity/lobby";
import WebSocket from "ws";
import { createSharedWorld, SharedWorld, blankPose } from "../src/world/shared";
import { InterestIndex, CANDIDATE_LIMIT } from "../src/world/interest";
import { WorldGateway } from "../src/world/gateway";
import { createWorldServer } from "../src/world/server";
import { encodeMovement, decodeSnapshot } from "../protocol/lobby-v2";
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = (id: number) => ({ sessionId: String(id), userId: `guest:${id}`, username: "Guest", avatar: "", VRM: "", scale: 1 });
describe("shared world state and interest", () => {
    it("publishes coherent poses without modifying a reader during a write", () => {
        const shared = new SharedWorld(createSharedWorld(2)),
            p = { ...blankPose(0), id: 7, x: 3, z: 4, revision: 1 };
        shared.write(p);
        const out = blankPose(0);
        assert(shared.read(0, out));
        assert.equal(out.id, 7);
        Atomics.add(shared.flags, 0, 1);
        shared.values[1] = 999;
        assert.equal(shared.read(0, out), false);
        assert.equal(out.x, 3);
        Atomics.add(shared.flags, 0, 1);
        shared.remove(0, 99);
        assert.equal(Atomics.load(shared.flags, 1), 7);
        shared.remove(0, 7);
        assert.equal(shared.read(0, out), false);
    });
    it("reclaims a slot whose owner crashed during a write, including before its first identity publication", () => {
        const shared = new SharedWorld(createSharedWorld(1));
        Atomics.store(shared.flags, 0, 1);
        shared.values[1] = 123;
        shared.reclaimAfterWriterExit(0);
        const pose = { ...blankPose(0), id: 99, x: 4, revision: 1 };
        shared.write(pose);
        const out = blankPose(0);
        assert(shared.read(0, out));
        assert.equal(out.id, 99);
        assert.equal(out.x, 4);
        const priorGeneration = Atomics.load(shared.flags, 0);
        Atomics.add(shared.flags, 0, 1);
        shared.reclaimAfterWriterExit(0);
        shared.write({ ...pose, id: 100 });
        assert.notEqual(Atomics.load(shared.flags, 0), priorGeneration);
        assert(shared.read(0, out));
        assert.equal(out.id, 100);
    });
    it("caps dense 10,000-player queries and preserves pinned nearby interest", () => {
        const actors = new Map<number, any>();
        for (let id = 1; id <= 10000; id++) actors.set(id, { ...blankPose(id - 1), id });
        const index = new InterestIndex();
        index.rebuild(actors.values());
        const selected = index.select(actors.get(1), [], actors, [9999]);
        assert.equal(selected.length, 128);
        assert(selected.includes(9999));
        assert(!selected.includes(1));
        assert(index.candidateVisits <= CANDIDATE_LIMIT);
        assert.deepEqual(index.select(actors.get(1), selected, actors, [9999]), selected);
    });
    it("validates movement and advances stationary snapshot sequences", async () => {
        const shared = createSharedWorld(4),
            messages: any[] = [],
            packets: Uint8Array[] = [],
            gateway = new WorldGateway({ owner: 0, shared, epoch: 123, roomId: "world", region: "local", post: () => {} }),
            endpoint = {
                sendControl: (type: string, data: any) => {
                    messages.push({ type, data });
                    return true;
                },
                sendDatagram: (bytes: Uint8Array) => {
                    packets.push(bytes.slice());
                    return true;
                },
                bufferedAmount: () => 0,
                close: () => {},
            };
        for (let id = 1; id <= 2; id++) {
            gateway.reserve({ id, slot: id - 1, owner: 0, token: `token${id}`, expires: Date.now() + 10000, profile: profile(id) });
            assert.equal(await gateway.accept(`token${id}`, endpoint), String(id));
            gateway.receiveControl(String(id), "lobby-ready", {});
        }
        gateway.step();
        const spawn = messages.find((m) => m.type === "lobby-welcome").data.position;
        gateway.receiveDatagram("1", encodeMovement({ sequence: 1, x: spawn[0] + 100, y: 0, z: spawn[2], yaw: 0, animation: -1, floor: true }));
        gateway.step();
        assert(messages.some((m) => m.type === "lobby-ack" && m.data.corrected));
        const first = packets
            .map(decodeSnapshot)
            .filter(Boolean)
            .flatMap((p) => p!.poses)
            .find((p) => p[0] === 1)!;
        await wait(510);
        gateway.step();
        assert(
            packets
                .map(decodeSnapshot)
                .filter(Boolean)
                .flatMap((p) => p!.poses)
                .some((p) => p[0] === 1 && p[1] > first[1])
        );
        assert.equal(await gateway.accept("token1", endpoint), null);
        gateway.stop();
    });
    it("routes private chat to one recipient across gateway owners without a public broadcast", async () => {
        const shared = createSharedWorld(3), deliveries = new Map<number, any[]>(),
            relays: any[] = [], gateways: WorldGateway[] = [];
        const post = (message: any) => {
            if (message.type === "profile") for (const gateway of gateways) gateway.member(message.member);
            if (message.type === "relay") {
                relays.push(message);
                for (const to of message.to) for (const gateway of gateways) gateway.deliver(message.from, to, message.event, message.data);
            }
        };
        for (let owner = 0; owner < 2; owner++) gateways.push(new WorldGateway({ owner, shared, epoch: 1, roomId: "world", region: "local", post }));
        try {
            for (let id = 1; id <= 3; id++) {
                const owner = id === 2 ? 1 : 0, gateway = gateways[owner], events: any[] = [];
                deliveries.set(id, events);
                gateway.reserve({ id, slot: id - 1, owner, token: `dm${id}`, expires: Date.now() + 10000, profile: profile(id) });
                await gateway.accept(`dm${id}`, { sendControl: (type, data) => { events.push({ type, data }); return true; }, sendDatagram: () => true, bufferedAmount: () => 0, close: () => {} });
                for (const other of gateways) other.member(gateway.members.get(id)!);
                gateway.receiveControl(String(id), "lobby-ready", {});
            }
            gateways[0].receiveControl("1", "chat-peer", { to: "2", from: "3", data: { type: "MESSAGE", text: " Private hello ", username: "spoofed" } });
            assert.deepStrictEqual(relays[0].to, [2]);
            const message = deliveries.get(2)!.find((event) => event.type === "chat-peer").data;
            assert.strictEqual(message.from, "1");
            assert.strictEqual(message.to, "2");
            assert.deepStrictEqual(message.profile, { username: "Guest", avatar: "" });
            assert.strictEqual(typeof message.server_ts, "number");
            assert.deepStrictEqual(message.data, { type: "MESSAGE", text: "Private hello" });
            assert(!deliveries.get(1)!.some((event) => event.type.startsWith("chat-")));
            assert(!deliveries.get(3)!.some((event) => event.type.startsWith("chat-")));
            gateways[0].receiveControl("1", "chat-peer", { to: "99", data: { type: "MESSAGE", text: "Missing" } });
            gateways[0].receiveControl("1", "chat-peer", { to: "1", data: { type: "MESSAGE", text: "Self" } });
            gateways[0].receiveControl("1", "chat-peer", { to: "2", data: { type: "RTM_COMMAND", text: "Not chat" } });
            gateways[0].deliver(1, 3, "chat-peer", message);
            assert.strictEqual(relays.length, 1);
            assert(!deliveries.get(3)!.some((event) => event.type.startsWith("chat-")));
        } finally {
            for (const gateway of gateways) gateway.stop();
        }
    });
    it("coalesces movement bursts to the latest sequence before simulation", async () => {
        const shared = createSharedWorld(2),
            gateway = new WorldGateway({ owner: 0, shared, epoch: 1, roomId: "world", region: "local", post: () => {} }),
            endpoint = { sendControl: () => true, sendDatagram: () => true, bufferedAmount: () => 0, close: () => {} };
        gateway.reserve({ id: 1, slot: 0, owner: 0, token: "burst", expires: Date.now() + 10000, profile: profile(1) });
        await gateway.accept("burst", endpoint);
        gateway.receiveControl("1", "lobby-ready", {});
        const pose = blankPose(0),
            reader = new SharedWorld(shared);
        reader.read(0, pose);
        for (let sequence = 1; sequence <= 200; sequence++) gateway.receiveDatagram("1", encodeMovement({ sequence, x: pose.x + 0.2, y: 0, z: pose.z, yaw: 0, animation: -1, floor: true }));
        reader.read(0, pose);
        assert.equal(pose.sequence, 0);
        gateway.step();
        reader.read(0, pose);
        assert.equal(pose.sequence, 200);
        assert.equal(gateway.stats().corrections, 0);
        gateway.stop();
    });
    it("uses explicit high-density limits with hysteresis and announces changes", async () => {
        const messages: any[] = [],
            gateway = new WorldGateway({ owner: 0, detailThreshold: 2, shared: createSharedWorld(4), epoch: 1, roomId: "world", region: "local", post: () => {} }),
            endpoint = {
                sendControl: (type: string, data: any) => {
                    messages.push({ type, data });
                    return true;
                },
                sendDatagram: () => true,
                bufferedAmount: () => 0,
                close: () => {},
            };
        gateway.reserve({ id: 1, slot: 0, owner: 0, token: "density", expires: Date.now() + 10000, profile: profile(1) });
        await gateway.accept("density", endpoint);
        gateway.receiveControl("1", "lobby-ready", {});
        gateway.member({ id: 2, slot: 1, owner: 1, revision: 1, profile: profile(2) });
        gateway.step();
        assert.equal(gateway.stats().networkBudget, 128);
        gateway.member({ id: 3, slot: 2, owner: 1, revision: 1, profile: profile(3) });
        gateway.step();
        assert.equal(gateway.stats().networkBudget, 64);
        assert(messages.some((m) => m.type === "lobby-config" && m.data.aoiLimit === 64 && m.data.snapshotBands.join(",") === "8,32,64"));
        gateway.remove(3);
        gateway.step();
        assert.equal(gateway.stats().networkBudget, 64);
        gateway.remove(2);
        gateway.remove(1);
        gateway.step();
        assert.equal(gateway.stats().networkBudget, 128);
        gateway.stop();
    });
    it("closes a connection when a reliable control cannot be queued", async () => {
        let closes = 0;
        const gateway = new WorldGateway({ owner: 0, shared: createSharedWorld(2), epoch: 1, roomId: "world", region: "local", post: () => {} });
        gateway.reserve({ id: 1, slot: 0, owner: 0, token: "full", expires: Date.now() + 10000, profile: profile(1) });
        await gateway.accept("full", {
            sendControl: () => false,
            sendDatagram: () => true,
            bufferedAmount: () => 0,
            close: () => {
                closes++;
            },
        });
        assert(closes > 0);
        gateway.stop();
    });
    it("chunks large rosters below the reliable UTF-8 frame budget", async () => {
        const sizes: number[] = [],
            gateway = new WorldGateway({ owner: 0, shared: createSharedWorld(40), epoch: 1, roomId: "world", region: "local", post: () => {} }),
            endpoint = {
                sendControl: (type: string, data: any) => {
                    sizes.push(Buffer.byteLength(JSON.stringify({ type, data })));
                    return true;
                },
                sendDatagram: () => true,
                bufferedAmount: () => 0,
                close: () => {},
            };
        for (let id = 1; id <= 40; id++) {
            gateway.reserve({ id, slot: id - 1, owner: 0, token: `t${id}`, expires: Date.now() + 10000, profile: { ...profile(id), VRM: "https://a/" + "x".repeat(2000), avatar: "https://b/" + "x".repeat(2000) } });
            await gateway.accept(`t${id}`, endpoint);
            gateway.receiveControl(String(id), "lobby-ready", {});
        }
        gateway.step();
        assert(sizes.every((size) => size < 16384));
        gateway.stop();
    });
});
for (const singlePort of [false, true]) describe(`shared world cross-worker admission (single port: ${singlePort})`, function () {
    this.timeout(20000);
    let world: Awaited<ReturnType<typeof createWorldServer>>;
    let previousIdentitySecret: string | undefined;
    const sockets: WebSocket[] = [],
        base = "http://127.0.0.1:2660";
    before(async () => {
        previousIdentitySecret = process.env.LOBBY_IDENTITY_SECRET;
        process.env.LOBBY_IDENTITY_SECRET = "wire-lobby-identity-secret-at-least-32";
        world = await createWorldServer({ port: 2660, wsBase: 2661, workers: 2, capacity: 2, testMode: true, webtransport: false, singlePort, adminPort: singlePort ? 2664 : undefined });
    });
    after(async () => {
        for (const ws of sockets) ws.terminate();
        await world.close();
        if (previousIdentitySecret === undefined) delete process.env.LOBBY_IDENTITY_SECRET; else process.env.LOBBY_IDENTITY_SECRET = previousIdentitySecret;
    });
    async function join(body: any = {}) {
        const response = await fetch(base + "/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lobbyProtocol: 2, ...body }) });
        return { status: response.status, ticket: (await response.json()) as any };
    }
    async function connect(ticket: any) {
        const events: any[] = [],
            ws = new WebSocket(ticket.wsUrl);
        sockets.push(ws);
        await new Promise<void>((resolve, reject) => {
            ws.once("error", reject);
            ws.on("open", () => ws.send(JSON.stringify({ type: "session", data: { token: ticket.token } })));
            ws.on("message", (raw: any, binary?: boolean) => {
                if (typeof binary === "boolean" ? binary : typeof raw !== "string") return;
                const m = JSON.parse(raw.toString());
                events.push(m);
                if (m.type === "session-accepted") ws.send(JSON.stringify({ type: "lobby-ready", data: {} }));
                if (m.type === "lobby-welcome") resolve();
            });
        });
        return { ws, events };
    }
    it("shares population across gateways and revokes active seats before reusing them", async () => {
        const partyIdentity = lobbyPartyIdentity("canonical-alice");
        const a = await join({ lobbyIdentityToken: mintLobbyIdentity("canonical-alice").token, userId: "untrusted", partyIdentity: "forged" }),
            b = await join({ userId: "canonical-alice", partyIdentity });
        assert.notEqual(a.ticket.wsUrl, b.ticket.wsUrl);
        if (singlePort) {
            assert.equal(new URL(a.ticket.wsUrl).port, "2660");
            assert.equal((await fetch("http://127.0.0.1:2664/lobby/metrics")).status, 200);
        }
        const ca = await connect(a.ticket),
            cb = await connect(b.ticket);
        await wait(300);
        assert(ca.events.some((m) => m.type === "lobby-roster" && m.data.enter.some((p: any) => p.sessionId === b.ticket.sessionId)));
        assert(cb.events.some((m) => m.type === "lobby-roster" && m.data.enter.some((p: any) => p.sessionId === a.ticket.sessionId)));
        assert.equal(ca.events.find(m => m.type === "lobby-welcome").data.partyIdentity, partyIdentity);
        assert(ca.events.some(m => m.type === "lobby-roster" && m.data.enter.some((p: any) => p.sessionId === b.ticket.sessionId && p.partyIdentity === undefined)));
        assert(cb.events.some(m => m.type === "lobby-roster" && m.data.enter.some((p: any) => p.sessionId === a.ticket.sessionId && p.partyIdentity === partyIdentity)));
        ca.ws.send(JSON.stringify({ type: "lobby-profile", data: { username: "Changed", partyIdentity: "B".repeat(43) } }));
        await wait(300);
        assert(cb.events.some(m => m.type === "lobby-roster" && m.data.enter.some((p: any) => p.sessionId === a.ticket.sessionId && p.username === "Changed" && p.partyIdentity === partyIdentity)));
        assert(!JSON.stringify(cb.events).includes("lobbyIdentityToken"));
        assert.equal((await world.metrics()).population, 2);
        assert.equal((await join()).status, 503);
        const replacement = await join({ replaceToken: a.ticket.token });
        assert.equal(replacement.status, 200);
        await connect(replacement.ticket);
        await wait(100);
        assert.equal(ca.ws.readyState, WebSocket.CLOSED);
        const metrics = await world.metrics();
        assert.equal(metrics.population, 2);
        assert.equal(metrics.reservations, 0);
        assert.equal(
            metrics.workers.reduce((n: number, w: any) => n + w.connections, 0),
            2
        );
        const replay = new WebSocket(replacement.ticket.wsUrl);
        sockets.push(replay);
        const code = await new Promise<number>((resolve) => {
            replay.on("open", () => replay.send(JSON.stringify({ type: "session", data: { token: replacement.ticket.token } })));
            replay.on("close", resolve);
        });
        assert.equal(code, 4003);
    });
});
