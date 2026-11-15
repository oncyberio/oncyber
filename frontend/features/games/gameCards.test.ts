import { GAMES, findGame } from "./catalog";
import { gameCards, playersLabel } from "./gameCards";

const MINE = "trip_0123456789abcdef";

describe("game cards", () => {
    it("builds a card from each game's listing", () => {
        const cards = gameCards();
        expect(cards.map((card) => card.id).sort()).toEqual(
            Object.keys(GAMES)
                .map((id) => `game-${id}`)
                .sort()
        );
        const ace = cards.find((card) => card.id === "game-ace");
        expect(ace).toMatchObject({
            href: "/games/ace",
            description: GAMES.ace.description,
            imageUrls: [GAMES.ace.thumbnail],
            destinationStatus: "Local preview",
        });
        expect(ace.buildStatus).toContain("1 to 8 players");
        expect(ace.tags).toEqual(expect.arrayContaining(["game", "sports"]));
    });

    it("searches titles, taglines and tags", () => {
        expect(gameCards("tennis").map((card) => card.id)).toEqual([
            "game-ace",
        ]);
        expect(gameCards("cozy").map((card) => card.id)).toEqual([
            "game-garden",
        ]);
        expect(gameCards("no such thing")).toEqual([]);
    });

    it("says who is playing and leads with the visitor's own party", () => {
        const presence = {
            ace: {
                playing: 5,
                parties: [
                    { id: "trip_fedcba9876543210", playing: 2 },
                    { id: MINE, playing: 3 },
                ],
            },
        };
        const cards = gameCards("tennis", presence, [MINE]);
        expect(cards.map((card) => card.id)).toEqual([
            "game-ace-party",
            "game-ace",
        ]);
        expect(cards[0]).toMatchObject({
            href: `/games/ace?join=${MINE}`,
            actionLabel: "Join your party in ACE! Tennis",
            buildStatus: "3 in your party · join them",
        });
        expect(cards[1].destinationStatus).toBe("5 playing now");
        // Someone else's party is counted but never linked.
        expect(gameCards("tennis", presence, [])).toHaveLength(1);
    });

    it("labels player counts", () => {
        expect(playersLabel({ min: 1, max: 1 })).toBe("1 player");
        expect(playersLabel({ min: 2, max: 2 })).toBe("2 players");
        expect(playersLabel({ min: 1, max: 8 })).toBe("1 to 8 players");
    });

    it("keeps the generated catalog's page fields", () => {
        expect(findGame("garden")).toMatchObject({
            room: "oncyber-bloom-garden-v1",
            relay: true,
            crowdLabel: "in the garden",
            controlsStyle: { top: 14, left: "auto", right: 16 },
        });
        // Every game runs on the shared page.
        expect(findGame("padel")).toMatchObject({
            room: "oncyber-padel-club-v2",
            relay: false,
            crowdLabel: "at the club",
        });
        expect(findGame("padel").ownPage).toBeUndefined();
        expect(findGame("ace").room).toBeNull();
    });
});
