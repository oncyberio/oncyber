import assert from "assert";
import { WorldGateway } from "../src/world/gateway";
import { createSharedWorld } from "../src/world/shared";
import { VOICE_LIMIT } from "../src/rooms/crowd/protocol";

async function fixture(count: number) {
    const shared = createSharedWorld(count);
    const gateways: WorldGateway[] = [];
    const events = new Map<number, Array<{ type: string; data: any }>>();
    const owners = new Map<number, WorldGateway>();
    const post = (message: any) => {
        if (message.type === "relay")
            for (const to of message.to)
                for (const gateway of gateways) gateway.deliver(message.from, to, message.event, message.data);
        if (message.type === "left")
            for (const gateway of gateways) gateway.remove(message.id);
    };
    for (let owner = 0; owner < 2; owner++)
        gateways.push(new WorldGateway({ owner, shared, epoch: 1, roomId: "voice", region: "local", post }));
    for (let id = 1; id <= count; id++) {
        const owner = (id - 1) % 2, gateway = gateways[owner], received: Array<{ type: string; data: any }> = [];
        owners.set(id, gateway);
        events.set(id, received);
        gateway.reserve({
            id, slot: id - 1, owner, token: `voice-${id}`, expires: Date.now() + 10000,
            profile: { sessionId: String(id), userId: `guest:${id}`, username: "Guest", avatar: "", VRM: "", scale: 1 },
        });
        assert.equal(await gateway.accept(`voice-${id}`, {
            sendControl: (type, data) => { received.push({ type, data }); return true; },
            sendDatagram: () => true, bufferedAmount: () => 0, close: () => {},
        }), String(id));
        for (const other of gateways) other.member(gateway.members.get(id)!);
        gateway.receiveControl(String(id), "lobby-ready", {});
        gateway.receiveControl(String(id), "rtc-ready", { enabled: true });
    }
    const connection = (id: number) => owners.get(id)!.sessions.get(String(id))!;
    const move = (id: number, x: number, z = 0) => {
        const c = connection(id);
        Object.assign(c.pose, { x, y: 0, z, revision: c.pose.revision + 1 });
        Object.assign(c.person, { x, y: 0, z });
        owners.get(id)!.shared.write(c.pose);
    };
    for (let id = 1; id <= count; id++) move(id, 0);
    const advance = () => {
        // Allow both phased cross-worker proposals and their mutual acknowledgements.
        for (let tick = 0; tick < 12; tick++) for (const gateway of gateways) gateway.step();
        for (const gateway of gateways)
            for (const c of gateway.sessions.values()) {
                assert(c.voice.length <= VOICE_LIMIT);
                for (const id of c.voice) assert(connection(id).voice.includes(c.id));
            }
    };
    const send = (id: number, type: string, data: any) => owners.get(id)!.receiveControl(String(id), type, data);
    return { gateways, events, connection, move, advance, send, stop: () => gateways.forEach((gateway) => gateway.stop()) };
}

describe("shared-world voice selection", () => {
    it("retains a cross-worker pair through 12m jitter, gates signaling, and tears down on mute/disconnect", async () => {
        const f = await fixture(2);
        try {
            f.move(2, 13); f.advance();
            assert.deepStrictEqual(f.connection(1).voice, []);
            f.move(2, 11.9); f.advance();
            assert.deepStrictEqual(f.connection(1).voice, [2]);
            const changes = () => f.events.get(1)!.filter((event) => ["rtc-join", "rtc-leave", "lobby-voice"].includes(event.type)).length;
            const initialChanges = changes();
            for (const x of [12.1, 11.9, 13.9, 12.2]) {
                f.move(2, x); f.advance();
                assert.deepStrictEqual(f.connection(1).voice, [2]);
            }
            assert.equal(changes(), initialChanges, "distance jitter must not renegotiate the pair");
            const signals = () => f.events.get(2)!.filter((event) => event.type === "rtc-signal").length;
            const signal = () => f.send(1, "rtc-signal", { to: "2", payload: { kind: "candidate", candidate: "test" } });
            signal(); assert.equal(signals(), 1);
            f.move(2, 14.1); f.advance();
            assert.deepStrictEqual(f.connection(1).voice, []);
            signal(); assert.equal(signals(), 1);
            f.move(2, 13); f.advance();
            assert.deepStrictEqual(f.connection(1).voice, []);
            f.move(2, 11.9); f.advance();
            f.send(2, "rtc-ready", { enabled: false }); f.advance();
            assert.deepStrictEqual(f.connection(1).voice, []);
            signal(); assert.equal(signals(), 1);
            f.send(2, "rtc-ready", { enabled: true }); f.advance();
            assert.deepStrictEqual(f.connection(1).voice, [2]);
            f.gateways[1].disconnect("2"); f.advance();
            assert.deepStrictEqual(f.connection(1).voice, []);
        } finally { f.stop(); }
    });

    it("keeps the eight-peer audio budget stable when a visual pin or slightly nearer newcomer changes ordering", async () => {
        const f = await fixture(10);
        try {
            f.advance();
            const initial = [...f.connection(1).voice];
            assert.equal(initial.length, 8);
            const newcomer = Array.from({ length: 9 }, (_, i) => i + 2).find((id) => !initial.includes(id))!;
            const count = () => f.events.get(1)!.filter((event) => ["rtc-join", "rtc-leave", "lobby-voice"].includes(event.type)).length;
            const initialCount = count();
            f.send(1, "lobby-interest", { peers: [String(newcomer)] });
            for (const id of initial) f.move(id, 0.15);
            f.move(newcomer, 0.05);
            f.advance();
            assert.equal(f.connection(1).visible[0], newcomer, "the visual pin actually changed visual order");
            assert.deepStrictEqual(f.connection(1).voice, initial);
            assert.equal(count(), initialCount, "visual ordering must not churn audio subscriptions");
            f.move(initial[0], 20); f.advance();
            assert(!f.connection(1).voice.includes(initial[0]));
            assert(f.connection(1).voice.includes(newcomer));
        } finally { f.stop(); }
    });
});
