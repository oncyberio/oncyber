/**
 * The party a visitor arrived with, as a game sees it. A lobby group that
 * travels together shares one trip id (the cohort); the lobby also hands over
 * the members it was showing. Games use this to offer formats (1 v 1, 2 v 2,
 * a bracket) and the page uses the cohort to put the party in a room of its
 * own. A hint for matchmaking, never proof of who someone is: the room's
 * roster says who actually arrived.
 */
export interface GamePartyMember {
    id: string;
    name: string;
    pfp: string;
    avatarUrl: string;
}
export interface GameParty {
    /** Same for every member of this trip; names the party's room. */
    id: string;
    /** Members including the visitor, at most eight. */
    size: number;
    /** The other members the lobby showed on the way in. */
    members: GamePartyMember[];
    /**
     * Arrived by a join link after the party (gamePartyJoin.ts): nobody is
     * listed, and the room's roster says who is there.
     */
    late?: boolean;
}

const COHORT = /^[A-Za-z0-9_-]{16,80}$/;
const MAX_OTHERS = 7;

const text = (value: unknown, max: number) =>
    typeof value === "string" ? value.trim().slice(0, max) : "";
function asset(value: unknown) {
    if (typeof value !== "string" || !value || value.length > 2048) return "";
    if (value.startsWith("/") && !value.startsWith("//")) return value;
    try {
        const url = new URL(value);
        return /^https?:$/.test(url.protocol) && !url.username && !url.password
            ? value
            : "";
    } catch {
        return "";
    }
}

/** Members from the lobby's travel view (`peers`); malformed entries drop out. */
export function readPartyMembers(peers: unknown): GamePartyMember[] {
    if (!Array.isArray(peers)) return [];
    const seen = new Set<string>();
    const members: GamePartyMember[] = [];
    for (const peer of peers.slice(0, MAX_OTHERS)) {
        const id = text(peer?.id, 64);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        members.push({
            id,
            name: text(peer?.name, 24) || "Player",
            pfp: asset(peer?.avatar),
            avatarUrl: asset(peer?.vrmUrl),
        });
    }
    return members;
}

/** Null when the visitor came alone. */
export function gameParty(cohort: unknown, peers?: unknown): GameParty | null {
    if (typeof cohort !== "string" || !COHORT.test(cohort)) return null;
    const members = readPartyMembers(peers);
    return { id: cohort, size: members.length + 1, members };
}

/** The party's own room for a game: only this trip's members know its name. */
export function partyRoomLabel(gameId: string, cohort: string) {
    return `oncyber-${gameId}-party-${cohort}`;
}

/**
 * Development only: `?party=4` on a game page stands in for arriving with a
 * party of four, so formats can be tried without four accounts.
 */
export function developmentParty(
    search: string,
    development = process.env.NODE_ENV === "development"
): GameParty | null {
    if (!development) return null;
    const size = Number(new URLSearchParams(search).get("party"));
    if (!Number.isInteger(size) || size < 2 || size > 8) return null;
    return {
        id: `dev-party-${size}-preview`,
        size,
        members: Array.from({ length: size - 1 }, (_, index) => ({
            id: `dev-${index + 2}`,
            name: `Player ${index + 2}`,
            pfp: "",
            avatarUrl: "",
        })),
    };
}
