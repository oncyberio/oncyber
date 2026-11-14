// What a party can play. Pure rules: the page tells the game who arrived
// together (`ace:party`), and these decide the formats on offer and who
// meets whom. Renderer-free so the checks can run them.

/** Formats for a party of `size` (the visitor included), best first. */
export function partyFormats(size) {
    const n = Math.max(1, Math.min(8, Math.floor(size) || 1));
    const formats = [];
    if (n === 2)
        formats.push({ id: "singles", label: "1 v 1", blurb: "One match between the two of you." });
    if (n === 4)
        formats.push({ id: "doubles", label: "2 v 2", blurb: "Two teams of two, one match." });
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
        });
    formats.push({ id: "cpu", label: n > 1 ? "Solo vs CPU" : "Play match", blurb: "A match against the house." });
    return formats;
}

/** Deterministic shuffle so every member of a party builds the same lineup. */
function seeded(list, seed) {
    let h = 2166136261;
    for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const rand = () => {
        h = Math.imul(h ^ (h >>> 15), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
    const out = [...list].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/**
 * Who meets whom. `players` is [{ id, name }], the visitor included; `seed`
 * is the party id, so the draw is the same on every member's screen.
 * Returns { format, teams?, rounds: [{ name, matches: [[a, b]] }] } where a
 * side is a player, a team (array of two), or a label for a later winner.
 */
export function buildLineup(format, players, seed = "") {
    const draw = seeded(players, seed);
    if (format === "singles" && draw.length === 2)
        return { format, rounds: [{ name: "Match", matches: [[draw[0], draw[1]]] }] };
    if (format === "doubles" && draw.length === 4) {
        const teams = [draw.slice(0, 2), draw.slice(2, 4)];
        return { format, teams, rounds: [{ name: "Match", matches: [[teams[0], teams[1]]] }] };
    }
    if (format === "tournament" && draw.length === 3) {
        // Round robin: three matches, each pair once.
        return {
            format,
            rounds: [
                { name: "Match 1", matches: [[draw[0], draw[1]]] },
                { name: "Match 2", matches: [[draw[1], draw[2]]] },
                { name: "Match 3", matches: [[draw[0], draw[2]]] },
            ],
        };
    }
    if (format === "tournament" && draw.length >= 4) {
        // Single elimination; byes go to the first drawn when the count is odd.
        const rounds = [];
        let sides = draw.map((p) => p);
        while (sides.length > 1) {
            const matches = [];
            const next = [];
            const byes = sides.length % 2;
            if (byes) next.push(sides[0]);
            for (let i = byes; i < sides.length; i += 2) {
                matches.push([sides[i], sides[i + 1]]);
                next.push({ winnerOf: `${rounds.length + 1}.${matches.length}` });
            }
            rounds.push({ name: "", matches });
            sides = next;
        }
        // Label the rounds from the end: the last is always the final.
        rounds.forEach((round, i) => {
            const left = rounds.length - i;
            round.name = left === 1 ? "Final" : left === 2 ? "Semi-finals" : left === 3 ? "Quarter-finals" : `Round ${i + 1}`;
        });
        return { format, rounds };
    }
    return null;
}

/** "Ada", "Ada & Bo", or "Winner of semi-final 1". */
export function sideLabel(side, rounds) {
    if (Array.isArray(side)) return side.map((p) => p.name).join(" & ");
    if (side?.winnerOf) {
        const [round, match] = side.winnerOf.split(".").map(Number);
        const name = rounds?.[round - 1]?.name ?? `round ${round}`;
        return `Winner of ${name.replace(/s$/, "").toLowerCase()} ${match}`;
    }
    return side?.name ?? "?";
}
