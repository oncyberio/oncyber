import assert from "assert";
import WebSocket from "ws";
import { decodePlayFrame, decodeSnapshot } from "../protocol/lobby-v2";
import { decodeBodies } from "../protocol/play-zone";
import { mintLobbyIdentity } from "../src/identity/lobby";
import { createWorldServer } from "../src/world/server";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const pit = { title: "Ball pit", seconds: 30, things: [{ kind: "ball", count: 40, size: 0.18 }] };

describe("a play zone in the shared world", function () {
    this.timeout(30000);
    let previousSecret: string | undefined;
    const worlds: Array<Awaited<ReturnType<typeof createWorldServer>>> = [],
        sockets: WebSocket[] = [];
    before(() => {
        previousSecret = process.env.LOBBY_IDENTITY_SECRET;
        process.env.LOBBY_IDENTITY_SECRET = "play-lobby-identity-secret-at-least-32";
    });
    after(async () => {
        for (const ws of sockets) ws.terminate();
        for (const world of worlds) await world.close();
        if (previousSecret === undefined) delete process.env.LOBBY_IDENTITY_SECRET;
        else process.env.LOBBY_IDENTITY_SECRET = previousSecret;
    });
    async function world(port: number, play: Parameters<typeof createWorldServer>[0]["play"]) {
        worlds.push(await createWorldServer({ port, wsBase: port + 1, workers: 2, capacity: 4, testMode: true, webtransport: false, play }));
        return `http://127.0.0.1:${port}`;
    }
    async function enter(base: string, body: any = {}) {
        const response = await fetch(base + "/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lobbyProtocol: 2, ...body }) });
        const ticket = (await response.json()) as any;
        const events: any[] = [],
            things = new Float32Array(400 * 7),
            seen = new Set<number>(),
            other: Uint8Array[] = [],
            ws = new WebSocket(ticket.wsUrl);
        sockets.push(ws);
        await new Promise<void>((resolve, reject) => {
            ws.once("error", reject);
            ws.on("open", () => ws.send(JSON.stringify({ type: "session", data: { token: ticket.token } })));
            ws.on("message", (raw: any, binary?: boolean) => {
                if (typeof binary === "boolean" ? binary : typeof raw !== "string") {
                    const bytes = new Uint8Array(raw),
                        frame = decodePlayFrame(bytes);
                    if (!frame) return void other.push(bytes);
                    for (const index of decodeBodies(frame, things)?.indices || []) seen.add(index);
                    return;
                }
                const m = JSON.parse(raw.toString());
                events.push(m);
                if (m.type === "session-accepted") ws.send(JSON.stringify({ type: "lobby-ready", data: {} }));
                if (m.type === "lobby-welcome") resolve();
            });
        });
        const send = (type: string, data: any = {}) => ws.send(JSON.stringify({ type, data }));
        const last = (type: string) => [...events].reverse().find((m) => m.type === type)?.data;
        return { ticket, ws, events, send, last, things, seen, other };
    }
    const admin = () => ({ lobbyIdentityToken: mintLobbyIdentity("play-owner", undefined, Date.now(), "owner").token, username: "Host" });
    const guest = () => ({ lobbyIdentityToken: mintLobbyIdentity("play-guest").token, username: "Guest" });

    it("runs a round started by an admin for people on different workers", async () => {
        const base = await world(2760, { origin: { x: 0, z: 0 }, radius: 70 });
        const host = await enter(base, admin()),
            visitor = await enter(base, guest());
        assert.notEqual(host.ticket.wsUrl, visitor.ticket.wsUrl, "the two land on different workers");
        assert.deepStrictEqual(host.last("lobby-welcome").play, { origin: { x: 0, z: 0 }, radius: 70 });
        await wait(300);

        // Only an admin may start or change the game here.
        visitor.send("play-start", { recipe: pit });
        await wait(300);
        assert.deepStrictEqual([visitor.last("play-ai").state, visitor.last("play-ai").say], ["failed", "Only an admin can change the game here."]);
        assert.strictEqual(host.last("play-game"), undefined);

        host.send("play-start", { recipe: pit });
        await wait(1200);
        for (const person of [host, visitor]) {
            const game = person.last("play-game");
            assert.deepStrictEqual([game.change, game.recipe.title, game.origin], ["start", "Ball pit", { x: 0, z: 0 }]);
            // Things arrive as datagrams of their own kind, and nothing else mistakes them for people.
            assert.strictEqual(person.seen.size, 40, "every thing was sent");
            assert.ok(person.things[1] > 0.1, "with a height above the floor");
            assert.ok(person.other.length > 0 && person.other.every((bytes) => decodeSnapshot(bytes)), "the room's own snapshots still decode");
            assert.ok(person.last("play-state").people >= 2);
        }

        // A change that fits takes over in place; one that does not rewinds first.
        host.send("play-change", { recipe: { ...pit, gravity: 2 } });
        await wait(400);
        assert.deepStrictEqual([visitor.last("play-game").change, visitor.last("play-game").recipe.gravity], ["live", 2]);
        host.send("play-change", { recipe: { ...pit, gravity: 2, things: [{ kind: "ball", count: 40, size: 0.4 }] } });
        await wait(400);
        assert.deepStrictEqual(visitor.last("play-rewind"), { seconds: 2.5 });
        await wait(3200);
        assert.deepStrictEqual([visitor.last("play-game").change, visitor.last("play-game").recipe.things[0].size], ["reset", 0.4]);

        // Anyone may swing; it is shown to everyone.
        visitor.send("play-act");
        await wait(300);
        assert.strictEqual(host.last("play-act").id, Number(visitor.ticket.sessionId));

        // Someone who arrives mid-round asks what is going on and is told.
        const late = await enter(base, { username: "Late" });
        late.send("play-hello");
        await wait(800);
        assert.strictEqual(late.last("play-game").recipe.gravity, 2);
        assert.strictEqual(late.seen.size, 40);

        // No model on this server: asking says so, to the asker only.
        host.send("play-ai", { text: "more balls" });
        await wait(300);
        assert.strictEqual(host.last("play-ai").say, "This server has no model to ask.");

        host.send("play-stop");
        await wait(300);
        assert.strictEqual(visitor.last("play-state").done, true);
    });

    it("sends things only to people near the zone, and lets anyone change an open room", async () => {
        const base = await world(2770, { origin: { x: 150, z: 150 }, radius: 20, open: true });
        const visitor = await enter(base, guest());
        await wait(200);
        visitor.send("play-start", { recipe: pit });
        await wait(1000);
        // People arrive near the middle of the room, far from this zone.
        assert.strictEqual(visitor.last("play-game").recipe.title, "Ball pit", "they are told about the game");
        assert.strictEqual(visitor.seen.size, 0, "but not sent its things");
    });

    it("is absent unless the room was started with one", async () => {
        const base = await world(2780, null);
        const host = await enter(base, admin());
        assert.strictEqual(host.last("lobby-welcome").play, false);
        host.send("play-start", { recipe: pit });
        await wait(400);
        assert.strictEqual(host.last("play-game"), undefined);
        assert.strictEqual(host.ws.readyState, WebSocket.OPEN);
    });
});
