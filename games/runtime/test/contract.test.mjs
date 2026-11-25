import assert from "node:assert/strict";
import test from "node:test";
import { RuntimeSession } from "../src/index.ts";
import {
    CONTRACT_VERSION,
    GAME_MESSAGE_PREFIX,
    gameMessageKind,
    readArrivalView,
    readEnterData,
    readTrip,
    tripPlayers,
} from "../src/contract.ts";
import { connectPage } from "../src/page.ts";

const view = {
    cameraOffset: { x: 0, y: 2.3, z: 4.8 },
    cameraTargetOffset: { x: 0, y: 1.2, z: 0 },
    avatarRotation: 1,
    avatarLift: 0,
    fov: 50,
};
const trip = {
    id: "trip_0123456789abcdef",
    room: "oncyber-ace-party-trip_0123456789abcdef",
    size: 3,
    self: "",
    members: [
        {
            id: "a",
            name: " Ada ",
            pfp: "",
            avatarUrl: "/a.vrm",
            token: "secret",
        },
        { id: "b" },
    ],
    arrived: [],
};

test("one prefix for every game; a game's old prefix is read only when asked", () => {
    assert.equal(gameMessageKind("oncyber:game:hello"), "hello");
    assert.equal(
        gameMessageKind("oncyber:game:arrival-ready", "ace"),
        "arrival-ready"
    );
    assert.equal(gameMessageKind("ace:hello"), null);
    assert.equal(gameMessageKind("ace:hello", "ace"), "hello");
    assert.equal(gameMessageKind("garden:hello", "ace"), null);
    assert.equal(gameMessageKind("oncyber:game:"), null);
    assert.equal(gameMessageKind("oncyber:check-report", "ace"), null);
    assert.equal(gameMessageKind({ type: "x" }), null);
});

test("arrival views are bounded copies; malformed ones read as null", () => {
    assert.deepEqual(readArrivalView(view), {
        cameraOffset: view.cameraOffset,
        cameraTargetOffset: view.cameraTargetOffset,
        avatarRotation: 1,
        avatarHeight: 1.8,
        fov: 50,
        cameraMode: "third-person",
    });
    assert.equal(readArrivalView({ ...view, fov: 500 }), null);
    assert.equal(
        readArrivalView({ ...view, cameraOffset: { x: 1e9, y: 0, z: 0 } }),
        null
    );
    assert.equal(readArrivalView(null), null);
});

test("a trip keeps public member fields only and counts the visitor", () => {
    const read = readTrip(trip);
    assert.deepEqual(read.members, [
        { id: "a", name: "Ada", pfp: "", avatarUrl: "/a.vrm" },
        { id: "b", name: "Player", pfp: "", avatarUrl: "" },
    ]);
    assert.equal(read.size, 3);
    assert.equal(readTrip({ members: [] }), null);
    assert.equal(readTrip(null), null);
});

test("anything malformed enters as a direct solo visit", () => {
    assert.deepEqual(readEnterData(undefined), {
        arrival: { from: "direct", view: null },
        trip: null,
    });
    assert.deepEqual(
        readEnterData({ arrival: { from: "lobby", view: "nope" } }),
        { arrival: { from: "lobby", view: null }, trip: null }
    );
    assert.equal(
        readEnterData({ arrival: { from: "direct", view }, trip }).arrival.view,
        null
    );
});

test("players use the party room's ids once someone else has arrived", () => {
    const me = { name: "Me" };
    assert.deepEqual(tripPlayers(null, me), [{ id: "self", name: "Me" }]);
    assert.deepEqual(
        tripPlayers(readTrip(trip), me).map((p) => p.id),
        ["self", "a", "b"]
    );
    const live = readTrip({
        ...trip,
        self: "s1",
        arrived: [{ id: "s2", name: "Ada" }],
    });
    assert.deepEqual(tripPlayers(live, me), [
        { id: "s1", name: "Me" },
        { id: "s2", name: "Ada" },
    ]);
});

