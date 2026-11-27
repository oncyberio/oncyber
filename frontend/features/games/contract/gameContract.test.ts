import fixtures from "../../../../games/runtime/test/contract.fixtures.json";
import messages from "../../../../games/runtime/messages.json";
import { readAvatarMessage } from "@features/avatar-picker/pageAvatar";
import {
    CONTRACT_OLDEST,
    CONTRACT_VERSION,
    GAME_MESSAGE_PREFIX,
    GAME_NAME_MAX,
    contractNotice,
    contractSupport,
    enterMessage,
    gameArrivalView,
    gameMessageTypes,
    gameName,
    gameTrip,
    readGameDeclaration,
    readGameMessage,
    tripKey,
} from "./gameContract";

const party = {
    id: "trip_0123456789abcdef",
    size: 3,
    members: [
        { id: "a", name: "Ada", pfp: "", avatarUrl: "" },
        { id: "b", name: "Bo", pfp: "", avatarUrl: "" },
    ],
};
const view = {
    cameraOffset: { x: 0, y: 2, z: 5 },
    cameraTargetOffset: { x: 0, y: 1, z: 0 },
    avatarRotation: 0.5,
    avatarLift: 0,
    fov: 50,
    peers: [{ id: "a", name: "Ada", offset: { x: 1, y: 0, z: 0 } }],
};

test("games speak one prefix; a game's own old prefix still reads", () => {
    expect(readGameMessage("oncyber:game:hello", "ace")).toEqual({
        kind: "hello",
        dialect: "contract",
    });
    expect(readGameMessage("garden:arrival-ready", "garden")).toEqual({
        kind: "arrival-ready",
        dialect: "legacy",
    });
    expect(readGameMessage("garden:hello", "ace")).toBeNull();
    expect(readGameMessage("oncyber:check-report", "ace")).toBeNull();
    expect(readGameMessage("ace:Hello World", "ace")).toBeNull();
    expect(readGameMessage(undefined, "ace")).toBeNull();
});

test("the page answers in the game's form, and in both before it knows", () => {
    expect(gameMessageTypes("ace", "identity", "contract")).toEqual([
        "oncyber:game:identity",
    ]);
    expect(gameMessageTypes("garden", "identity", "legacy")).toEqual([
        "garden:identity",
    ]);
    expect(gameMessageTypes("ace", "dispose", null)).toEqual([
        "oncyber:game:dispose",
        "ace:dispose",
    ]);
});

test("hello carries what the game declared about arriving", () => {
    expect(
        readGameDeclaration({ contract: 3, arrival: { walkable: false } })
    ).toEqual({ contract: 3, walkable: false });
    expect(readGameDeclaration({})).toEqual({ contract: 1, walkable: null });
});

test("the arrival view is the framing only", () => {
    expect(gameArrivalView(view)).toEqual({
        cameraOffset: { x: 0, y: 2, z: 5 },
        cameraTargetOffset: { x: 0, y: 1, z: 0 },
        avatarRotation: 0.5,
        avatarHeight: 1.8,
        fov: 50,
        cameraMode: "third-person",
    });
    expect(gameArrivalView({ ...view, fov: NaN })).toBeNull();
    expect(gameArrivalView(undefined)).toBeNull();
});

test("a trip adds the party room, the visitor's room id and who arrived", () => {
    expect(gameTrip(null, "room")).toBeNull();
    const waiting = gameTrip(party, "oncyber-ace-party-x");
    expect(waiting).toEqual({
        ...party,
        room: "oncyber-ace-party-x",
        self: "",
        arrived: [],
        roster: null,
    });
    const live = gameTrip(party, "oncyber-ace-party-x", "s2", [
        { id: "s9", name: "Bo", pfp: "", vrm: "/b.vrm" },
        { id: "s1", name: "Ada", pfp: "/a.png", vrm: "" },
    ]);
    // Sorted by room id, so every member lists the room the same way.
    expect(live.arrived).toEqual([
        { id: "s1", name: "Ada", pfp: "/a.png", avatarUrl: "" },
        { id: "s9", name: "Bo", pfp: "", avatarUrl: "/b.vrm" },
    ]);
    expect(tripKey(waiting)).not.toEqual(tripKey(live));
    expect(tripKey(live)).toEqual(
        tripKey(
            gameTrip(
                party,
                "oncyber-ace-party-x",
                "s2",
                live.arrived.map((m) => ({ ...m, vrm: m.avatarUrl }))
            )
        )
    );
    expect(tripKey(null)).toBe("");
});

