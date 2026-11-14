// What Ace tells Oncyber when a match ends (docs/games/results.md). Pure, so
// the tests can run it: the report for `results.report()` from a finished
// match against the CPU.

/**
 * `match` is the rules' match state (games, winner); player 0 is the
 * visitor and player 1 the CPU opponent `foe` at `difficulty`.
 */
export function cpuMatchReport({ match, name, selfId, foe, difficulty }) {
    return {
        format: "cpu",
        teams: [
            {
                score: match.games[0],
                players: [
                    { id: selfId || "self", name: name || "You", kind: "self" },
                ],
            },
            {
                score: match.games[1],
                players: [{ id: `cpu-${difficulty}`, name: foe, kind: "cpu" }],
            },
        ],
        winner: match.winner,
    };
}
