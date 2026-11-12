import assert from "assert";
import { createHmac } from "crypto";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { Server } from "colyseus";

import { CyberRoom } from "../src/rooms/cyber";
import { setWorldAccessLookup } from "../src/identity/worldAccess";
import {
    MOD_ONLY_RTM_COMMANDS,
    MOD_ONLY_VOICE_COMMANDS,
    VISITOR_VOICE_COMMANDS,
    isModOnlyCommand,
    rtmCommandName,
} from "../src/rooms/cyber/events/ChatEventsHandler";

// Rooms are uncapped without this (Number(undefined) -> NaN).
process.env.MAX_PLAYERS = process.env.MAX_PLAYERS || "200";

// These worlds have no password; admission asks no API.
setWorldAccessLookup(async () => ({ exists: false }));

// A hardcoded admin address short-circuits checkIsMod (no network in tests),
// once the join carries a session token that proves it (see moderatorOpts).
// With the empty token below nobody is a moderator.
const ADMIN = "0xf02cb30a8963e6fe8cc7650a6169e603357650ad";

function joinOpts(userId: string) {
    return {
        userId,
        username: "u",
        avatar: "a",
        currentSpace: "space1",
        position: { x: 0, y: 0, z: 0 },
        rotationY: 0,
        VRM: "",
        token: "",
        label: "space1",
    };
}

// Collects messages of a type on a client-side room.
function collect(room: any, type: string): any[] {
    const out: any[] = [];
    room.onMessage(type, (m: any) => out.push(m));
    return out;
}

const tick = () => new Promise((r) => setTimeout(r, 60));

