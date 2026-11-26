import {
    buildSocialHandoff,
    chatPacket,
    GameSocial,
    isPagePacket,
    readChatText,
    readSocialHandoff,
    readVoicePoses,
    TalkingTracker,
    TALKING_HOLD_MS,
    voiceGain,
    voiceVolume,
    type SocialRoom,
    type SocialVoiceState,
} from "./gameSocial";
import { departureVoice } from "./lobbySocialHandoff";

function fakeRoom(sessionId = "me") {
    const room = {
        sessionId,
        sent: [] as any[],
        voice: "off" as SocialVoiceState,
        levels: [] as Array<[string, number]>,
        gain: null as ((id: string) => number | null) | null,
        names: { ada: "Ada" } as Record<string, string>,
        sendChat(packet: object) {
            room.sent.push(packet);
            return true;
        },
        peerName: (id: string) => room.names[id] || "",
        voiceState: () => room.voice,
        goLive: jest.fn(async () => {
            room.voice = "live";
        }),
        listen: jest.fn(async () => {
            room.voice = "muted";
        }),
        voiceLevels: () => room.levels,
        setVoiceGain(gain: typeof room.gain) {
            room.gain = gain;
        },
    };
    return room satisfies SocialRoom;
}

function social(now = { t: 10_000 }) {
    const toGame = jest.fn();
    const layer = new GameSocial({
        selfName: "Me",
        toGame,
        now: () => now.t,
    });
    return { layer, toGame, now };
}

describe("the lobby handoff", () => {
    const lobby = [
        { sessionId: "a", name: "Ada", text: " hello ", sentAt: 1 },
        { sessionId: "me", name: "Me", text: "hi Ada", sentAt: 2 },
        {
            sessionId: "a",
            name: "Ada",
            text: "just for you",
            sentAt: 3,
            recipientId: "me",
        },
    ];

    it("carries the room chat, never a direct message", () => {
        expect(buildSocialHandoff(lobby, "me", "live")).toEqual({
            messages: [
                { name: "Ada", text: "hello", sentAt: 1, self: false },
                { name: "Me", text: "hi Ada", sentAt: 2, self: true },
            ],
            voice: "live",
        });
    });

    it("reads back what it built and drops malformed entries", () => {
        const handoff = buildSocialHandoff(lobby, "me", "muted");
        expect(readSocialHandoff(JSON.parse(JSON.stringify(handoff)))).toEqual(
            handoff
        );
        expect(readSocialHandoff({ messages: "no" })).toBeNull();
        expect(
            readSocialHandoff({
                messages: [{ text: 4 }, { text: "ok", name: 7 }],
                voice: "shouting",
            })
        ).toEqual({
            messages: [{ name: "Visitor", text: "ok", sentAt: 0, self: false }],
            voice: "off",
        });
    });

    it("remembers the voice the visitor left the lobby with", () => {
        // In the world the lobby reports its own voice as off.
        expect(
            departureVoice("live", { lobbyPresent: false, voiceState: "off" })
        ).toBe("live");
        expect(
            departureVoice("live", { lobbyPresent: true, voiceState: "muted" })
        ).toBe("muted");
    });
});

describe("chat", () => {
    it("keeps the lobby's messages and adds the room's after them", () => {
        const { layer } = social();
        const room = fakeRoom();
        layer.attach(room);
        layer.receive("ada", chatPacket("in the game", 50), 50);
        layer.carry({
            messages: [{ name: "Ada", text: "before", sentAt: 1, self: false }],
            voice: "off",
        });
        // The page asks the lobby twice; nothing is shown twice.
        layer.carry({
            messages: [
                { name: "Ada", text: "before", sentAt: 1, self: false },
                { name: "Me", text: "leaving", sentAt: 2, self: true },
            ],
            voice: "off",
        });
        expect(
            layer.state.messages.map((m) => [m.name, m.text, m.carried])
        ).toEqual([
            ["Ada", "before", true],
            ["Me", "leaving", true],
            ["Ada", "in the game", false],
        ]);
    });

    it("sends on the room and shows the room's echo as the visitor's own", () => {
        const { layer, now } = social();
        const room = fakeRoom();
        expect(layer.send("too early")).toBe(false);
        layer.attach(room);
        expect(layer.send("  hello  ")).toBe(true);
        expect(room.sent).toEqual([
            { type: "MESSAGE", text: "hello", acc_date: expect.any(String) },
        ]);
        // One message a second, as the room allows.
        expect(layer.send("again")).toBe(false);
        now.t += 1000;
        expect(layer.send("again")).toBe(true);
        layer.receive("me", room.sent[0], 5);
        expect(layer.state.messages[0]).toMatchObject({
            name: "Me",
            text: "hello",
            self: true,
        });
    });

    it("keeps chat and room commands from the game, in both directions", () => {
        const { layer } = social();
        layer.attach(fakeRoom());
        // Game packets pass through to the game.
        expect(layer.receive("ada", { ev: [1] })).toBe(false);
        expect(layer.receive("ada", chatPacket("hi", 1))).toBe(true);
        expect(layer.receive("ada", { type: "RTM_COMMAND", command: {} })).toBe(
            true
        );
        expect(layer.state.messages.map((m) => m.text)).toEqual(["hi"]);
        // A game can't put words in the visitor's mouth, however encoded.
        expect(layer.allowsRelay({ score: 3 })).toBe(true);
        expect(layer.allowsRelay(chatPacket("forged", 1))).toBe(false);
        expect(
            isPagePacket(JSON.stringify(JSON.stringify(chatPacket("x", 1))))
        ).toBe(true);
        expect(readChatText({ type: "MESSAGE", text: "  " })).toBeNull();
    });
});

