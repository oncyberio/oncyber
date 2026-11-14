import {
    joinedParty,
    partyJoinHref,
    rememberGameParty,
    rememberedGameParties,
} from "./gamePartyJoin";
import { partyRoomLabel } from "./gameParty";

const PARTY = "trip_0123456789abcdef";
const memory = () => {
    const values = new Map<string, string>();
    return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => void values.set(key, value),
    };
};

describe("party join links", () => {
    it("round-trips a party id through the link", () => {
        const href = partyJoinHref("ace", PARTY);
        expect(href).toBe(`/games/ace?join=${PARTY}`);
        const party = joinedParty(new URL(href, "https://x").search);
        expect(party).toEqual({ id: PARTY, size: 1, members: [], late: true });
        // The late arrival lands in the room the party is already in.
        expect(partyRoomLabel("ace", party.id)).toBe(
            `oncyber-ace-party-${PARTY}`
        );
    });

    it("refuses ids that could not name a party room", () => {
        expect(() => partyJoinHref("ace", "short")).toThrow();
        expect(() => partyJoinHref("ace", `${PARTY}/../x`)).toThrow();
        expect(joinedParty("?join=short")).toBeNull();
        expect(joinedParty("?join=has%20spaces%20in%20the%20id")).toBeNull();
        expect(joinedParty("")).toBeNull();
    });

    it("remembers a party per game for two hours", () => {
        const store = memory();
        rememberGameParty("ace", PARTY, store, 1000);
        rememberGameParty("garden", "another_party_0001", store, 2000);
        rememberGameParty("ace", "not a party id", store, 3000);
        expect(rememberedGameParties(store, 5000)).toEqual([
            PARTY,
            "another_party_0001",
        ]);
        expect(rememberedGameParties(store, 1000 + 2 * 3600_000)).toEqual([
            "another_party_0001",
        ]);
    });

    it("reads nothing from malformed or missing storage", () => {
        const store = memory();
        store.setItem("oncyber:games:party", "{not json");
        expect(rememberedGameParties(store)).toEqual([]);
        expect(rememberedGameParties(null)).toEqual([]);
    });
});