describe("rtc + chat events", () => {
    let colyseus: ColyseusTestServer;

    before(async () => {
        const gameServer = new Server();
        gameServer.define("cyber", CyberRoom);
        await gameServer.listen(2571, "127.0.0.1");
        colyseus = new ColyseusTestServer(gameServer);
    });

    after(async () => colyseus.shutdown());

    beforeEach(async () => await colyseus.cleanup());

    it("relays rtc-signal to the target with a from field, and drops unknown targets", async () => {
        const room = await colyseus.createRoom("cyber", {});
        const a = await colyseus.connectTo(room, joinOpts(ADMIN));
        const b = await colyseus.connectTo(room, joinOpts(ADMIN + "b"));

        const bSignals = collect(b, "rtc-signal");
        const aSignals = collect(a, "rtc-signal");

        a.send("rtc-signal", { to: b.sessionId, payload: { kind: "offer" } });
        await tick();

        assert.strictEqual(bSignals.length, 1);
        assert.strictEqual(bSignals[0].from, a.sessionId);
        assert.deepStrictEqual(bSignals[0].payload, { kind: "offer" });

        a.send("rtc-signal", { to: "nope", payload: { kind: "offer" } });
        await tick();
        assert.strictEqual(aSignals.length, 0);
        assert.strictEqual(bSignals.length, 1);
    });

    it("broadcasts chat-channel to ALL including the sender (command echo)", async () => {
        const room = await colyseus.createRoom("cyber", {});
        const a = await colyseus.connectTo(room, joinOpts(ADMIN));
        const b = await colyseus.connectTo(room, joinOpts(ADMIN + "b"));

        const aMsgs = collect(a, "chat-channel");
        const bMsgs = collect(b, "chat-channel");

        a.send("chat-channel", { text: "hi" });
        await tick();

        assert.strictEqual(aMsgs.length, 1, "sender receives its own message");
        assert.strictEqual(bMsgs.length, 1);
        assert.strictEqual(aMsgs[0].from, a.sessionId);
        assert.strictEqual(typeof aMsgs[0].server_ts, "number");
        assert.deepStrictEqual(aMsgs[0].data, { text: "hi" });
    });

    it("relays chat-peer to the target only", async () => {
        const room = await colyseus.createRoom("cyber", {});
        const a = await colyseus.connectTo(room, joinOpts(ADMIN));
        const b = await colyseus.connectTo(room, joinOpts(ADMIN + "b"));

        const c = await colyseus.connectTo(room, joinOpts(ADMIN + "c"));
        const aPeer = collect(a, "chat-peer");
        const bPeer = collect(b, "chat-peer");
        const cPeer = collect(c, "chat-peer");

        a.send("chat-peer", { to: b.sessionId, data: { x: 1 } });
        await tick();

        assert.strictEqual(bPeer.length, 1);
        assert.strictEqual(bPeer[0].from, a.sessionId);
        assert.strictEqual(aPeer.length, 0);
        assert.strictEqual(cPeer.length, 0);
        assert.strictEqual(bPeer[0].to, b.sessionId);
        assert.strictEqual(typeof bPeer[0].server_ts, "number");
    });

    it("round-trips an allowed user attribute and rejects a non-allowlisted key", async () => {
        const room = await colyseus.createRoom("cyber", {});
        const a = await colyseus.connectTo(room, joinOpts(ADMIN));

        const replies = collect(a, "attr-reply");

        a.send("attr-set-user", { key: "walletId", value: JSON.stringify("0xabc") });
        a.send("attr-set-user", { key: "evil", value: JSON.stringify("x") });
        await tick();

        a.send("attr-get-user", {
            requestId: "r1",
            sessionId: a.sessionId,
            keys: ["walletId", "evil"],
        });
        await tick();

        assert.strictEqual(replies.length, 1);
        assert.strictEqual(replies[0].requestId, "r1");
        assert.strictEqual(replies[0].values.walletId, JSON.stringify("0xabc"));
        assert.ok(!("evil" in replies[0].values), "rejected key absent");
    });

    it("deletes a user attribute on null and returns empty for a departed session", async () => {
        const room = await colyseus.createRoom("cyber", {});
        const a = await colyseus.connectTo(room, joinOpts(ADMIN));
        const replies = collect(a, "attr-reply");

        a.send("attr-set-user", { key: "voiceState", value: JSON.stringify({ isMuted: true }) });
        await tick();
        a.send("attr-set-user", { key: "voiceState", value: null });
        await tick();

        a.send("attr-get-user", { requestId: "r2", sessionId: a.sessionId, keys: ["voiceState"] });
        await tick();

        assert.strictEqual(replies.length, 1);
        assert.deepStrictEqual(replies[0].values, {});

        // unknown session -> empty values, no throw
        a.send("attr-get-user", { requestId: "r3", sessionId: "ghost", keys: ["voiceState"] });
        await tick();
        assert.strictEqual(replies.length, 2);
        assert.deepStrictEqual(replies[1].values, {});
    });

    it("round-trips a channel attribute", async () => {
        const room = await colyseus.createRoom("cyber", {});
        const a = await colyseus.connectTo(room, joinOpts(ADMIN));
        const replies = collect(a, "attr-reply");

        a.send("attr-set-channel", {
            key: "voiceRequests",
            value: JSON.stringify([{ sessionId: "s1" }]),
        });
        await tick();
        a.send("attr-get-channel", { requestId: "r4", keys: ["voiceRequests"] });
        await tick();

        assert.strictEqual(replies.length, 1);
        assert.deepStrictEqual(JSON.parse(replies[0].values.voiceRequests), [
            { sessionId: "s1" },
        ]);
    });

    it("clears a session's user attributes on leave", async () => {
        const room = await colyseus.createRoom("cyber", {});
        const a = await colyseus.connectTo(room, joinOpts(ADMIN));
        const sid = a.sessionId;

        a.send("attr-set-user", { key: "walletId", value: JSON.stringify("0xabc") });
        await tick();
        assert.ok((room as any).userAttributes.get(sid)?.get("walletId"));

        await a.leave();
        await tick();

        assert.ok(!(room as any).userAttributes.has(sid), "attrs cleared on leave");
    });
});

