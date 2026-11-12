import assert from "assert";
import WebSocket from "ws";
import fetch from "node-fetch";
import { createWorldServer } from "../src/world/server";
import { WorldGateway } from "../src/world/gateway";
import { createSharedWorld } from "../src/world/shared";
import { encodeMovement } from "../protocol/lobby-v2";
import { encodeInputs } from "../protocol/movement";
import { readLobbyFlash, readFlashArtwork } from "../protocol/lobby-flash";
import { profile } from "../src/rooms/crowd/protocol";

const artwork = { id: "eth:1", title: "Blue study", imageUrl: "https://example.com/art.png", aspect: 1.5, nonce: "one", startedAt: 1 };
async function setup(input = false) {
    const shared = createSharedWorld(5),
        gateways: WorldGateway[] = [],
        events = new Map<number, any[]>();
    const post = (message: any) => {
        if (message.type === "profile") for (const gateway of gateways) gateway.member(message.member);
        if (message.type === "left") for (const gateway of gateways) gateway.remove(message.id);
    };
    for (let owner = 0; owner < 2; owner++) gateways.push(new WorldGateway({ owner, shared, epoch: 1, roomId: "flash", region: "local", post }));
    const join = async (id: number, owner: number) => {
        const g = gateways[owner],
            received: any[] = [];
        events.set(id, received);
        g.reserve({ id, slot: id - 1, owner, token: `t${id}`, expires: Date.now() + 10000, profile: profile(String(id), { username: `Guest ${id}`, flash: artwork }) });
        await g.accept(`t${id}`, {
            sendControl: (type, data) => {
                received.push({ type, data });
                return true;
            },
            sendDatagram: () => true,
            bufferedAmount: () => 0,
            close: () => {},
        });
        for (const gateway of gateways) gateway.member(g.members.get(id)!);
        g.receiveControl(String(id), "lobby-ready", { movement: input ? "input-v1" : "pose-v1" });
        for (let tick = 0; tick < 6; tick++) for (const gateway of gateways) gateway.step();
    };
    await join(1, 0);
    await join(2, 1);
    return { gateways, events, join, stop: () => gateways.forEach((g) => g.stop()) };
}

describe("Flash public artwork validation", () => {
    it("sanitizes artwork and refuses executable, credentialed, oversized and malformed input", () => {
        assert.deepStrictEqual(readLobbyFlash({ ...artwork, sessionId: "forged", private: "secret" }), artwork);
        for (const imageUrl of ["javascript:alert(1)", "data:image/png;base64,x", "//evil.test/a", "https://a:b@example.com/x", "/\\evil", "/a\n"]) assert.equal(readFlashArtwork({ ...artwork, imageUrl }), null);
        for (const bad of [null, [], "bad", { ...artwork, id: "a".repeat(257) }, { ...artwork, title: "" }, { ...artwork, nonce: "bad token" }, { ...artwork, startedAt: Infinity }] as unknown[]) assert.equal(readLobbyFlash(bad), null);
        assert.equal(readFlashArtwork({ ...artwork, aspect: 100 })!.aspect, 20);
        assert.equal(profile("1", { flash: artwork }).flash, undefined, "join/profile input cannot inject server presentation state");
    });
});

