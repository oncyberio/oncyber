import type { GameParty } from "./gameParty";

/**
 * Joining a party that is already in a game. A party plays in a room named
 * after its trip id (`partyRoomLabel`), so a link that carries the id is all
 * a late arrival needs: `/games/<id>?join=<party id>`. Like the trip id
 * itself, the id is a matchmaking hint, never proof of who someone is; the
 * room's roster says who is there.
 */
export const GAME_PARTY_JOIN_PARAM = "join";

const PARTY_ID = /^[A-Za-z0-9_-]{16,80}$/;
const REMEMBERED = "oncyber:games:party";
/** A party is worth offering again for this long after the visitor left it. */
const REMEMBER_MS = 2 * 60 * 60 * 1000;

export const isPartyId = (value: unknown): value is string =>
    typeof value === "string" && PARTY_ID.test(value);

/** The link a late arrival opens to land in the party's room. */
export function partyJoinHref(gameId: string, partyId: string): string {
    if (!isPartyId(partyId)) throw new Error("Invalid party id.");
    return `/games/${encodeURIComponent(
        gameId
    )}?${GAME_PARTY_JOIN_PARAM}=${partyId}`;
}

/**
 * The party a join link names, or null. Its members are unknown to a late
 * arrival (`late: true`, nobody listed): the game reads them from the room's
 * roster (`self` and `peers`) like every other member does once connected.
 */
export function joinedParty(search: string): GameParty | null {
    const id = new URLSearchParams(search).get(GAME_PARTY_JOIN_PARAM);
    return isPartyId(id) ? { id, size: 1, members: [], late: true } : null;
}

type Store = Pick<Storage, "getItem" | "setItem">;
const tabStore = (): Store | null => {
    try {
        return typeof window === "undefined" ? null : window.sessionStorage;
    } catch {
        return null;
    }
};

/**
 * Remember, for this tab, the party the visitor is playing with, so the
 * lobby can offer the way back in if they drop out of the game.
 */
export function rememberGameParty(
    gameId: string,
    partyId: string,
    store: Store | null = tabStore(),
    now = Date.now()
) {
    if (!store || !isPartyId(partyId)) return;
    try {
        const all = readAll(store, now);
        all[gameId] = { id: partyId, at: now };
        store.setItem(REMEMBERED, JSON.stringify(all));
    } catch {
        // Storage is full or blocked; the link in the group still works.
    }
}

function readAll(store: Store, now: number) {
    const all: Record<string, { id: string; at: number }> = {};
    try {
        const saved = JSON.parse(store.getItem(REMEMBERED) || "{}");
        for (const [game, entry] of Object.entries<any>(saved ?? {}))
            if (
                isPartyId(entry?.id) &&
                Number.isFinite(entry.at) &&
                now - entry.at >= 0 &&
                now - entry.at < REMEMBER_MS
            )
                all[game] = { id: entry.id, at: entry.at };
    } catch {
        // Malformed: nothing remembered.
    }
    return all;
}

/** Party ids this tab played with recently, any game. */
export function rememberedGameParties(
    store: Store | null = tabStore(),
    now = Date.now()
): string[] {
    return store
        ? Object.values(readAll(store, now)).map((entry) => entry.id)
        : [];
}
