import {
    MATCH_BURST,
    MATCH_MAX_BYTES,
    MatchBridge,
    matchSeatKey,
    readMatchSend,
    readRoomRoster,
} from "./gameMatch";

// jsdom has no Web Crypto; Node's is the same interface.
if (!globalThis.crypto?.getRandomValues)
    Object.defineProperty(globalThis, "crypto", {
        value: require("crypto").webcrypto,
    });

function fakeRoom() {
    const handlers = new Map<string, (message: any) => void>();
    return {
        handlers,
        sent: [] as [string, any][],
        onMessage(type: string, handler: (message: any) => void) {
            handlers.set(type, handler);
        },
        send(type: string, message: any) {
            this.sent.push([type, message]);
        },
    };
}
function bridge() {
    const posted: [string, any][] = [];
    let time = 10_000;
    const match = new MatchBridge(
        (kind, data) => posted.push([kind, data]),
        () => time
    );
    return { match, posted, advance: (ms: number) => (time += ms) };
}
const member = (id: string, extra = {}) => ({
    id,
    session: id,
    name: id,
    seat: "player",
    state: "here",
    order: 1,
    ...extra,
});

it("cleans the room's roster for the game", () => {
    const roster = readRoomRoster({
        self: "a",
        host: "a",
        members: [
            member("a"),
            member("a"),
            { id: 5 },
            member("b", { seat: "spectator", state: "away", name: " " }),
        ],
    });
    expect(roster?.members.map((m) => m.id)).toEqual(["a", "b"]);
    expect(roster?.members[1]).toMatchObject({
        seat: "spectator",
        state: "away",
        name: "Player",
    });
    expect(roster?.online).toBe(true);
    expect(readRoomRoster({ members: "x" })).toBeNull();
});

it("accepts only array packets within the size limit", () => {
    expect(readMatchSend({ data: [1, 0, { x: 1 }] })).toEqual({
        data: [1, 0, { x: 1 }],
    });
    expect(readMatchSend({ data: [1, 1, "hit"], to: "b" })?.to).toBe("b");
    expect(readMatchSend({ data: { x: 1 } })).toBeNull();
    expect(
        readMatchSend({ data: [1, 0, "x".repeat(MATCH_MAX_BYTES)] })
    ).toBeNull();
    const loop: any[] = [];
    loop.push(loop);
    expect(readMatchSend({ data: loop })).toBeNull();
});

it("passes the roster and match packets from the room to the game", () => {
    const { match, posted } = bridge();
    const room = fakeRoom();
    match.attach(room);
    room.handlers.get("game-roster")!({
        self: "a",
        host: "a",
        members: [member("a"), member("b")],
    });
    room.handlers.get("game-match")!(["b", [3, 0, { x: 2 }]]);
    room.handlers.get("game-match")!({ from: "b" });
    room.handlers.get("game-match-limit")!({ dropped: 4 });
    expect(posted.map(([kind]) => kind)).toEqual([
        "roster",
        "match",
        "match-limit",
    ]);
    expect(posted[1][1]).toEqual({ from: "b", data: [3, 0, { x: 2 }] });
    expect(posted[2][1]).toEqual({ dropped: 4 });
});

it("marks the roster offline when the room drops, and ignores the old room", () => {
    const { match, posted } = bridge();
    const room = fakeRoom();
    match.attach(room);
    room.handlers.get("game-roster")!({
        self: "a",
        host: "a",
        members: [member("a")],
    });
    match.attach(null);
    expect(posted.at(-1)).toEqual([
        "roster",
        expect.objectContaining({
            roster: expect.objectContaining({ online: false, self: "a" }),
        }),
    ]);
    const count = posted.length;
    room.handlers.get("game-match")!(["b", [1, 0, 0]]);
    expect(posted.length).toBe(count);
    expect(match.send({ data: [1, 0, 0] })).toBe(false);
});

it("sends at the channel's pace and tells the game when it drops a flood", () => {
    const { match, posted, advance } = bridge();
    const room = fakeRoom();
    match.attach(room);
    // Two seconds at thirty a second: nothing is lost.
    for (let i = 0; i < 60; i++) {
        expect(match.send({ data: [i, 0, i] })).toBe(true);
        advance(1000 / 30);
    }
    // Then two hundred in one frame.
    let passed = 0;
    for (let i = 0; i < 200; i++) if (match.send({ data: [i, 0, i] })) passed++;
    expect(passed).toBeLessThanOrEqual(MATCH_BURST);
    expect(room.sent.length).toBe(60 + passed);
    expect(room.sent[0]).toEqual(["game-match", { data: [0, 0, 0] }]);
    expect(posted.filter(([kind]) => kind === "match-limit").length).toBe(1);
});

it("keeps one seat key for the tab", () => {
    const stored = new Map<string, string>();
    const storage = {
        getItem: (k: string) => stored.get(k) ?? null,
        setItem: (k: string, v: string) => void stored.set(k, v),
    };
    const key = matchSeatKey(storage);
    expect(key).toMatch(/^[a-f0-9]{36}$/);
    expect(matchSeatKey(storage)).toBe(key);
    expect(matchSeatKey(null)).not.toBe(key);
});
