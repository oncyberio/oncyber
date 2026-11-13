import assert from "assert";
import WebSocket from "ws";
import { mintLobbyIdentity } from "../src/identity/lobby";
import { createWorldServer } from "../src/world/server";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("shared-world voice moderation across workers", function () {
    this.timeout(20000);
    let world: Awaited<ReturnType<typeof createWorldServer>>;
    let previousSecret: string | undefined;
    const sockets: WebSocket[] = [],
        base = "http://127.0.0.1:2720";
    before(async () => {
        previousSecret = process.env.LOBBY_IDENTITY_SECRET;
        process.env.LOBBY_IDENTITY_SECRET = "stage-lobby-identity-secret-at-least-32";
        world = await createWorldServer({ port: 2720, wsBase: 2721, workers: 2, capacity: 4, testMode: true, webtransport: false });
    });
    after(async () => {
        for (const ws of sockets) ws.terminate();
        await world.close();
        if (previousSecret === undefined) delete process.env.LOBBY_IDENTITY_SECRET;
        else process.env.LOBBY_IDENTITY_SECRET = previousSecret;
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
        const send = (type: string, data: any = {}) => ws.send(JSON.stringify({ type, data }));
        const last = (type: string) => [...events].reverse().find((m) => m.type === type)?.data;
        return { ws, events, send, last };
    }
    it("routes requests, approval and removal through one authority", async () => {
        const owner = await join({ lobbyIdentityToken: mintLobbyIdentity("stage-owner", undefined, Date.now(), "owner").token, username: "Host" }),
            guest = await join({ lobbyIdentityToken: mintLobbyIdentity("stage-guest").token, username: "Guest" });
        assert.notEqual(owner.ticket.wsUrl, guest.ticket.wsUrl, "the two land on different workers");
        const host = await connect(owner.ticket),
            visitor = await connect(guest.ticket);
        assert.equal(host.last("lobby-welcome").role, "owner");
        await wait(300);
        assert.equal(host.last("lobby-stage").role, "owner");
        assert.equal(visitor.last("lobby-stage").role, null);
        visitor.send("lobby-voice-request");
        await wait(300);
        assert.equal(visitor.last("lobby-stage").requested, true);
        assert.deepStrictEqual(
            host.last("lobby-stage").requests.map((p: any) => p.username),
            ["Guest"]
        );
        host.send("lobby-admin", { action: "stage-add", sessionId: guest.ticket.sessionId });
        await wait(300);
        assert.equal(host.last("lobby-admin-result").ok, true);
        assert.deepStrictEqual(
            visitor.last("lobby-stage").speakers.map((p: any) => p.sessionId),
            [guest.ticket.sessionId]
        );
        host.send("lobby-admin", { action: "kick", sessionId: guest.ticket.sessionId });
        await wait(300);
        assert.equal(visitor.ws.readyState, WebSocket.CLOSED);
        assert.deepStrictEqual(host.last("lobby-stage").speakers, []);
        const again = await join({ lobbyIdentityToken: mintLobbyIdentity("stage-guest").token });
        assert.equal(again.status, 403, "a removed visitor stays out for a while");
    });
});
