/**
 * What a party can play, and who meets whom. Pure rules with no renderer:
 * the page tells a game who arrived together, and these decide the formats
 * on offer and the draw. Every draw is seeded (the party id) and starts from
 * the players sorted by id, so each member builds the same bracket.
 */

export interface PartyPlayer {
    id: string;
    name: string;
}
/** A player, a team, or a place held for the winner of an earlier match. */
export type PartySide = PartyPlayer | PartyPlayer[] | { winnerOf: string };
export interface PartyRound {
    name: string;
    matches: [PartySide, PartySide][];
}
export interface PartyLineup {
    format: string;
    teams?: PartyPlayer[][];
    rounds: PartyRound[];
}
export interface PartyFormat {
    id: "solo" | "singles" | "doubles" | "tournament";
    label: string;
    blurb: string;
    /** True for the option one member can play without the others. */
    solo: boolean;
}

export const PARTY_MAX = 8;

/**
 * Formats for a party of `size` (the visitor included), best first. The
 * last is always a solo option: a member must never be stuck waiting on
 * the others.
 */
export function partyFormats(
    size: number,
    solo: { label?: string; blurb?: string } = {}
): PartyFormat[] {
    const n = Math.max(1, Math.min(PARTY_MAX, Math.floor(size) || 1));
    const formats: PartyFormat[] = [];
    if (n === 2)
        formats.push({
            id: "singles",
            label: "1 v 1",
            blurb: "One match between the two of you.",
            solo: false,
        });
    if (n === 4)
        formats.push({
            id: "doubles",
            label: "2 v 2",
            blurb: "Two teams of two, one match.",
            solo: false,
        });
    if (n >= 3)
        formats.push({
            id: "tournament",
            label: "Tournament",
            blurb:
                n === 3
                    ? "Everyone plays everyone; most wins takes it."
                    : n === 4
                    ? "Two semi-finals, then the final."
                    : "1 v 1 knockout down to a final.",
            solo: false,
        });
    formats.push({
        id: "solo",
        label: solo.label ?? (n > 1 ? "Solo" : "Play"),
        blurb: solo.blurb ?? "Play on your own.",
        solo: true,
    });
    return formats;
}

/** Deterministic shuffle: same players and seed, same order, on every screen. */
export function seededDraw<T extends { id: string }>(
    players: readonly T[],
    seed: string | number = ""
): T[] {
    let h = 2166136261;
    for (const ch of String(seed))
        h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const rand = () => {
        h = Math.imul(h ^ (h >>> 15), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
    const out = [...players].sort((a, b) =>
        a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    );
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/** One match between two players. */
export function oneVOne(
    players: readonly PartyPlayer[],
    seed: string | number = ""
): PartyLineup | null {
    const draw = seededDraw(players, seed);
    if (draw.length !== 2) return null;
    return {
        format: "singles",
        rounds: [{ name: "Match", matches: [[draw[0], draw[1]]] }],
    };
}

/** Two teams of `teamSize`, one match. */
export function teams(
    players: readonly PartyPlayer[],
    seed: string | number = "",
    teamSize = 2
): PartyLineup | null {
    const draw = seededDraw(players, seed);
    if (teamSize < 1 || draw.length !== teamSize * 2) return null;
    const sides = [draw.slice(0, teamSize), draw.slice(teamSize)];
    return {
        format: "doubles",
        teams: sides,
        rounds: [{ name: "Match", matches: [[sides[0], sides[1]]] }],
    };
}

/** Everyone plays everyone once, one match at a time. */
export function roundRobin(
    players: readonly PartyPlayer[],
    seed: string | number = ""
): PartyLineup | null {
    const draw = seededDraw(players, seed);
    if (draw.length < 3) return null;
    // The circle method: fix the first seat and rotate the rest, so nobody
    // plays twice in a row more often than the count forces.
    const seats: (PartyPlayer | null)[] =
        draw.length % 2 ? [...draw, null] : [...draw];
    const pairs: [PartyPlayer, PartyPlayer][] = [];
    for (let round = 0; round < seats.length - 1; round++) {
        for (let i = 0; i < seats.length / 2; i++) {
            const a = seats[i];
            const b = seats[seats.length - 1 - i];
            if (a && b) pairs.push([a, b]);
        }
        seats.splice(1, 0, seats.pop()!);
    }
    return {
        format: "tournament",
        rounds: pairs.map((match, i) => ({
            name: `Match ${i + 1}`,
            matches: [match],
        })),
    };
}

/** Single elimination; with an odd count the first drawn gets a bye. */
export function knockout(
    players: readonly PartyPlayer[],
    seed: string | number = ""
): PartyLineup | null {
    const draw = seededDraw(players, seed);
    if (draw.length < 2) return null;
    const rounds: PartyRound[] = [];
    let sides: PartySide[] = [...draw];
    while (sides.length > 1) {
        const matches: [PartySide, PartySide][] = [];
        const next: PartySide[] = [];
        const byes = sides.length % 2;
        if (byes) next.push(sides[0]);
        for (let i = byes; i < sides.length; i += 2) {
            matches.push([sides[i], sides[i + 1]]);
            next.push({ winnerOf: `${rounds.length + 1}.${matches.length}` });
        }
        rounds.push({ name: "", matches });
        sides = next;
    }
    // Named from the end: the last round is always the final.
    rounds.forEach((round, i) => {
        const left = rounds.length - i;
        round.name =
            left === 1
                ? "Final"
                : left === 2
                ? "Semi-finals"
                : left === 3
                ? "Quarter-finals"
                : `Round ${i + 1}`;
    });
    return { format: "tournament", rounds };
}

/**
 * The draw for one of `partyFormats`' ids. `players` is everyone, the
 * visitor included; `seed` is the party id. Null when the format doesn't
 * fit the count (or is the solo option, which has no draw).
 */
export function buildLineup(
    format: string,
    players: readonly PartyPlayer[],
    seed: string | number = ""
): PartyLineup | null {
    if (format === "singles") return oneVOne(players, seed);
    if (format === "doubles") return teams(players, seed, 2);
    if (format === "tournament")
        return players.length === 3
            ? roundRobin(players, seed)
            : players.length >= 4
            ? knockout(players, seed)
            : null;
    return null;
}

/** "Ada", "Ada & Bo", or "Winner of semi-final 1". */
export function sideLabel(
    side: PartySide | null | undefined,
    rounds?: PartyRound[]
): string {
    if (Array.isArray(side)) return side.map((p) => p.name).join(" & ");
    if (side && "winnerOf" in side) {
        const [round, match] = side.winnerOf.split(".").map(Number);
        const name = rounds?.[round - 1]?.name ?? `round ${round}`;
        return `Winner of ${name.replace(/s$/, "").toLowerCase()} ${match}`;
    }
    return side?.name ?? "?";
}