test("the trip carries the room's roster, and players use its ids once it is there", () => {
    const me = { name: "Me" };
    assert.equal(readTrip(trip).roster, null);
    assert.equal(readTrip({ ...trip, roster: { members: "x" } }).roster, null);
    const member = (id, order, seat = "player") => ({
        id,
        session: `s-${id}`,
        name: id.toUpperCase(),
        seat,
        order,
    });
    const live = readTrip({
        ...trip,
        self: "s-m2",
        arrived: [{ id: "s-m1", name: "Ada" }],
        roster: {
            self: "m2",
            host: "m1",
            members: [
                member("m1", 1),
                member("m2", 2),
                member("m3", 3, "spectator"),
            ],
        },
    });
    assert.equal(live.roster.host, "m1");
    assert.equal(live.roster.members[0].state, "here");
    // Member ids (they survive a reconnect), the visitor first, seats only.
    assert.deepEqual(tripPlayers(live, me), [
        { id: "m2", name: "Me" },
        { id: "m1", name: "M1" },
    ]);
    // Alone on the roster so far: the room's ids still decide.
    const early = readTrip({
        ...trip,
        self: "s-m2",
        arrived: [{ id: "s-m1", name: "Ada" }],
        roster: { self: "m2", host: "m2", members: [member("m2", 1)] },
    });
    assert.deepEqual(
        tripPlayers(early, me).map((p) => p.id),
        ["s-m2", "s-m1"]
    );
});

function session(game) {
    return new RuntimeSession(
        () => ({
            async prepare() {},
            enter() {},
            update() {},
            suspend() {
                return null;
            },
            restore() {},
            dispose() {},
            inspect() {
                return {};
            },
            ...game,
        }),
        {
            manifest: { input: {}, assets: [], capabilities: [] },
            graphics: {},
            sendUI() {},
            services: {
                identity: { id: "v", name: "V" },
                asset: async () => new ArrayBuffer(0),
                call: async () => true,
            },
        }
    );
}
const poses = {
    avatar: { id: "v", position: [0, 0, 0], rotation: [0, 0, 0, 1] },
    camera: {
        position: [0, 1, 4],
        target: [0, 1, 0],
        fov: 50,
        mode: "third-person",
    },
    party: [],
};

test("enter() hands the game the arrival and the trip, and inspect() reports them", async () => {
    let got;
    const s = session({
        enter(continuity) {
            got = continuity;
        },
    });
    await s.prepare();
    await s.enter({ ...poses, arrival: { from: "lobby", view }, trip });
    assert.equal(got.arrival.from, "lobby");
    assert.equal(got.arrival.view.avatarHeight, 1.8);
    assert.equal(got.trip.members[0].token, undefined);
    assert.deepEqual(s.inspect(), {
        hostPhase: "entered",
        hostFrames: 0,
        hostArrival: "lobby",
        hostParty: 3,
        hostPartyArrived: 1,
        hostInputPaused: false,
    });
});

test("a host with no page enters without arrival or trip", async () => {
    let got;
    const s = session({
        enter(continuity) {
            got = continuity;
        },
    });
    await s.prepare();
    await s.enter(poses);
    assert.equal(got.arrival, undefined);
    assert.equal(s.inspect().hostArrival, "");
    assert.equal(s.inspect().hostParty, 0);
});

test("party() reaches the game only after it has entered", async () => {
    const seen = [];
    const s = session({
        party(next) {
            seen.push(next?.arrived.length ?? null);
        },
    });
    s.party(trip);
    await s.prepare();
    await s.enter({ ...poses, trip });
    s.party({ ...trip, self: "s1", arrived: [{ id: "s2", name: "Ada" }] });
    s.party(null);
    assert.deepEqual(seen, [1, null]);
    assert.equal(s.inspect().hostParty, 0);
    const plain = session({});
    await plain.prepare();
    await plain.enter(poses);
    plain.party(trip); // a game without party() is fine
    assert.equal(plain.inspect().hostParty, 3);
});

