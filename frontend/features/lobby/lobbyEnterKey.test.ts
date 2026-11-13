import { enterKeyTarget } from "./lobbyEnterKey";

const lobby = {
    entered: false,
    travelling: false,
    worldReady: false,
    partyChatOverSpace: false,
};

describe("enterKeyTarget", () => {
    it("follows the visible chat through lobby, space, lobby", () => {
        const trip = [
            lobby,
            { ...lobby, travelling: true },
            { ...lobby, entered: true },
            { ...lobby, travelling: true },
            lobby,
        ];
        expect(trip.map(enterKeyTarget)).toEqual([
            "lobby-chat",
            null,
            "space-chat",
            null,
            "lobby-chat",
        ]);
    });

    it("goes to the party chat while it covers the space's chat", () => {
        expect(
            enterKeyTarget({
                ...lobby,
                entered: true,
                partyChatOverSpace: true,
            })
        ).toBe("party-chat");
        // Leftover party state must not follow the visitor back to the lobby.
        expect(enterKeyTarget({ ...lobby, partyChatOverSpace: true })).toBe(
            "lobby-chat"
        );
    });

    it("enters a prepared world from the lobby only", () => {
        expect(enterKeyTarget({ ...lobby, worldReady: true })).toBe(
            "enter-world"
        );
        expect(
            enterKeyTarget({ ...lobby, worldReady: true, entered: true })
        ).toBe("space-chat");
    });
});
