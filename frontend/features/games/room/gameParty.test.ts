import {
    developmentParty,
    gameParty,
    partyRoomLabel,
    readPartyMembers,
} from "./gameParty";

const cohort = "trip_0123456789abcdef";

test("a solo visitor has no party", () => {
    expect(gameParty(undefined)).toBeNull();
    expect(gameParty("short")).toBeNull();
    expect(gameParty("bad cohort with spaces!!")).toBeNull();
});

test("a party counts the visitor and keeps public member fields only", () => {
    const party = gameParty(cohort, [
        {
            id: "a",
            name: "  Ada  ",
            avatar: "https://cdn.example/a.png",
            vrmUrl: "/avatars/a.vrm",
            offset: { x: 1, y: 0, z: 0 },
            token: "secret",
        },
        { id: "b", name: "", avatar: "javascript:alert(1)" },
    ]);
    expect(party).toEqual({
        id: cohort,
        size: 3,
        members: [
            {
                id: "a",
                name: "Ada",
                pfp: "https://cdn.example/a.png",
                avatarUrl: "/avatars/a.vrm",
            },
            { id: "b", name: "Player", pfp: "", avatarUrl: "" },
        ],
    });
});

test("members are bounded, unique and survive malformed input", () => {
    expect(readPartyMembers("nope")).toEqual([]);
    expect(
        readPartyMembers([null, { id: 7 }, { id: "x" }, { id: "x" }])
    ).toHaveLength(1);
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}` }));
    expect(readPartyMembers(many)).toHaveLength(7);
    expect(gameParty(cohort, many)?.size).toBe(8);
});

test("the party room is named after the game and the trip", () => {
    expect(partyRoomLabel("ace", cohort)).toBe(`oncyber-ace-party-${cohort}`);
});

test("?party=N stands in for a party on the development server only", () => {
    expect(developmentParty("?party=4", true)?.size).toBe(4);
    expect(developmentParty("?party=4", true)?.members).toHaveLength(3);
    expect(developmentParty("?party=4", false)).toBeNull();
    expect(developmentParty("?party=1", true)).toBeNull();
    expect(developmentParty("?party=99", true)).toBeNull();
    expect(developmentParty("", true)).toBeNull();
});
