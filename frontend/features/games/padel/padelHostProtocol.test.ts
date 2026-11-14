import {
    createPadelHostEnvelope,
    readPadelHostEnvelope,
    readPadelHostState,
    readPadelHostCommand,
} from "./padelHostProtocol";
const attempt = "12345678-1234-1234-1234-123456789012";
const identity = {
    avatarUrl: "/player.vrm",
    pfp: "/player.png",
    name: "Player",
};
test("the relay requires a valid attempt and its own protocol", () => {
    const value = createPadelHostEnvelope(attempt, "connect");
    expect(readPadelHostEnvelope(value, attempt)).toEqual(value);
    expect(readPadelHostEnvelope(value, "other")).toBeNull();
    expect(
        readPadelHostEnvelope({ ...value, protocol: "other" }, attempt)
    ).toBeNull();
    expect(
        readPadelHostEnvelope({ ...value, type: "navigate" }, attempt)
    ).toBeNull();
});
test("host state copies public identity and validates lifecycle fields", () => {
    const state = {
        identity: { ...identity, token: "private" },
        active: true,
        mode: "visit",
        setupOpen: false,
    };
    expect(readPadelHostState(state)).toEqual({ ...state, identity });
    expect(readPadelHostState({ ...state, identity: null })).toBeNull();
    expect(
        readPadelHostState({ ...state, active: false, identity: null })
    ).not.toBeNull();
    expect(readPadelHostState({ ...state, mode: "other" })).toBeNull();
});
test("commands cannot navigate or invoke renderer lifecycle; presentation fields are copied", () => {
    for (const type of [
        "padel:exit",
        "padel:travel",
        "padel:dispose",
        "padel:identity",
    ])
        expect(readPadelHostCommand({ type })).toBeNull();
    expect(
        readPadelHostCommand({ type: "padel:play", token: "private" })
    ).toEqual({ type: "padel:play" });
    expect(
        readPadelHostCommand({ type: "padel:input", enabled: "yes" })
    ).toBeNull();
    expect(
        readPadelHostCommand({
            type: "padel:avatar",
            avatarUrl: "javascript:bad",
            pfp: "/a.png",
        })
    ).toBeNull();
    expect(
        readPadelHostCommand({
            type: "padel:emote",
            index: 200,
            name: "Dance",
        })
    ).toBeNull();
});
test("peer updates reject invalid motion and omit internal account fields", () => {
    const peer = {
        id: "p",
        username: "Player",
        vrmUrl: "/a.vrm",
        avatar: "/a.png",
        x: 1,
        y: 0,
        z: 2,
        rotation: 0,
        speed: 0,
        grounded: true,
        verticalVelocity: 0,
        vx: 0,
        vz: 0,
        emote: null,
    };
    const command = {
        type: "padel:peers",
        sessionId: "local",
        players: [{ ...peer, token: "private", accountId: "private" }],
    };
    expect(readPadelHostCommand(command)).toEqual({
        ...command,
        players: [peer],
    });
    expect(
        readPadelHostCommand({
            ...command,
            players: [{ ...peer, x: Infinity }],
        })
    ).toBeNull();
    expect(
        readPadelHostCommand({ ...command, players: Array(65).fill(peer) })
    ).toBeNull();
});

test("diagonal sampler corrections preserve the peer packet while capping animation speed", () => {
    const peer = {
        id: "p",
        username: "Player",
        vrmUrl: "/a.vrm",
        avatar: "/a.png",
        x: 1,
        y: 0,
        z: 2,
        rotation: 0,
        speed: Math.hypot(15, 15),
        grounded: true,
        verticalVelocity: 0,
        vx: 15,
        vz: 15,
        emote: null,
    };
    const command = {
        type: "padel:peers",
        sessionId: "local",
        players: [peer],
    };
    expect(readPadelHostCommand(command)).toEqual({
        ...command,
        players: [{ ...peer, speed: 15 }],
    });
    expect(
        readPadelHostCommand({ ...command, players: [{ ...peer, speed: 22 }] })
    ).toBeNull();
    expect(
        readPadelHostCommand({ ...command, players: [{ ...peer, vx: 16 }] })
    ).toBeNull();
});