describe("world Flash lifecycle", () => {
    it("stamps identity/time, replicates across owners, and includes active Flash for late join", async () => {
        const t = await setup();
        try {
            const [g0, g1] = t.gateways;
            assert(t.events.get(1)!.some((e) => e.type === "lobby-welcome" && e.data.flash === true));
            const start = Date.now();
            g0.receiveControl("1", "lobby-flash", { sessionId: "2", flash: { ...artwork, startedAt: -999, extra: "ignored" } });
            const flash = g0.members.get(1)!.profile.flash!;
            assert(flash.startedAt >= start);
            assert.equal(flash.nonce, "one");
            assert(!("extra" in flash));
            assert.deepStrictEqual(g1.members.get(1)!.profile.flash, flash);
            assert(t.events.get(2)!.some((e) => e.type === "lobby-flash" && e.data.sessionId === "1" && e.data.flash.nonce === "one"));
            g0.receiveControl("1", "lobby-profile", { username: "Changed", flash: { ...artwork, nonce: "forged" } });
            assert.deepStrictEqual(g0.members.get(1)!.profile.flash, flash, "avatar/name edits retain trusted Flash and cannot inject one");
            await t.join(3, 1);
            assert(t.events.get(3)!.some((e) => e.type === "lobby-roster" && e.data.enter.some((p: any) => p.sessionId === "1" && p.flash?.nonce === "one")));
            const older = { ...g0.members.get(1)! };
            g0.receiveControl("1", "lobby-flash", { flash: null });
            g0.member(older);
            g1.member(older);
            assert.equal(g0.members.get(1)!.profile.flash, null, "an older worker echo cannot resurrect a stopped Flash");
            assert.equal(g1.members.get(1)!.profile.flash, null);
            assert(t.events.get(3)!.some((e) => e.type === "lobby-flash" && e.data.sessionId === "1" && e.data.flash === null));
        } finally {
            t.stop();
        }
    });
    it("limits starts while allowing immediate clears and suppressing no-op floods", async () => {
        const t = await setup();
        try {
            const g = t.gateways[0];
            for (let i = 0; i < 10; i++) g.receiveControl("1", "lobby-flash", { flash: { ...artwork, nonce: `n${i}` } });
            assert.equal(g.members.get(1)!.profile.flash!.nonce, "n2");
            const c = g.sessions.get("1")!;
            while (c.rates.request.take(Date.now())) {} // Stop bypasses both request and start limits.
            g.receiveControl("1", "lobby-flash", { flash: null });
            assert.equal(g.members.get(1)!.profile.flash, null);
            const length = t.events.get(2)!.length;
            for (let i = 0; i < 50; i++) g.receiveControl("1", "lobby-flash", { flash: null });
            assert.equal(t.events.get(2)!.length, length);
            g.receiveControl("1", "lobby-flash", { flash: { ...artwork, imageUrl: "javascript:alert(1)" } });
            assert.equal(g.members.get(1)!.profile.flash, null);
        } finally {
            t.stop();
        }
    });
    it("clears on actual pose movement, travel placement, destination presence and disconnect", async () => {
        const t = await setup();
        try {
            const g = t.gateways[0],
                c = g.sessions.get("1")!;
            g.receiveControl("1", "lobby-flash", { flash: artwork });
            g.receiveDatagram("1", encodeMovement({ sequence: 1, x: c.pose.x, y: 0, z: c.pose.z, yaw: 1, animation: -1, floor: true }));
            g.step();
            assert(g.members.get(1)!.profile.flash, "turning in place retains the frame");
            g.receiveDatagram("1", encodeMovement({ sequence: 2, x: c.pose.x + 0.1, y: 0, z: c.pose.z, yaw: 1, animation: -1, floor: true }));
            g.step();
            assert.equal(g.members.get(1)!.profile.flash, null);
            g.receiveControl("1", "lobby-flash", { flash: { ...artwork, nonce: "travel" } });
            g.placeGroup("1", "trip", { x: 0, y: 0, z: 0, rotation: 0 }, [], true);
            assert.equal(g.members.get(1)!.profile.flash, null);
            g.receiveControl("1", "lobby-flash", { flash: { ...artwork, nonce: "held" } });
            assert.equal(g.members.get(1)!.profile.flash, null);
            g.placeGroup("1", "trip", { x: 0, y: 0, z: 0, rotation: 0 }, [], false);
            g.receiveControl("1", "lobby-flash", { flash: { ...artwork, nonce: "space" } });
            assert(g.members.get(1)!.profile.flash);
            g.groupPresence("1", true);
            assert.equal(g.members.get(1)!.profile.flash, null);
            g.receiveControl("1", "lobby-flash", { flash: { ...artwork, nonce: "hidden" } });
            assert.equal(g.members.get(1)!.profile.flash, null);
            g.disconnect("1");
            assert(!t.gateways[1].members.has(1));
        } finally {
            t.stop();
        }
    });
    it("clears a Flash when authoritative input simulation begins walking", async () => {
        const t = await setup(true);
        try {
            const g = t.gateways[0];
            g.receiveControl("1", "lobby-flash", { flash: artwork });
            g.receiveDatagram("1", encodeInputs(Array.from({ length: 4 }, (_, i) => ({ sequence: i + 1, forward: 1, strafe: 0, yaw: 0, running: false, jump: false, animation: -1 }))));
            g.step();
            assert.equal(g.members.get(1)!.profile.flash, null);
            assert(t.events.get(2)!.some((e) => e.type === "lobby-flash" && e.data.flash === null));
        } finally {
            t.stop();
        }
    });
    it("does not push controls to participants outside the actor's visible roster", async () => {
        const t = await setup();
        try {
            const observer = t.gateways[1].sessions.get("2")!;
            observer.roster.delete(1);
            const before = t.events.get(2)!.filter((e) => e.type === "lobby-flash").length;
            t.gateways[0].receiveControl("1", "lobby-flash", { flash: artwork });
            assert.equal(t.events.get(2)!.filter((e) => e.type === "lobby-flash").length, before);
        } finally {
            t.stop();
        }
    });
});

