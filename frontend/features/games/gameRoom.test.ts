import { GameRoom } from "./gameRoom";

function fakeRoom(players: Record<string, object>) {
    return {
        sessionId: "me",
        state: { players: new Map(Object.entries(players)) },
        send: jest.fn(),
    };
}

function connected(players: Record<string, object>) {
    const onChange = jest.fn();
    const game = new GameRoom(
        { userId: "u", name: "Me", pfp: "", avatarUrl: "" },
        onChange,
        "test-room"
    );
    const room = fakeRoom(players);
    (game as any).room = room;
    return { game, room, onChange };
}

it("sends the game's pose as the native move message", () => {
    const { game, room } = connected({});
    game.setPose({ x: 1, y: 2, z: 3, h: 0.5, a: 9 });
    expect(room.send).toHaveBeenCalledWith("move", [1, 2, 3, 0.5, 9, true]);
});

it("samples everyone else, marking only changed poses fresh", () => {
    const peer = {
        positionX: 10,
        positionY: 0,
        positionZ: -4,
        rotation: 1.5,
        animation: 8,
        username: encodeURIComponent("Ada Lovelace"),
        avatar: "https://example.com/pfp.png",
        VRM: "https://example.com/a.vrm",
    };
    const { game, room, onChange } = connected({
        me: { ...peer, positionX: 0 },
        ada: peer,
    });
    const [first] = game.samplePeers();
    expect(first).toMatchObject({
        id: "ada",
        x: 10,
        z: -4,
        h: 1.5,
        a: 8,
        name: "Ada Lovelace",
        vrm: "https://example.com/a.vrm",
        fresh: true,
    });
    expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ players: 2 })
    );
    expect(game.samplePeers()[0].fresh).toBe(false);
    (room.state.players.get("ada") as any).positionX = 11;
    expect(game.samplePeers()[0].fresh).toBe(true);
});

it("clamps out-of-range animation codes from the room", () => {
    const { game } = connected({
        x: {
            positionX: 0,
            positionY: 0,
            positionZ: 0,
            rotation: 0,
            animation: -1,
        },
    });
    expect(game.samplePeers()[0].a).toBe(0);
});

describe("the page's chat and voice", () => {
    it("never relays a game packet that reads as chat", () => {
        const { game, room } = connected({});
        expect(game.relay({ type: "MESSAGE", text: "forged by a game" })).toBe(
            false
        );
        expect(room.send).not.toHaveBeenCalled();
        expect(game.relay({ hello: 1 })).toBe(true);
    });

    it("sends chat on the room's chat channel and names its members", () => {
        const { game, room } = connected({
            ada: { username: encodeURIComponent("Ada Lovelace") },
        });
        expect(game.sendChat({ type: "MESSAGE", text: "hi" })).toBe(true);
        expect(room.send).toHaveBeenCalledWith("chat-channel", {
            type: "MESSAGE",
            text: "hi",
        });
        expect(game.peerName("ada")).toBe("Ada Lovelace");
        expect(game.peerName("nobody")).toBe("");
    });

    it("plays a voice where the game placed it, else by room pose", () => {
        const { game } = connected({
            ada: { positionX: 32, positionY: 0, positionZ: 0 },
        });
        const audio = { volume: 1 };
        (game as any).audio.set("ada", audio);
        game.samplePeers();
        expect(audio.volume).toBeCloseTo(0.5);
        game.setVoiceGain((id) => (id === "ada" ? 0.25 : null));
        expect(audio.volume).toBe(0.25);
        game.setVoiceGain(null);
        expect(audio.volume).toBeCloseTo(0.5);
    });
});
