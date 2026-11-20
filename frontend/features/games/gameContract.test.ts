import {
    enterMessage,
    gameArrivalView,
    gameMessageTypes,
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
        readGameDeclaration({ contract: 2, arrival: { walkable: false } })
    ).toEqual({ contract: 2, walkable: false });
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
