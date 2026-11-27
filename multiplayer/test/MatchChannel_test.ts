import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import { Server } from "colyseus";

import { CyberRoom } from "../src/rooms/cyber";
import { setWorldAccessLookup } from "../src/identity/worldAccess";
import { MATCH_BURST, MATCH_MAX_BYTES, MATCH_RATE, isPartyRoom } from "../src/rooms/cyber/match/limits";
import { PacketBudget, PartyRoster, seatId } from "../src/rooms/cyber/match/roster";

process.env.MAX_PLAYERS = process.env.MAX_PLAYERS || "200";
setWorldAccessLookup(async () => ({ exists: false }));

const PARTY = "oncyber-ace-party-dev-party-2-preview";
const profile = (name: string) => ({ name, pfp: "", avatarUrl: "" });
const key = (name: string) => `${name}-key-0123456789abcdef`;
/** The member id a page with this seat key gets. */
const id = (name: string) => seatId(key(name));

function joinOpts(userId: string, label = PARTY, matchKey = key(userId)) {
    return {
        userId,
        username: encodeURIComponent(`Player ${userId}`),
        avatar: "a",
        currentSpace: label,
        position: { x: 0, y: 0, z: 0 },
        rotationY: 0,
        VRM: "",
        token: "",
        label,
        matchKey,
    };
}

function collect(room: any, type: string): any[] {
    const out: any[] = [];
    room.onMessage(type, (m: any) => out.push(m));
    return out;
}

const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));

describe("party roster rules", () => {
    it("names party rooms and nothing else", () => {
        assert.ok(isPartyRoom(PARTY));
        assert.ok(isPartyRoom("oncyber-garden-party-AbCdEf0123456789_-xy"));
        for (const label of ["oncyber-ace", "space1", "oncyber-ace-party-short", "x-oncyber-ace-party-0123456789abcdef", undefined, 7]) assert.ok(!isPartyRoom(label), String(label));
    });

    it("keeps arrival order, makes the first arrival host and seats extras as spectators", () => {
        const roster = new PartyRoster(2);
        roster.join("s1", key("a"), profile("A"));
        roster.join("s2", key("b"), profile("B"));
        roster.join("s3", key("c"), profile("C"));
        const view = roster.view();
        assert.strictEqual(view.host, id("a"));
        assert.deepStrictEqual(
            view.members.map((m) => [m.id, m.session, m.seat, m.order]),
            [
                [id("a"), "s1", "player", 1],
                [id("b"), "s2", "player", 2],
                [id("c"), "s3", "spectator", 3],
            ]
        );
        assert.ok(!JSON.stringify(view).includes("-key-"));
        assert.ok(!("key" in view.members[0]), "the seat key never leaves the server");
    });

    it("holds a dropped member's seat, moves the host, and gives the seat back on reconnect", () => {
        const roster = new PartyRoster(2, 20_000);
        roster.join("s1", key("a"), profile("A"));
        roster.join("s2", key("b"), profile("B"));
        roster.join("s3", key("c"), profile("C"));
        assert.ok(roster.leave("s1", false, 1000));
        assert.strictEqual(roster.byId(id("a")).state, "away");
        assert.strictEqual(roster.host, id("b"), "host moves to the next player");
        assert.strictEqual(roster.byId(id("c")).seat, "spectator", "the seat is held, not handed on");
        assert.ok(!roster.sweep(20_999));

        const back = roster.join("s9", key("a"), profile("A"));
        assert.strictEqual(back.member.id, id("a"), "same member id after a reconnect");
        assert.strictEqual(back.member.session, "s9");
        assert.strictEqual(back.member.order, 1, "and the same place in the order");
        assert.strictEqual(back.replaced, "");
        assert.strictEqual(roster.host, id("b"), "the old host does not take the role back");
    });

    it("releases the seat after the grace period and promotes the first spectator", () => {
        const roster = new PartyRoster(2, 20_000);
        roster.join("s1", key("a"), profile("A"));
        roster.join("s2", key("b"), profile("B"));
        roster.join("s3", key("c"), profile("C"));
        roster.leave("s2", false, 1000);
        assert.ok(roster.sweep(21_001));
        assert.deepStrictEqual(
            roster.view().members.map((m) => [m.id, m.seat]),
            [
                [id("a"), "player"],
                [id("c"), "player"],
            ]
        );
        // Too late for the seat: the same page is the same member, at the back.
        const late = roster.join("s10", key("b"), profile("B")).member;
        assert.deepStrictEqual([late.id, late.order, late.seat], [id("b"), 4, "spectator"]);
        // A room made again (a restart) gives the same page the same id.
        assert.strictEqual(new PartyRoster().join("s1", key("b"), profile("B")).member.id, id("b"));
    });

    it("frees the seat at once when a member leaves on purpose", () => {
        const roster = new PartyRoster();
        roster.join("s1", key("a"), profile("A"));
        roster.join("s2", key("b"), profile("B"));
        roster.leave("s1", true, 0);
        assert.deepStrictEqual(
            roster.view().members.map((m) => m.id),
            [id("b")]
        );
        assert.strictEqual(roster.host, id("b"));
    });

    it("a second connection with the same key takes over and names the one it replaced", () => {
        const roster = new PartyRoster();
        roster.join("s1", key("a"), profile("A"));
        const again = roster.join("s2", key("a"), profile("A"));
        assert.strictEqual(again.replaced, "s1");
        assert.strictEqual(roster.members.length, 1);
        // The replaced session closing later changes nothing.
        assert.ok(!roster.leave("s1", false, 0));
        // Without a usable key every join is a new member, named by its session.
        roster.join("s3", "short", profile("X"));
        roster.join("s4", "short", profile("X"));
        assert.deepStrictEqual(
            roster.members.map((m) => m.id),
            [id("a"), "s3", "s4"]
        );
    });

    it("stops adding members past the roster limit", () => {
        const roster = new PartyRoster(8, 20_000, 3);
        for (let i = 0; i < 3; i++) assert.ok(roster.join(`s${i}`, "", profile("P")));
        assert.strictEqual(roster.join("s3", "", profile("P")), null);
    });

    it("the packet budget averages the rate and allows one burst", () => {
        const budget = new PacketBudget(MATCH_RATE, MATCH_BURST, 0);
        let sent = 0;
        // A client flooding 200 packets a second for two seconds.
        for (let ms = 0; ms < 2000; ms += 5) if (budget.take(ms)) sent++;
        assert.ok(sent <= 2 * MATCH_RATE + MATCH_BURST, `passed ${sent}`);
        assert.ok(sent >= 2 * MATCH_RATE - 2, `passed ${sent}`);
        // A steady 30 a second for two seconds loses nothing.
        const steady = new PacketBudget(MATCH_RATE, MATCH_BURST, 0);
        let dropped = 0;
        for (let i = 0; i < 60; i++) if (!steady.take((i * 1000) / 30)) dropped++;
        assert.strictEqual(dropped, 0);
    });
});