// ---- moderator-only RTM commands ----

// A session token as the site issues it (HS256 over SECRET_JWT_KEY).
function sessionToken(user: string) {
    const url = (value: string) =>
        value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const b64 = (value: any) =>
        url(Buffer.from(JSON.stringify(value)).toString("base64"));
    const head = b64({ alg: "HS256", typ: "JWT" });
    const body = b64({ user, exp: Math.floor(Date.now() / 1000) + 600 });
    const sig = createHmac("sha256", process.env.SECRET_JWT_KEY)
        .update(`${head}.${body}`)
        .digest("base64");
    return `${head}.${body}.${url(sig)}`;
}

// A join whose token proves a hardcoded admin wallet: a room moderator.
const moderatorOpts = () => ({ ...joinOpts(ADMIN), token: sessionToken(ADMIN) });

// What the frontend's sendCommand() puts on the wire: the object as-is on
// chat-channel, the same object JSON-stringified on chat-peer.
const command = (type: any, data: any = {}) => ({
    type: "RTM_COMMAND",
    command: { type, data },
});
const peerCommand = (type: any, data: any = {}) =>
    JSON.stringify(command(type, data));

describe("moderator-only RTM commands", () => {
    let colyseus: ColyseusTestServer;
    const previousSecret = process.env.SECRET_JWT_KEY;

    before(async () => {
        process.env.SECRET_JWT_KEY = "chat-events-test-key-" + "x".repeat(20);
        const gameServer = new Server();
        gameServer.define("cyber", CyberRoom);
        await gameServer.listen(2572, "127.0.0.1");
        colyseus = new ColyseusTestServer(gameServer);
    });

    after(async () => {
        if (previousSecret === undefined) delete process.env.SECRET_JWT_KEY;
        else process.env.SECRET_JWT_KEY = previousSecret;
        await colyseus.shutdown();
    });

    beforeEach(async () => await colyseus.cleanup());

    // The moderator check needs to know which space the room is for.
    const SPACE = { label: "space1", currentSpace: "space1" };

    // Long enough for a burst of messages to be relayed.
    const settle = () => new Promise((r) => setTimeout(r, 200));

    // One moderator and two visitors in a room, with what each receives.
    async function party() {
        const room = await colyseus.createRoom("cyber", SPACE);
        const mod = await colyseus.connectTo(room, moderatorOpts());
        const visitor = await colyseus.connectTo(room, joinOpts("0xvisitor"));
        const other = await colyseus.connectTo(room, joinOpts("0xother"));
        const players = (room as any).state.players;

        assert.strictEqual(players.get(mod.sessionId).isAdmin, true);
        assert.strictEqual(players.get(visitor.sessionId).isAdmin, false);
        assert.strictEqual(players.get(other.sessionId).isAdmin, false);

        return {
            mod,
            visitor,
            other,
            channel: {
                mod: collect(mod, "chat-channel"),
                visitor: collect(visitor, "chat-channel"),
                other: collect(other, "chat-channel"),
            },
            peer: {
                mod: collect(mod, "chat-peer"),
                visitor: collect(visitor, "chat-peer"),
                other: collect(other, "chat-peer"),
            },
        };
    }

    it("restricts the summon, kick and moderator voice commands, and nothing else", () => {
        assert.deepStrictEqual(Array.from(MOD_ONLY_RTM_COMMANDS).sort(), [
            "ADMIN_ANSWER_VOICE_PERMISSION",
            "ADMIN_SET_USER_VOICE_STATE",
            "KICK_COMMAND",
            "SET_VOICE_RANGE",
            "SUMMON_COMMAND",
        ]);
        VISITOR_VOICE_COMMANDS.forEach((name) =>
            assert.ok(!MOD_ONLY_RTM_COMMANDS.has(name), name)
        );
    });

    it("mirrors the frontend's command names", function () {
        const context = join(
            __dirname,
            "../../frontend/components/_3DExhibit-v2/context"
        );
        const voice = join(context, "hooks/useVoice.tsx");
        const provider = join(context, "MultiplayerProvider.tsx");

        // The multiplayer package can be checked out without the frontend.
        if (!existsSync(voice) || !existsSync(provider)) return this.skip();

        const body = /export enum VOICE_REQUESTS \{([\s\S]*?)\}/.exec(
            readFileSync(voice, "utf8")
        );
        assert.ok(body, "VOICE_REQUESTS enum not found");
        const names: string[] = [];
        const member = /=\s*"([^"]+)"/g;
        for (let m = member.exec(body[1]); m; m = member.exec(body[1]))
            names.push(m[1]);

        // Every voice command is sorted into exactly one of the two lists.
        assert.deepStrictEqual(
            names.sort(),
            [...MOD_ONLY_VOICE_COMMANDS, ...VISITOR_VOICE_COMMANDS].sort()
        );

        const source = readFileSync(provider, "utf8");
        assert.ok(source.includes('const RTM_COMMAND = "RTM_COMMAND"'));
        ["SUMMON_COMMAND", "KICK_COMMAND"].forEach((name) => {
            assert.ok(source.includes(`export const ${name} = "${name}"`), name);
            assert.ok(MOD_ONLY_RTM_COMMANDS.has(name), name);
        });
    });

    it("reads the command name the receiving client would dispatch", () => {
        const wire = command("ADMIN_SET_USER_VOICE_STATE");

        // As sent on chat-channel, as sent on chat-peer, and encoded again.
        assert.strictEqual(rtmCommandName(wire), "ADMIN_SET_USER_VOICE_STATE");
        assert.strictEqual(
            rtmCommandName(JSON.stringify(wire)),
            "ADMIN_SET_USER_VOICE_STATE"
        );
        assert.strictEqual(
            rtmCommandName(JSON.stringify(JSON.stringify(wire))),
            "ADMIN_SET_USER_VOICE_STATE"
        );
        // An emitter dispatches ["X"] to the listeners of "X".
        assert.strictEqual(isModOnlyCommand(command(["KICK_COMMAND"])), true);

        // Not commands: ordinary messages, other shapes, unparsable strings.
        [
            { type: "MESSAGE", text: "SUMMON_COMMAND" },
            { text: "hi" },
            { type: "RTM_COMMAND" },
            { command: { type: "SUMMON_COMMAND" } },
            "SUMMON_COMMAND",
            "{not json",
            null,
            undefined,
            42,
        ].forEach((data) => {
            assert.strictEqual(rtmCommandName(data), undefined);
            assert.strictEqual(isModOnlyCommand(data), false);
        });

        // A type with no string form names no command, and does not throw.
        assert.strictEqual(
            isModOnlyCommand(command({ toString: "KICK_COMMAND" })),
            false
        );
    });

    it("drops a visitor's restricted commands on chat-channel", async () => {
        const { visitor, channel } = await party();

        // 5 commands x 2 encodings stays under the chat rate limit.
        MOD_ONLY_RTM_COMMANDS.forEach((name) => {
            visitor.send("chat-channel", command(name, { sessionId: "x" }));
            visitor.send("chat-channel", peerCommand(name, { sessionId: "x" }));
        });
        visitor.send("chat-channel", command(["SUMMON_COMMAND"]));
        await settle();

        assert.deepStrictEqual(channel.mod, []);
        assert.deepStrictEqual(channel.other, []);
        assert.deepStrictEqual(channel.visitor, [], "no echo to the sender");
    });

    it("drops a visitor's restricted commands on chat-peer", async () => {
        const { visitor, other, peer } = await party();

        MOD_ONLY_RTM_COMMANDS.forEach((name) => {
            const data = { sessionId: other.sessionId, action: "MUTE_MIC" };
            // As sendCommand() wraps it, as a plain object, and encoded twice.
            [
                peerCommand(name, data),
                command(name, data),
                JSON.stringify(peerCommand(name, data)),
            ].forEach((wire) =>
                visitor.send("chat-peer", { to: other.sessionId, data: wire })
            );
        });
        visitor.send("chat-peer", {
            to: other.sessionId,
            data: peerCommand(["ADMIN_SET_USER_VOICE_STATE"]),
        });
        await settle();

        assert.deepStrictEqual(peer.other, []);
        assert.deepStrictEqual(peer.mod, []);
        assert.deepStrictEqual(peer.visitor, []);
    });

    it("relays a moderator's restricted commands on both channels", async () => {
        const { mod, visitor, channel, peer } = await party();
        const names = Array.from(MOD_ONLY_RTM_COMMANDS);

        names.forEach((name) => {
            mod.send("chat-channel", command(name, { sessionId: "x" }));
            mod.send("chat-peer", {
                to: visitor.sessionId,
                data: peerCommand(name, { sessionId: visitor.sessionId }),
            });
        });
        await settle();

        // Broadcast to everyone, the moderator's own echo included.
        [channel.mod, channel.visitor, channel.other].forEach((received) => {
            assert.deepStrictEqual(
                received.map((m) => m.data.command.type),
                names
            );
            received.forEach((m) => assert.strictEqual(m.from, mod.sessionId));
        });

        // Sent to the one peer, payload untouched.
        assert.deepStrictEqual(
            peer.visitor.map((m) => m.data),
            names.map((name) =>
                peerCommand(name, { sessionId: visitor.sessionId })
            )
        );
        peer.visitor.forEach((m) => assert.strictEqual(m.from, mod.sessionId));
        assert.deepStrictEqual(peer.other, []);
        assert.deepStrictEqual(peer.mod, []);
    });

    it("still relays a visitor's own voice commands and ordinary messages", async () => {
        const { mod, visitor, channel, peer } = await party();
        // SET_MEDIA_TIME is a command any visitor's client sends today.
        const names = [...VISITOR_VOICE_COMMANDS, "SET_MEDIA_TIME"];
        const message = { type: "MESSAGE", text: "hello" };

        names.forEach((name) => {
            visitor.send("chat-channel", command(name, { sessionId: "x" }));
            visitor.send("chat-peer", {
                to: mod.sessionId,
                data: peerCommand(name, { sessionId: "x" }),
            });
        });
        visitor.send("chat-channel", message);
        visitor.send("chat-peer", { to: mod.sessionId, data: message });
        await settle();

        [channel.mod, channel.visitor, channel.other].forEach((received) => {
            assert.deepStrictEqual(
                received.map((m) => m.data),
                [
                    ...names.map((name) => command(name, { sessionId: "x" })),
                    message,
                ]
            );
        });
        assert.deepStrictEqual(
            peer.mod.map((m) => m.data),
            [
                ...names.map((name) => peerCommand(name, { sessionId: "x" })),
                message,
            ]
        );
        assert.deepStrictEqual(peer.other, []);
    });

    it("treats a visitor who signs in as a moderator from then on", async () => {
        const room = await colyseus.createRoom("cyber", SPACE);
        // Joins anonymously under their own name, then signs in.
        const late = await colyseus.connectTo(room, joinOpts("anon"));
        const other = await colyseus.connectTo(room, joinOpts("0xother"));
        const received = collect(other, "chat-channel");
        collect(late, "chat-channel");

        late.send("chat-channel", command("ADMIN_ANSWER_VOICE_PERMISSION"));
        await settle();
        assert.deepStrictEqual(received, []);

        late.send("login", [sessionToken(ADMIN), "u", "a", ADMIN]);
        await settle();
        late.send("chat-channel", command("ADMIN_ANSWER_VOICE_PERMISSION"));
        await settle();
        assert.strictEqual(received.length, 1);
    });
});