// A stand-in for the frame's window and its parent page.
function frame({ embedded = true } = {}) {
    const sent = [],
        handlers = new Set(),
        store = new Map();
    const parent = {
        postMessage: (message, origin) => sent.push({ message, origin }),
    };
    const win = {
        location: { origin: "https://oncyber.test" },
        addEventListener: (_, h) => handlers.add(h),
        removeEventListener: (_, h) => handlers.delete(h),
        localStorage: {
            getItem: (k) => store.get(k) ?? null,
            setItem: (k, v) => store.set(k, v),
        },
    };
    win.parent = embedded ? parent : win;
    const deliver = (data, from = {}) =>
        handlers.forEach((h) =>
            h({ source: parent, origin: win.location.origin, data, ...from })
        );
    return { win, sent, deliver, kinds: () => sent.map((s) => s.message.type) };
}
const options = { arrival: { walkable: true } };

test("the page client greets with its declarations and reads identity and enter", async () => {
    const f = frame();
    const page = connectPage({ ...options, window: f.win });
    page.hello();
    page.dispose(); // one greeting, no timer left behind
    const again = connectPage({ ...options, window: f.win });
    assert.deepEqual(f.sent[0], {
        message: {
            type: "oncyber:game:hello",
            contract: CONTRACT_VERSION,
            arrival: { walkable: true },
            party: null,
        },
        origin: "https://oncyber.test",
    });
    const entering = again.enterData();
    f.deliver({
        type: "oncyber:game:identity",
        name: " Ada ",
        pfp: "",
        avatarUrl: "/a.vrm",
    });
    assert.deepEqual(await again.identity(), {
        name: "Ada",
        pfp: "",
        avatarUrl: "/a.vrm",
    });
    f.deliver({
        type: "oncyber:game:enter",
        arrival: { from: "lobby", view },
        trip,
    });
    const enter = await entering;
    assert.equal(enter.arrival.view.fov, 50);
    assert.equal(enter.trip.size, 3);
    // Saved values are saved.ts: the client has no storage of its own.
    assert.equal(again.storage, undefined);
    again.dispose();
});

test("the page client ignores other windows, other origins and old prefixes", async () => {
    const f = frame();
    const page = connectPage({
        ...options,
        window: f.win,
        identityTimeoutMs: 10,
    });
    f.deliver(
        { type: "oncyber:game:identity", name: "Mallory" },
        { source: {} }
    );
    f.deliver(
        { type: "oncyber:game:identity", name: "Mallory" },
        { origin: "https://evil.test" }
    );
    f.deliver({ type: "ace:identity", name: "Old" });
    assert.equal((await page.identity()).name, "You");
    page.dispose();
});

test("the room's self id and roster updates reach party listeners", () => {
    const f = frame();
    const page = connectPage({ ...options, window: f.win });
    const seen = [];
    page.on("party", (next) =>
        seen.push(next && [next.self, next.arrived.length])
    );
    f.deliver({ type: "oncyber:game:party", party: trip });
    f.deliver({ type: "oncyber:game:self", id: "s1" });
    f.deliver({
        type: "oncyber:game:party",
        party: { ...trip, self: "s1", arrived: [{ id: "s2", name: "Bo" }] },
    });
    f.deliver({
        type: "oncyber:game:party",
        party: { ...trip, self: "s1", arrived: [{ id: "s2", name: "Bo" }] },
    });
    f.deliver({ type: "oncyber:game:party", party: null });
    assert.deepEqual(seen, [["", 0], ["s1", 0], ["s1", 1], null]);
    page.dispose();
});

test("standalone, the client answers with defaults", async () => {
    const f = frame({ embedded: false });
    const page = connectPage({ ...options, window: f.win });
    page.hello();
    page.ready();
    assert.equal(f.sent.length, 0);
    assert.equal((await page.identity()).name, "You");
    assert.deepEqual(await page.enterData(), {
        arrival: { from: "direct", view: null },
        trip: null,
    });
    assert.equal(page.revealed, true);
});
