import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import { Server } from "colyseus";
import { CrowdLobbyRoom } from "../src/rooms/crowd";
import { registerCrowdRoom } from "../src/rooms/crowd/join";
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(test: () => boolean) {
    const end = Date.now() + 3000;
    while (!test() && Date.now() < end) await wait(15);
    assert(test(), "Flash event arrived before timeout");
}
const artwork = { id: "one", title: "Artwork", imageUrl: "/art.png", nonce: "one", startedAt: 1 };
function observe(room: any) {
    const messages: Record<string, any[]> = {};
    room.onMessage("*", (type: string, data: any) => (messages[type] ||= []).push(data));
    return messages;
}
describe("crowd Flash over real websocket", () => {
    let server: ColyseusTestServer;
    before(async () => {
        const game = new Server();
        registerCrowdRoom(game);
        await game.listen(2581, "127.0.0.1");
        server = new ColyseusTestServer(game);
    });
    after(async () => server.shutdown());
    beforeEach(async () => server.cleanup());
    it("sends nearby Flash with server identity/time, roster hydration, movement clears and rate-independent stop", async () => {
        const room = (await server.createRoom("crowd-lobby", { region: "local" })) as CrowdLobbyRoom;
        const a = await server.connectTo(room, { userId: "a", flash: artwork }),
            b = await server.connectTo(room, { userId: "b" });
        const am = observe(a),
            bm = observe(b);
        a.send("lobby-ready", {});
        b.send("lobby-ready", {});
        await until(() => !!bm["lobby-roster"]?.some((m) => m.enter.some((p: any) => p.sessionId === a.sessionId)));
        assert.strictEqual(am["lobby-welcome"][0].flash, true);
        assert.equal(room.connections.get(a.sessionId)!.person.profile.flash, undefined);
        const before = Date.now();
        a.send("lobby-flash", { sessionId: b.sessionId, flash: artwork });
        await until(() => !!bm["lobby-flash"]?.length);
        const first = bm["lobby-flash"][0];
        assert.equal(first.sessionId, a.sessionId);
        assert(first.flash.startedAt >= before);
        a.send("lobby-profile", { username: "New name", flash: null });
        await until(() => room.connections.get(a.sessionId)!.person.profile.username === "New name");
        assert.equal(room.connections.get(a.sessionId)!.person.profile.flash!.nonce, "one");
        const c = await server.connectTo(room, { userId: "late" }),
            cm = observe(c);
        c.send("lobby-ready", {});
        await until(() => !!cm["lobby-roster"]?.some((m) => m.enter.some((p: any) => p.sessionId === a.sessionId && p.flash?.nonce === "one")));
        const person = room.connections.get(a.sessionId)!.person;
        a.send("lobby-move", [1, person.x + 0.1, person.y, person.z, 0, -1, true]);
        await until(() => bm["lobby-flash"]?.slice(-1)[0]?.flash === null);
        for (let i = 0; i < 10; i++) a.send("lobby-flash", { flash: { ...artwork, nonce: `next-${i}` } });
        await until(() => person.profile.flash?.nonce === "next-1");
        a.send("lobby-flash", { flash: null });
        await until(() => person.profile.flash === null && bm["lobby-flash"]?.slice(-1)[0]?.flash === null);
        const count = bm["lobby-flash"].length;
        a.send("lobby-flash", { flash: null });
        a.send("lobby-flash", { flash: { ...artwork, imageUrl: "javascript:bad" } });
        await wait(50);
        assert.equal(bm["lobby-flash"].length, count);
        assert.equal(person.profile.flash, null);
    });
    it("queues both start and stop reliably through temporary backpressure", async () => {
        const room = (await server.createRoom("crowd-lobby", { region: "local" })) as CrowdLobbyRoom;
        const a = await server.connectTo(room, { userId: "a" }),
            b = await server.connectTo(room, { userId: "b" });
        observe(a);
        const bm = observe(b);
        a.send("lobby-ready", {});
        b.send("lobby-ready", {});
        await until(() => !!bm["lobby-roster"]?.some((m) => m.enter.some((p: any) => p.sessionId === a.sessionId)));
        let amount = 300000;
        const target = room.connections.get(b.sessionId)!;
        Object.defineProperty(target.client.ref, "bufferedAmount", { configurable: true, get: () => amount });
        a.send("lobby-flash", { flash: artwork });
        a.send("lobby-flash", { flash: null });
        await until(() => target.controls.length === 2);
        amount = 0;
        await until(() => bm["lobby-flash"]?.length === 2);
        assert.equal(bm["lobby-flash"][0].flash.nonce, "one");
        assert.equal(bm["lobby-flash"][1].flash, null);
        assert.equal(target.controls.length, 0);
    });
});