describe("Flash across real gateway worker sockets", function () {
    this.timeout(20000);
    it("replicates start, late-join hydration and stop across workers", async () => {
        const world = await createWorldServer({ port: 2794, wsBase: 2795, workers: 2, capacity: 6, testMode: true, singlePort: true, webtransport: false });
        const clients: { id: string; ws: WebSocket; events: any[]; owner: string }[] = [];
        const until = async (predicate: () => boolean) => {
            const end = Date.now() + 5000;
            while (!predicate() && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, 15));
            assert(predicate(), "Flash socket event arrived before timeout");
        };
        const join = async () => {
            const response = await fetch("http://127.0.0.1:2794/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lobbyProtocol: 2, username: "Flash test" }) });
            const ticket: any = await response.json(),
                events: any[] = [],
                ws = new WebSocket(ticket.wsUrl);
            const client = { id: ticket.sessionId, ws, events, owner: ticket.wsUrl };
            clients.push(client);
            ws.on("open", () => ws.send(JSON.stringify({ type: "session", data: { token: ticket.token } })));
            ws.on("message", (raw: any, binary?: boolean) => {
                if (typeof binary === "boolean" ? binary : typeof raw !== "string") return;
                const message = JSON.parse(raw.toString());
                events.push(message);
                if (message.type === "session-accepted") ws.send(JSON.stringify({ type: "lobby-ready", data: { movement: "input-v1" } }));
            });
            await until(() => events.some((e) => e.type === "lobby-welcome"));
            return client;
        };
        try {
            const a = await join(),
                b = await join();
            assert.notEqual(a.owner, b.owner);
            await until(() => b.events.some((e) => e.type === "lobby-roster" && e.data.enter.some((p: any) => p.sessionId === a.id)));
            a.ws.send(JSON.stringify({ type: "lobby-flash", data: { sessionId: b.id, flash: artwork } }));
            await until(() => b.events.some((e) => e.type === "lobby-flash" && e.data.sessionId === a.id && e.data.flash?.nonce === "one"));
            const c = await join();
            await until(() => c.events.some((e) => e.type === "lobby-roster" && e.data.enter.some((p: any) => p.sessionId === a.id && p.flash?.nonce === "one")));
            a.ws.send(JSON.stringify({ type: "lobby-flash", data: { flash: null } }));
            await until(() => [b, c].every((client) => client.events.some((e) => e.type === "lobby-flash" && e.data.sessionId === a.id && e.data.flash === null)));
            a.ws.send(JSON.stringify({ type: "lobby-flash", data: { flash: { ...artwork, nonce: "leave" } } }));
            await until(() => b.events.some((e) => e.type === "lobby-flash" && e.data.flash?.nonce === "leave"));
            a.ws.close();
            await until(() => b.events.some((e) => e.type === "lobby-roster" && e.data.leave.includes(a.id)));
        } finally {
            for (const client of clients) client.ws.terminate();
            await world.close();
        }
    });
});