test("the room's roster rides in the trip, and a change to it is a new trip", () => {
    const member = (id: string, order: number, state: "here" | "away") => ({
        id,
        session: state === "here" ? `s-${id}` : "",
        name: id,
        pfp: "",
        avatarUrl: "",
        seat: "player" as const,
        state,
        order,
    });
    const roster = {
        self: "m1",
        host: "m1",
        online: true,
        members: [member("m1", 1, "here"), member("m2", 2, "here")],
    };
    const trip = gameTrip(party, "oncyber-ace-party-x", "s-m1", [], roster);
    expect(trip.roster).toEqual(roster);
    expect(tripKey(trip)).not.toEqual(
        tripKey(gameTrip(party, "oncyber-ace-party-x", "s-m1", []))
    );
    const dropped = {
        ...roster,
        members: [member("m1", 1, "here"), member("m2", 2, "away")],
    };
    expect(tripKey(trip)).not.toEqual(
        tripKey(gameTrip(party, "oncyber-ace-party-x", "s-m1", [], dropped))
    );
    expect(tripKey(trip)).toEqual(
        tripKey(
            gameTrip(party, "oncyber-ace-party-x", "s-m1", [], { ...roster })
        )
    );
});

test("enter says how the visitor arrived", () => {
    expect(enterMessage(false, view, null)).toEqual({
        arrival: { from: "direct", view: null },
        trip: null,
    });
    const lobby = enterMessage(true, view, gameTrip(party, "r"));
    expect(lobby.arrival.from).toBe("lobby");
    expect(lobby.arrival.view.fov).toBe(50);
    expect(lobby.trip.room).toBe("r");
    expect(enterMessage(true, undefined, null).arrival).toEqual({
        from: "lobby",
        view: null,
    });
});

// The same cases the runtime answers in games/runtime/test/parity.test.mjs:
// both halves of the contract must agree on each.
describe("the cases both halves of the contract share", () => {
    test.each(fixtures.arrivalViews)("arrival view: $name", (fixture) => {
        expect(gameArrivalView(fixture.view)).toEqual(fixture.expect);
    });
    test.each(fixtures.messageTypes)("message type $type", (fixture) => {
        const read = readGameMessage(fixture.type, fixture.game);
        expect(read?.kind ?? null).toBe(fixture.kind);
        if (read) expect(read.dialect === "legacy").toBe(fixture.legacy);
    });
    test.each(fixtures.names)("name $name", (fixture) => {
        expect(gameName(fixture.name)).toBe(fixture.expect);
    });
    // The page's reader is the avatar picker's own; the game's is
    // games/runtime/src/avatar.ts, held to the same cases.
    test.each(fixtures.avatars)("avatar message: $name", (fixture) => {
        expect(
            readAvatarMessage(fixture.message, fixtures.avatarOrigin)
        ).toEqual(fixture.expect);
    });
    test("the list of kinds is for this contract", () => {
        expect(messages.contract).toBe(CONTRACT_VERSION);
        expect(messages.prefix).toBe(GAME_MESSAGE_PREFIX);
    });
});

test("a build's contract decides whether the page runs it", () => {
    expect(contractSupport(CONTRACT_VERSION)).toBe("current");
    expect(contractSupport(CONTRACT_OLDEST)).toBe("older");
    expect(contractSupport(CONTRACT_OLDEST - 1)).toBe("too-old");
    expect(contractSupport(CONTRACT_VERSION + 1)).toBe("too-new");
    expect(contractNotice("ace", CONTRACT_VERSION)).toBeNull();
    expect(contractNotice("ace", CONTRACT_OLDEST)).toMatch(
        /still loads\. Rebuild it/
    );
    expect(contractNotice("ace", 1)).toMatch(/was not loaded/);
    expect(contractNotice("ace", 99)).toMatch(/newer site/);
});

test("a name reaches a game cut to the length the runtime keeps", () => {
    const live = gameTrip(party, "r", "s1", [
        { id: "s2", name: "x".repeat(GAME_NAME_MAX + 5), pfp: "", vrm: "" },
        { id: "s3", name: "  ", pfp: "", vrm: "" },
    ]);
    expect(live.arrived.map((member) => member.name)).toEqual([
        "x".repeat(GAME_NAME_MAX),
        "Player",
    ]);
});
