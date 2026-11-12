import { encodePose, encodeSnapshot } from "../src/rooms/crowd/snapshot";
import { getMessageBytes, Protocol } from "colyseus";
import assert from "assert";
import { CrowdModel, TokenBucket } from "../src/rooms/crowd/core";
import { profile, AOI_LIMIT, CANDIDATE_LIMIT, configuredCapacity, configuredRegion } from "../src/rooms/crowd/protocol";
const add = (model: CrowdModel, id: string, x = 0, z = 0) => {
    const p = model.add(id, profile(id, { userId: id }), 1000);
    p.x = x;
    p.z = z;
    model.index(p);
    return p;
};
describe("crowd lobby movement and spatial budgets", () => {
    it("ignores client spawn and caps teleports without allowing repeated burst slack", () => {
        const m = new CrowdModel(),
            p = m.add("p", profile("p", {}), 1000),
            start = [p.x, p.z];
        let ack = m.move(p, [1, 200, 50, 200, 0, -1, false], 1000)!;
        assert(ack.corrected);
        assert(Math.hypot(p.x - start[0], p.z - start[1]) <= 1.500001);
        const a = [p.x, p.z];
        for (let seq = 2; seq < 100; seq++) m.move(p, [seq, 200, 50, 200, 0, -1, false], 1000);
        assert(Math.hypot(p.x - a[0], p.z - a[1]) < 1e-8, "message bursts cannot mint distance");
        ack = m.move(p, [100, 200, 50, 200, 0, -1, false], 2000)!;
        assert(Math.hypot(p.x - a[0], p.z - a[1]) <= 1.500001, "a long stall cannot accumulate a teleport");
        assert(p.y <= 3);
        assert.strictEqual(ack.seq, 100);
    });
    it("accepts normal walking and rejects nonfinite, replayed and invalid animation input", () => {
        const m = new CrowdModel(),
            p = add(m, "p");
        for (let i = 1; i <= 40; i++) assert.strictEqual(m.move(p, [i, i * 0.3, 0, 0, 1, -1, true], 1000 + i * 50)!.corrected, false);
        const rev = p.revision;
        for (const packet of [
            [40, 10, 0, 0, 0, -1, true],
            [41, NaN, 0, 0, 0, -1, true],
            [41, 1, 0, 0, 0, 128, true],
            [41, 1, 0, 0, 0, -1, "true"],
        ])
            assert.strictEqual(m.move(p, packet, 4000), null);
        assert.strictEqual(p.revision, rev);
        assert.deepStrictEqual(m.pose(p), ["p", 1200, 0, 0, 1000, -1, 1]);
    });
    it("caps a 2048-person dense hotspot and retains stable membership", () => {
        const m = new CrowdModel();
        for (let i = 0; i < 2048; i++) add(m, `p${i}`);
        const p = m.people.get("p0")!;
        const first = Array.from(m.selectVisible(p));
        assert.strictEqual(first.length, AOI_LIMIT);
        assert(!p.visible.has(p.id));
        assert(m.lastCandidateVisits <= CANDIDATE_LIMIT);
        for (let i = 0; i < 10; i++) assert.deepStrictEqual(Array.from(m.selectVisible(p)), first);
        for (const id of first) m.remove(id);
        assert.strictEqual(m.selectVisible(p).size, AOI_LIMIT);
        assert(!Array.from(p.visible).some((id) => first.includes(id)));
    });
    it("uses range hysteresis and removes peers when they leave range or disconnect", () => {
        const m = new CrowdModel(),
            a = add(m, "a"),
            b = add(m, "b", 47);
        m.selectVisible(a);
        assert(a.visible.has("b"));
        b.x = 50;
        m.index(b);
        m.selectVisible(a);
        assert(a.visible.has("b"));
        b.x = 53;
        m.index(b);
        m.selectVisible(a);
        assert(!a.visible.has("b"));
        b.x = 0;
        m.index(b);
        m.selectVisible(a);
        m.remove("b");
        m.selectVisible(a);
        assert.strictEqual(a.visible.size, 0);
    });
    it("creates symmetric bounded voice edges and tears them down on mute/distance", () => {
        const m = new CrowdModel();
        for (let i = 0; i < 64; i++) {
            const p = add(m, `p${i}`, i % 8, Math.floor(i / 8));
            p.voiceReady = true;
        }
        m.updateVisibility();
        m.updateVoice();
        let edgeCount = 0;
        for (const p of m.people.values()) {
            assert(p.voice.size <= 8);
            edgeCount += p.voice.size;
            for (const id of p.voice) assert(m.people.get(id)!.voice.has(p.id));
        }
        assert(edgeCount > 0);
        const a = m.people.get("p0")!;
        a.voiceReady = false;
        m.updateVoice();
        assert.strictEqual(a.voice.size, 0);
        for (const p of m.people.values()) assert(!p.voice.has("p0"));
        a.voiceReady = true;
        a.x = 100;
        m.index(a);
        m.updateVisibility();
        m.updateVoice();
        assert.strictEqual(a.voice.size, 0);
    });
    it("cached snapshot encoding is byte-identical to the public Colyseus serializer", () => {
        const m = new CrowdModel();
        for (const count of [0, 1, 15, 16, 128]) {
            const poses = Array.from({ length: count }, (_, i) => m.pose(add(m, `player-${count}-${i}`, i - 60, -i)));
            const packet = encodeSnapshot(65537, 1800000000123, poses.map(encodePose));
            const baseline = Buffer.from(getMessageBytes[Protocol.ROOM_DATA]("lobby-snapshot", { tick: 65537, serverTime: 1800000000123, poses }));
            assert.deepStrictEqual(packet, baseline);
        }
        assert.throws(() => encodeSnapshot(1, 2, Array(129).fill(Buffer.from([0x90]))));
    });
    it("bounds rate credits and sanitizes profile values", () => {
        const bucket = new TokenBucket(2, 3, 0);
        assert(bucket.take(0));
        assert(bucket.take(0));
        assert(bucket.take(0));
        assert(!bucket.take(0));
        assert(bucket.take(500));
        assert(!bucket.take(500));
        const p = profile("id", { username: "a".repeat(100), avatar: "javascript:bad", VRM: "https://example.org/a.vrm", scale: 20 });
        assert.strictEqual(p.username.length, 40);
        assert.strictEqual(p.avatar, "");
        assert.strictEqual(p.scale, 2);
        assert.strictEqual(configuredCapacity(), Number(process.env.LOBBY_MAX_CLIENTS) || 512);
        assert.throws(() => configuredRegion("not-a-configured-region"));
    });
});
