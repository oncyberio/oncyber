import assert from "assert";
import { WorldGateway } from "../src/world/gateway";
import { createSharedWorld, VOICE_PICKS, VOICE_HEARERS } from "../src/world/shared";
import { StageAuthority } from "../src/world/stage";

/** Actor 1 is the main admin. `speakers` start on voice, as if an admin added them. */
async function fixture(count: number, { speakers = [] as number[], limit = undefined as number | undefined } = {}) {
    const stage = new StageAuthority(limit);
    const closed = new Set<number>();
    const shared = createSharedWorld(count);
    const gateways: WorldGateway[] = [];
    const events = new Map<number, Array<{ type: string; data: any }>>();
    const owners = new Map<number, WorldGateway>();
    const post = (message: any) => {
        if (message.type === "relay") for (const to of message.to) for (const gateway of gateways) gateway.deliver(message.from, to, message.event, message.data);
        if (message.type === "left") {
            stage.leave(message.id);
            for (const gateway of gateways) gateway.remove(message.id);
        }
        if (message.type === "stage-action" && message.data.kind === "summon") {
            if (stage.role(message.actor)) for (const gateway of gateways) gateway.summon(message.actor);
            return;
        }
        if (message.type === "profile") for (const gateway of gateways) gateway.member(message.member);
        if (message.type === "stage-action") {
            const { data, actor } = message;
            if (data.kind === "request") stage.request(actor, data.cancel);
            else if (data.kind === "leave") stage.leaveStage(actor);
            else {
                const outcome = stage.admin(actor, data.action, Number(data.sessionId));
                owners.get(actor)!.deliverStageResult(actor, { action: data.action, sessionId: data.sessionId, ok: outcome.ok, error: outcome.error || "" });
                if (outcome.kick) owners.get(outcome.kick)!.kick(outcome.kick);
            }
        }
        publish();
    };
    const publish = () => {
        for (const gateway of gateways) gateway.setStage(stage.snapshot());
    };
    for (let owner = 0; owner < 2; owner++) gateways.push(new WorldGateway({ owner, shared, epoch: 1, roomId: "voice", region: "local", post }));
    for (let id = 1; id <= count; id++) {
        const owner = (id - 1) % 2,
            gateway = gateways[owner],
            received: Array<{ type: string; data: any }> = [];
        owners.set(id, gateway);
        events.set(id, received);
        gateway.reserve({
            id,
            slot: id - 1,
            owner,
            token: `voice-${id}`,
            expires: Date.now() + 10000,
            profile: { sessionId: String(id), userId: `guest:${id}`, username: "Guest", avatar: "", VRM: "", scale: 1 },
        });
        assert.equal(
            await gateway.accept(`voice-${id}`, {
                sendControl: (type, data) => {
                    received.push({ type, data });
                    return true;
                },
                sendDatagram: () => true,
                bufferedAmount: () => 0,
                close: () => closed.add(id),
            }),
            String(id)
        );
        stage.join(id, `account-${id}`, true, id === 1 ? "owner" : undefined);
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
    for (const id of speakers) stage.admin(1, "stage-add", id);
    publish();
    const advance = () => {
        // Allow both phased cross-worker proposals and their mutual acknowledgements.
        for (let tick = 0; tick < 12; tick++) for (const gateway of gateways) gateway.step();
        for (const gateway of gateways)
            for (const c of gateway.sessions.values()) {
                assert(c.voice.length <= (stage.snapshot().speakers.includes(c.id) ? VOICE_PICKS + VOICE_HEARERS : VOICE_PICKS));
                for (const id of c.voice) assert(connection(id).voice.includes(c.id));
            }
    };
    const send = (id: number, type: string, data: any) => owners.get(id)!.receiveControl(String(id), type, data);
    const last = (id: number, type: string) => [...events.get(id)!].reverse().find((event) => event.type === type)?.data;
    return { gateways, events, connection, move, advance, send, last, closed, stage, stop: () => gateways.forEach((gateway) => gateway.stop()) };
}

describe("shared-world voice selection", () => {
    it("retains a cross-worker pair through 120-150 m jitter, gates signaling, and tears down on mute/disconnect", async () => {
        const f = await fixture(2, { speakers: [1, 2] });
        try {
            f.move(2, 121);
            f.advance();
            assert.deepStrictEqual(f.connection(1).voice, []);
            f.move(2, 119);
            f.advance();
            assert.deepStrictEqual(f.connection(1).voice, [2]);
            const changes = () => f.events.get(1)!.filter((event) => ["rtc-join", "rtc-leave", "lobby-voice"].includes(event.type)).length;
            const initialChanges = changes();
            for (const x of [121, 119, 149, 122]) {
                f.move(2, x);
                f.advance();
                assert.deepStrictEqual(f.connection(1).voice, [2]);
            }
            assert.equal(changes(), initialChanges, "distance jitter must not renegotiate the pair");
            const signals = () => f.events.get(2)!.filter((event) => event.type === "rtc-signal").length;
            const signal = () => f.send(1, "rtc-signal", { to: "2", payload: { kind: "candidate", candidate: "test" } });
            signal();
            assert.equal(signals(), 1);
            f.move(2, 151);
            f.advance();
            assert.deepStrictEqual(f.connection(1).voice, []);
            signal();
            assert.equal(signals(), 1);
            f.move(2, 121);
            f.advance();
            assert.deepStrictEqual(f.connection(1).voice, []);
            f.move(2, 119);
            f.advance();
            f.send(2, "rtc-ready", { enabled: false });
            f.advance();
            assert.deepStrictEqual(f.connection(1).voice, []);
            signal();
            assert.equal(signals(), 1);
            f.send(2, "rtc-ready", { enabled: true });
            f.advance();
            assert.deepStrictEqual(f.connection(1).voice, [2]);
            f.gateways[1].disconnect("2");
            f.advance();
            assert.deepStrictEqual(f.connection(1).voice, []);
        } finally {
            f.stop();
        }
    });

    it("keeps the eight-peer audio budget stable when a visual pin or slightly nearer newcomer changes ordering", async () => {
        const f = await fixture(10, { speakers: Array.from({ length: 10 }, (_, i) => i + 1), limit: 10 });
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
            f.move(initial[0], 200);
            f.advance();
            assert(!f.connection(1).voice.includes(initial[0]));
            assert(f.connection(1).voice.includes(newcomer));
        } finally {
            f.stop();
        }
    });

    it("keeps everyone listen-only until an admin approves their request", async () => {
        const f = await fixture(4);
        try {
            f.advance();
            for (let id = 1; id <= 4; id++) assert.deepStrictEqual(f.connection(id).voice, [], "nobody talks before an admin allows it");
            assert.equal(f.last(2, "lobby-stage").role, null);
            assert.equal(f.last(1, "lobby-stage").role, "owner");
            f.send(2, "lobby-voice-request", {});
            f.advance();
            assert.equal(f.last(2, "lobby-stage").requested, true);
            assert.deepStrictEqual(
                f.last(1, "lobby-stage").requests.map((p: any) => p.sessionId),
                ["2"],
                "the admin sees the request"
            );
            assert.deepStrictEqual(f.last(3, "lobby-stage").requests, [], "other visitors don't");
            f.send(3, "lobby-admin", { action: "stage-add", sessionId: "3" });
            assert.equal(f.last(3, "lobby-admin-result").ok, false, "only admins approve");
            f.send(1, "lobby-admin", { action: "stage-add", sessionId: "2" });
            f.advance();
            assert.equal(f.last(1, "lobby-admin-result").ok, true);
            assert.deepStrictEqual(f.last(1, "lobby-stage").requests, []);
            assert.deepStrictEqual(
                f.last(2, "lobby-stage").speakers.map((p: any) => p.sessionId),
                ["2"]
            );
            // Listeners hear the speaker one way; listeners never link to each other.
            assert.deepStrictEqual(f.connection(3).voice, [2]);
            assert.deepStrictEqual(f.last(3, "lobby-voice").listenOnly, ["2"]);
            assert.deepStrictEqual(f.connection(2).voice, [1, 3, 4]);
            assert.deepStrictEqual(f.last(2, "lobby-voice").speakOnly, ["1", "3", "4"]);
            const signals = () => f.events.get(4)!.filter((event) => event.type === "rtc-signal").length;
            f.send(3, "rtc-signal", { to: "4", payload: { kind: "candidate", candidate: "x" } });
            assert.equal(signals(), 0, "two listeners can't signal each other");
            // Like spaces: heard well beyond the visible crowd, but not past 150 m.
            f.move(4, 100);
            f.advance();
            assert.deepStrictEqual(f.connection(4).voice, [2]);
            f.move(4, 200);
            f.advance();
            assert.deepStrictEqual(f.connection(4).voice, []);
            assert(!f.connection(2).voice.includes(4));
            // Removing the speaker ends every link.
            f.send(1, "lobby-admin", { action: "stage-remove", sessionId: "2" });
            f.advance();
            for (let id = 1; id <= 4; id++) assert.deepStrictEqual(f.connection(id).voice, []);
        } finally {
            f.stop();
        }
    });

    it("caps speakers, and mute or kick take people off voice", async () => {
        const f = await fixture(7, { speakers: [2, 3, 4, 5, 6], limit: 5 });
        try {
            f.advance();
            f.send(1, "lobby-admin", { action: "stage-add", sessionId: "7" });
            assert.deepStrictEqual(f.last(1, "lobby-admin-result"), { action: "stage-add", sessionId: "7", ok: false, error: "Voice is full (5 speakers)." });
            f.send(1, "lobby-admin", { action: "mute", sessionId: "6" });
            f.advance();
            assert.equal(f.last(6, "lobby-stage").muted, true);
            assert(!f.last(6, "lobby-stage").speakers.some((p: any) => p.sessionId === "6"));
            f.send(6, "lobby-voice-request", {});
            f.advance();
            assert.deepStrictEqual(f.last(1, "lobby-stage").requests, [], "a muted visitor can't ask");
            f.send(1, "lobby-admin", { action: "stage-add", sessionId: "7" });
            assert.equal(f.last(1, "lobby-admin-result").ok, true);
            f.send(1, "lobby-admin", { action: "kick", sessionId: "5" });
            f.advance();
            assert(f.closed.has(5));
            assert.equal(f.last(5, "kick").reason, "Removed by an admin");
            assert(f.stage.banned("account-5"));
            assert.deepStrictEqual(
                f.last(1, "lobby-stage").speakers.map((p: any) => p.sessionId),
                ["2", "3", "4", "7"]
            );
        } finally {
            f.stop();
        }
    });

    it("allows eight speakers by default and rejects a ninth", async () => {
        const f = await fixture(10, { speakers: [1, 2, 3, 4, 5, 6, 7, 8] });
        try {
            f.advance();
            assert.equal(f.last(1, "lobby-stage").limit, 8);
            assert.equal(f.last(1, "lobby-stage").speakers.length, 8);
            assert.equal(f.last(10, "lobby-voice").listenOnly.length, 8);
            f.send(1, "lobby-admin", { action: "stage-add", sessionId: "9" });
            assert.equal(f.last(1, "lobby-admin-result").ok, false);
            assert.equal(f.stage.snapshot().speakers.length, 8);
        } finally {
            f.stop();
        }
    });

    it("serves 200 listeners across workers beyond visual interest and replaces a departed listener", async () => {
        const f = await fixture(210, { speakers: [1] });
        try {
            f.advance();
            const speaker = f.connection(1);
            assert.equal(speaker.voice.length, 200);
            assert.equal(f.last(1, "lobby-voice").speakOnly.length, 200);
            const outsideView = speaker.voice.find((id) => !speaker.visible.includes(id))!;
            assert(outsideView, "audio must reach listeners beyond the visible crowd");
            assert.deepStrictEqual(f.last(outsideView, "lobby-voice").listenOnly, ["1"]);
            assert.deepStrictEqual(f.last(outsideView, "lobby-voice").speakOnly, []);
            // Signaling must not depend on visual AOI in either direction.
            f.send(1, "rtc-signal", { to: String(outsideView), payload: { kind: "offer", sdp: "test" } });
            assert.equal(f.last(outsideView, "rtc-signal").from, "1");
            f.send(outsideView, "rtc-signal", { to: "1", payload: { kind: "answer", sdp: "test" } });
            assert.equal(f.last(1, "rtc-signal").from, String(outsideView));
            // Approval starts every peer connection together. Each needs a
            // description plus trickled ICE, not one shared 40-message burst.
            const signalCount = (id: number) => f.events.get(id)!.filter((event) => event.type === "rtc-signal").length;
            const before = new Map(speaker.voice.map((id) => [id, signalCount(id)]));
            for (const id of speaker.voice) {
                f.send(1, "rtc-signal", { to: String(id), payload: { kind: "offer", offer: { offer: { type: "offer", sdp: "crowd" }, map: {} } } });
                for (let i = 0; i < 3; i++) f.send(1, "rtc-signal", { to: String(id), payload: { kind: "candidate", candidate: { candidate: `candidate:${i}` } } });
            }
            assert(!f.closed.has(1), "a speaker negotiating its allowed listeners must stay connected");
            for (const id of speaker.voice) assert.equal(signalCount(id), before.get(id)! + 4, `listener ${id} receives its offer and ICE`);
            const waiting = Array.from({ length: 209 }, (_, i) => i + 2).find((id) => !speaker.voice.includes(id))!;
            assert.deepStrictEqual(f.connection(waiting).voice, []);
            f.send(outsideView, "rtc-ready", { enabled: false });
            f.advance();
            assert.equal(speaker.voice.length, 200);
            assert(!speaker.voice.includes(outsideView));
            assert(speaker.voice.includes(waiting), "the next listener takes the freed audio slot");
            assert.deepStrictEqual(f.last(waiting, "lobby-voice").listenOnly, ["1"]);
            assert(f.events.get(1)!.some((event) => event.type === "rtc-leave" && event.data.sessionId === String(outsideView)));
        } finally {
            f.stop();
        }
    });

    it("bounds signaling per approved peer, keeps unrelated traffic bounded and releases peer budgets", async () => {
        const f = await fixture(3, { speakers: [1] });
        const realNow = Date.now;
        try {
            f.advance();
            const now = Date.now();
            Date.now = () => now;
            const signal = (to: number) => f.send(1, "rtc-signal", { to: String(to), payload: { kind: "candidate", candidate: { candidate: "test" } } });
            for (let i = 0; i < 60; i++) signal(2);
            assert.equal(f.events.get(2)!.filter((event) => event.type === "rtc-signal").length, 40, "one peer retains its bounded burst");
            signal(3);
            assert.equal(f.events.get(3)!.filter((event) => event.type === "rtc-signal").length, 1, "one peer cannot exhaust another peer's handshake budget");
            const speaker = f.connection(1);
            f.send(2, "rtc-ready", { enabled: false });
            f.advance();
            assert(!speaker.signalRates.has(2), "leaving voice releases the per-peer budget");
            for (let i = 0; i < 200; i++) signal(1000 + i);
            assert.equal(speaker.signalRates.size, 1, "unrelated targets cannot allocate rate buckets");
            assert(f.closed.has(1), "unrelated signal floods still close the sender");
            f.send(1, "rtc-ready", { enabled: false });
            assert.equal(speaker.signalRates.size, 0, "disabling local RTC immediately releases its budgets");
        } finally {
            Date.now = realNow;
            f.stop();
        }
    });

    it("reclaims a shared peer's budget when it leaves before the local voice event", async () => {
        const f = await fixture(2);
        try {
            f.advance();
            f.stage.admin(1, "stage-add", 1);
            f.stage.admin(1, "stage-add", 2);
            for (const gateway of f.gateways) gateway.setStage(f.stage.snapshot());
            // Worker 1 admits the mutual pair after worker 0 has already
            // checked its voice event. The first endpoint can answer now.
            for (let tick = 0; tick < 4; tick++) for (const gateway of f.gateways) gateway.step();
            assert.deepStrictEqual(f.connection(1).voice, []);
            assert.deepStrictEqual(f.connection(2).voice, [1]);
            f.send(1, "rtc-signal", { to: "2", payload: { kind: "answer", answer: { type: "answer", sdp: "test" } } });
            assert.equal(f.connection(1).signalRates.size, 1);
            f.send(2, "rtc-ready", { enabled: false });
            f.advance();
            assert.deepStrictEqual(f.connection(1).voice, []);
            assert.equal(f.connection(1).signalRates.size, 0, "no local membership change is needed to release the stale budget");
        } finally {
            f.stop();
        }
    });

    it("lets the main admin make an admin, who can then approve", async () => {
        const f = await fixture(3);
        try {
            f.send(1, "lobby-admin", { action: "grant-admin", sessionId: "2" });
            f.advance();
            assert.equal(f.last(2, "lobby-stage").role, "admin");
            assert.equal(f.gateways[0].members.get(2)!.profile.role, "admin", "the role reaches every worker's roster");
            f.send(3, "lobby-voice-request", {});
            f.send(2, "lobby-admin", { action: "stage-add", sessionId: "3" });
            f.advance();
            assert.equal(f.last(2, "lobby-admin-result").ok, true);
            f.send(2, "lobby-admin", { action: "mute", sessionId: "1" });
            assert.equal(f.last(2, "lobby-admin-result").ok, false, "admins can't moderate the main admin");
        } finally {
            f.stop();
        }
    });

    it("goes to someone, and lets an admin bring everyone further than 10 m", async () => {
        const f = await fixture(4);
        try {
            f.move(2, 40);
            f.move(3, 5);
            f.move(4, -30);
            f.advance();
            f.send(4, "lobby-teleport", { sessionId: "2" });
            const near = (a: number, b: number) => Math.hypot(f.connection(a).pose.x - f.connection(b).pose.x, f.connection(a).pose.z - f.connection(b).pose.z);
            assert(Math.abs(near(4, 2) - 2) < 1e-6, "lands 2 m from them");
            assert.equal(f.last(4, "lobby-group-position").travelId, "teleport");
            f.advance();
            f.send(3, "lobby-summon", {});
            assert(!f.events.get(2)!.some((e) => e.type === "lobby-summon"), "only admins summon");
            f.send(1, "lobby-summon", {});
            assert.equal(f.last(2, "lobby-summon").sessionId, "1");
            assert.equal(f.last(3, "lobby-summon"), undefined, "already within 10 m");
            f.send(2, "lobby-teleport", { sessionId: "1", radius: 10 });
            assert(Math.abs(near(2, 1) - 10) < 1e-6);
        } finally {
            f.stop();
        }
    });
});