describe("voice", () => {
    it("goes live again after the trip, once the game is revealed", async () => {
        const { layer } = social();
        const room = fakeRoom();
        layer.carry({ messages: [], voice: "live" });
        layer.attach(room);
        await Promise.resolve();
        // Still in the lobby: the microphone is not live in two places.
        expect(room.goLive).not.toHaveBeenCalled();
        layer.arrive();
        await new Promise((done) => setTimeout(done));
        expect(room.goLive).toHaveBeenCalledTimes(1);
        expect(room.voice).toBe("live");
        // The visitor mutes: the carried state is not forced on them again.
        room.voice = "muted";
        layer.attach(room);
        await new Promise((done) => setTimeout(done));
        expect(room.goLive).toHaveBeenCalledTimes(1);
    });

    it("keeps a listener listening and leaves voice off when it was off", async () => {
        const listening = social();
        const room = fakeRoom();
        listening.layer.carry({ messages: [], voice: "muted" });
        listening.layer.attach(room);
        listening.layer.arrive();
        await new Promise((done) => setTimeout(done));
        expect(room.listen).toHaveBeenCalledTimes(1);
        expect(room.goLive).not.toHaveBeenCalled();

        const off = social();
        const quiet = fakeRoom();
        off.layer.attach(quiet);
        off.layer.arrive();
        await new Promise((done) => setTimeout(done));
        expect(quiet.goLive).not.toHaveBeenCalled();
        expect(quiet.listen).not.toHaveBeenCalled();
    });

    it("waits for the room to connect before restoring", async () => {
        const { layer } = social();
        const room = fakeRoom("");
        layer.carry({ messages: [], voice: "live" });
        layer.attach(room);
        layer.arrive();
        await new Promise((done) => setTimeout(done));
        expect(room.goLive).not.toHaveBeenCalled();
        (room as any).sessionId = "me";
        layer.tick();
        await new Promise((done) => setTimeout(done));
        expect(room.goLive).toHaveBeenCalledTimes(1);
    });

    it("places voices where the game says, else leaves the room's rule", () => {
        const { layer } = social();
        const room = fakeRoom();
        layer.attach(room);
        expect(room.gain).toBeNull();
        expect(layer.setVoicePoses({ listener: { x: "0" } })).toBe(false);
        expect(
            layer.setVoicePoses({
                listener: { x: 0, y: 0, z: 0, h: 0 },
                players: [
                    { id: "near", x: 3, y: 0, z: 0 },
                    { id: "far", x: 0, y: 0, z: 100 },
                    { id: "bad", x: NaN, z: 0 },
                ],
            })
        ).toBe(true);
        expect(room.gain("near")).toBe(1);
        expect(room.gain("far")).toBe(0);
        expect(room.gain("bad")).toBeNull();
        expect(room.gain("unplaced")).toBeNull();
        // A new room keeps the game's placement.
        const next = fakeRoom();
        layer.attach(next);
        expect(room.gain).toBeNull();
        expect(next.gain("near")).toBe(1);
    });

    it("falls off in a line from 4 m to 60 m", () => {
        expect(voiceVolume(0)).toBe(1);
        expect(voiceVolume(4)).toBe(1);
        expect(voiceVolume(32)).toBeCloseTo(0.5);
        expect(voiceVolume(60)).toBe(0);
        expect(voiceVolume(NaN)).toBe(0);
        const poses = readVoicePoses({
            listener: { x: 0, z: 0 },
            players: [{ id: "a", x: 0, y: 32, z: 0 }],
        });
        expect(poses.listener).toEqual({ x: 0, y: 0, z: 0, h: 0 });
        expect(voiceGain(poses, "a")).toBeCloseTo(0.5);
    });
});

describe("who is talking", () => {
    it("holds a talker through short gaps and reports only changes", () => {
        const tracker = new TalkingTracker();
        expect(tracker.sample([["a", 0.7]], 0)).toEqual(["a"]);
        expect(tracker.sample([["a", 0.1]], 100)).toBeNull();
        expect(
            tracker.sample(
                [
                    ["a", 0.1],
                    ["b", 0.6],
                ],
                TALKING_HOLD_MS
            )
        ).toEqual(["b"]);
        expect(tracker.sample([], TALKING_HOLD_MS * 3)).toEqual([]);
    });

    it("tells the game who is talking, and when everyone stops", () => {
        const { layer, toGame, now } = social();
        const room = fakeRoom();
        layer.attach(room);
        room.levels = [
            ["ada", 0.8],
            ["me", 0.9],
        ];
        layer.tick();
        expect(toGame).toHaveBeenLastCalledWith("talking", {
            ids: ["ada", "me"],
            self: true,
        });
        layer.tick();
        expect(toGame).toHaveBeenCalledTimes(1);
        room.levels = [];
        now.t += TALKING_HOLD_MS;
        layer.tick();
        expect(toGame).toHaveBeenLastCalledWith("talking", {
            ids: [],
            self: false,
        });
        // Leaving the room silences everyone at once.
        room.levels = [["ada", 0.8]];
        layer.tick();
        layer.attach(null);
        expect(toGame).toHaveBeenLastCalledWith("talking", {
            ids: [],
            self: false,
        });
        expect(layer.state.talking).toEqual([]);
    });
});
