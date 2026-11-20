// What a finished mini-game match (a race or a bout) tells Oncyber
// (docs/games/results.md). Pure, so the tests can run it. The players are
// the bloomlings that entered; the visitor's own bloomling is `self`.

/** A match id the result rules accept, from the match's shared id. */
export function resultMatchId(id) {
    return `garden-${String(id).replace(/[^A-Za-z0-9_-]/g, "")}`.slice(0, 64);
}

/**
 * `match` is the mini-game's match (`kind`, `entrants`, `result`); `mine`
 * is the index of the visitor's entrant. Returns the report for
 * `results.report()`, or null when the visitor only watched.
 */
export function matchReport(match, mine) {
    const { entrants, result, kind } = match;
    if (!(mine >= 0) || !entrants[mine] || !result) return null;
    const race = kind === "race";
    const winner = race
        ? result.places.findIndex((place) => place === 1)
        : result.winner;
    return {
        format: race ? "race" : "bout",
        teams: entrants.map((e, i) => ({
            // A race scores by place: first of four gets 4, last gets 1.
            score: race
                ? Math.max(
                      0,
                      entrants.length +
                          1 -
                          (result.places[i] || entrants.length + 1)
                  )
                : i === result.winner
                ? 1
                : 0,
            players: [
                {
                    id: e.c,
                    name: e.n,
                    kind: i === mine ? "self" : e.cpu ? "cpu" : "peer",
                },
            ],
        })),
        winner: winner >= 0 && winner < entrants.length ? winner : null,
    };
}
