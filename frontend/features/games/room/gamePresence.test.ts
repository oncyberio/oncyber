import { joinableParty, playingLabel, readGamePresence } from "./gamePresence";

const GAMES = [
    { id: "garden", room: "oncyber-bloom-garden-v1" },
    { id: "ace", room: null },
];
// A game with no multiplayer of its own: its visitors share a social room.
const SOCIAL = [{ id: "ace", room: null, socialRoom: "oncyber-ace-social-v1" }];
const MINE = "trip_0123456789abcdef";
const THEIRS = "trip_fedcba9876543210";
const room = (spaceId: unknown, clients: unknown) => ({
    clients,
    metadata: { spaceId },
});

describe("game presence", () => {
    it("counts the shared room and every party room", () => {
        const presence = readGamePresence(
            [
                room("oncyber-bloom-garden-v1", 5),
                room("oncyber-bloom-garden-v1", 2),
                room(`oncyber-ace-party-${MINE}`, 3),
                room(`oncyber-ace-party-${THEIRS}`, 2),
                room(`oncyber-garden-party-${MINE}`, 1),
                room("oncyber-lobby-v1", 40),
            ],
            GAMES
        );
        expect(presence.garden).toEqual({
            playing: 8,
            parties: [{ id: MINE, playing: 1 }],
        });
        expect(presence.ace).toEqual({
            playing: 5,
            parties: [
                { id: MINE, playing: 3 },
                { id: THEIRS, playing: 2 },
            ],
        });
        expect(playingLabel(presence.ace)).toBe("5 playing now");
    });

    it("counts the social room of a game with no room of its own", () => {
        const presence = readGamePresence(
            [
                room("oncyber-ace-social-v1", 4),
                room(`oncyber-ace-party-${MINE}`, 2),
            ],
            SOCIAL
        );
        expect(presence.ace).toEqual({
            playing: 6,
            parties: [{ id: MINE, playing: 2 }],
        });
    });

    it("drops empty, malformed and look-alike rooms", () => {
        const presence = readGamePresence(
            [
                room("oncyber-ace-party-short", 2),
                room(`oncyber-ace-party-${MINE}`, 0),
                room(`oncyber-ace-party-${MINE}`, "many"),
                room(`oncyber-ace-partying-${MINE}`, 2),
                room(null, 2),
                null,
            ],
            GAMES
        );
        expect(presence.ace).toEqual({ playing: 0, parties: [] });
        expect(playingLabel(presence.ace)).toBe("");
        expect(readGamePresence("nope", GAMES).garden.playing).toBe(0);
    });

    it("offers only a party the visitor holds the id of", () => {
        const { ace } = readGamePresence(
            [
                room(`oncyber-ace-party-${THEIRS}`, 2),
                room(`oncyber-ace-party-${MINE}`, 3),
            ],
            GAMES
        );
        expect(joinableParty(ace, [MINE])).toEqual({ id: MINE, playing: 3 });
        expect(joinableParty(ace, [])).toBeNull();
        expect(joinableParty(ace, ["trip_someone_else_0000"])).toBeNull();
        expect(joinableParty(undefined, [MINE])).toBeNull();
    });
});
