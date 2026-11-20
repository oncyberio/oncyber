// What Padel tells Oncyber when a match ends (docs/games/results.md). Pure,
// so the tests can run it. A match is the visitor and an NPC partner against
// two NPCs: one side "self" plus a "cpu", the other two "cpu".

/**
 * `score` and `winner` are the simulation's (team 0 is the visitor's).
 * `npcs` are the partner and the two opponents, in that order.
 */
export function doublesReport({
    format,
    score,
    winner,
    name,
    selfId,
    npcs,
    difficulty,
}) {
    const [partner, ...rivals] = npcs;
    const cpu = (npc) => ({
        id: `npc-${npc.toLowerCase()}-${difficulty}`,
        name: npc,
        kind: "cpu",
    });
    return {
        format,
        teams: [
            {
                score: score[0],
                players: [
                    { id: selfId || "self", name: name || "You", kind: "self" },
                    cpu(partner),
                ],
            },
            { score: score[1], players: rivals.map(cpu) },
        ],
        winner: winner === 0 || winner === 1 ? winner : null,
    };
}

/**
 * Exactly one result per match, for the game: a match opens when it starts,
 * closes with one report once it has a winner, and reports nothing when it
 * is left first. `call(operation, value)` is the host's `results` service
 * (begin, report, abandon) and returns a promise.
 */
export function createMatchResults(call) {
    let open = false;
    let sent = 0;
    const quiet = (promise, level = "warn") =>
        Promise.resolve(promise).catch((error) =>
            console[level]("[Padel] result not reported", error)
        );
    return {
        /** A match starts. */
        begin() {
            open = true;
            quiet(call("begin", { match: "" }));
        },
        /** The match was left, or restarted, before it ended. */
        abandon() {
            if (!open) return;
            open = false;
            quiet(call("abandon", null));
        },
        /**
         * Once per frame with the match: when the open match has a winner, send
         * `report()` (built only then) and close it.
         */
        settle(match, report) {
            if (!open || !match || match.winner === null) return false;
            open = false;
            // A failed report must not stop the game. The call is made now, so it
            // reaches the host before the next match's begin.
            quiet(
                new Promise((resolve) =>
                    resolve(call("report", report()))
                ).then(() => sent++),
                "error"
            );
            return true;
        },
        /** `results.inspect()` as the game sees it. */
        inspect: () => ({ matchOpen: open, resultsSent: sent }),
    };
}