describe("party room: roster and match channel", () => {
    let colyseus: ColyseusTestServer;

    before(async () => {
        const gameServer = new Server();
        gameServer.define("cyber", CyberRoom);
        await gameServer.listen(2573, "127.0.0.1");
        colyseus = new ColyseusTestServer(gameServer);
    });

    after(async () => colyseus.shutdown());

    beforeEach(async () => await colyseus.cleanup());

    async function party(...names: string[]) {
        const room = await colyseus.createRoom("cyber", { label: PARTY });
        const clients = [];
        const rosters = [];
        const packets = [];
        for (const name of names) {
            const client = await colyseus.connectTo(room, joinOpts(name));
            clients.push(client);
            rosters.push(collect(client, "game-roster"));
            packets.push(collect(client, "game-match"));
            collect(client, "rtc-join");
            collect(client, "rtc-leave");
            await tick();
        }
        return { room, clients, rosters, packets };
    }

    it("tells each member the roster, their own id and the host; a late arrival is announced to all", async () => {
        const { clients, rosters } = await party("a", "b");
        const [a, b] = clients;
        const forA = rosters[0].at(-1);
        const forB = rosters[1].at(-1);
        assert.strictEqual(forA.self, id("a"));
        assert.strictEqual(forB.self, id("b"));
        assert.strictEqual(forA.host, id("a"));
        assert.deepStrictEqual(
            forA.members.map((m: any) => [m.id, m.session]),
            [
                [id("a"), a.sessionId],
                [id("b"), b.sessionId],
            ]
        );
        assert.strictEqual(forA.members[1].name, "Player b");
        assert.ok(forA.members.every((m: any) => m.seat === "player" && m.state === "here"));
        assert.ok(!JSON.stringify(forA).includes("-key-"), "seat keys stay on the server");
    });

    it("a dropped member shows as away, the host moves, and reconnecting returns the same member", async () => {
        const { room, clients, rosters } = await party("a", "b");
        const [a, b] = clients;
        const first = id("a");
        // The socket dies without a goodbye.
        (a as any).connection.close(4005);
        await tick(150);
        const afterDrop = rosters[1].at(-1);
        assert.strictEqual(afterDrop.members[0].state, "away");
        assert.strictEqual(afterDrop.members[0].session, "");
        assert.strictEqual(afterDrop.host, id("b"));

        const again = await colyseus.connectTo(room, joinOpts("a"));
        const rosterAgain = collect(again, "game-roster");
        collect(again, "game-match");
        await tick(150);
        const back = rosters[1].at(-1);
        assert.strictEqual(back.members[0].id, first);
        assert.strictEqual(back.members[0].session, again.sessionId);
        assert.strictEqual(back.members[0].state, "here");
        assert.strictEqual(back.host, id("b"));
        assert.strictEqual(rosterAgain.at(-1).self, first);
    });

    it("leaving on purpose removes the member at once", async () => {
        const { clients, rosters } = await party("a", "b");
        await clients[0].leave(true);
        await tick(150);
        assert.deepStrictEqual(
            rosters[1].at(-1).members.map((m: any) => m.id),
            [id("b")]
        );
    });

    it("relays match packets to the other members with the sender's member id, or to one member", async () => {
        const { clients, packets } = await party("a", "b", "c");
        const [a, b] = clients;
        a.send("game-match", { data: [1, 0, { x: 1.5 }] });
        a.send("game-match", { data: [2, 1, "hit"], to: id("c") });
        await tick();
        assert.deepStrictEqual(packets[1], [[id("a"), [1, 0, { x: 1.5 }]]]);
        assert.deepStrictEqual(packets[2], [
            [id("a"), [1, 0, { x: 1.5 }]],
            [id("a"), [2, 1, "hit"]],
        ]);
        assert.strictEqual(packets[0].length, 0, "no echo to the sender");
        b.send("game-match", { data: "not a packet" });
        await tick();
        assert.strictEqual(packets[0].length, 0);
    });

    it("carries thirty packets a second and drops a flood past the limit", async () => {
        const { clients, packets } = await party("a", "b");
        const [a, b] = clients;
        const limits = collect(a, "game-match-limit");
        // One second at the pace the clients keep.
        for (let i = 0; i < 30; i++) {
            a.send("game-match", { data: [i + 1, 0, i] });
            await tick(1000 / 30);
        }
        await tick();
        assert.strictEqual(packets[1].length, 30);
        assert.strictEqual(limits.length, 0);

        // Then four hundred at once from the other member.
        const bLimits = collect(b, "game-match-limit");
        for (let i = 0; i < 400; i++) b.send("game-match", { data: [i + 1, 0, i] });
        await tick(200);
        assert.ok(packets[0].length <= MATCH_BURST + MATCH_RATE / 2, `relayed ${packets[0].length}`);
        assert.ok(packets[0].length >= MATCH_BURST - 1, `relayed ${packets[0].length}`);
        assert.ok(bLimits.length >= 1 && bLimits[0].dropped >= 1);
    });

    it("drops a packet over the size limit", async () => {
        const { clients, packets } = await party("a", "b");
        const limits = collect(clients[0], "game-match-limit");
        clients[0].send("game-match", { data: [1, 0, "x".repeat(MATCH_MAX_BYTES)] });
        clients[0].send("game-match", { data: [2, 0, "x".repeat(MATCH_MAX_BYTES - 20)] });
        await tick();
        assert.strictEqual(packets[1].length, 1);
        assert.strictEqual(packets[1][0][1][0], 2);
        assert.strictEqual(limits.length, 1);
    });

    it("spectators receive but may not send", async () => {
        const names = Array.from({ length: 9 }, (_, i) => `p${i}`);
        const { clients, rosters, packets } = await party(...names);
        const last = rosters[8].at(-1);
        assert.strictEqual(last.members[8].seat, "spectator");
        assert.strictEqual(last.members[7].seat, "player");
        clients[0].send("game-match", { data: [1, 0, "from a player"] });
        clients[8].send("game-match", { data: [1, 0, "from a spectator"] });
        await tick();
        assert.deepStrictEqual(
            packets[8].map((p: any) => p[1][2]),
            ["from a player"]
        );
        assert.deepStrictEqual(
            packets[1].map((p: any) => p[1][2]),
            ["from a player"]
        );
    });

    it("ordinary rooms have no roster and ignore match packets", async () => {
        const room = await colyseus.createRoom("cyber", { label: "space1" });
        const a = await colyseus.connectTo(room, joinOpts("a", "space1"));
        const b = await colyseus.connectTo(room, joinOpts("b", "space1"));
        const rosters = collect(a, "game-roster");
        const packets = collect(b, "game-match");
        collect(a, "rtc-join");
        a.send("game-match", { data: [1, 0, 1] });
        await tick();
        assert.strictEqual(rosters.length, 0);
        assert.strictEqual(packets.length, 0);
    });
});
