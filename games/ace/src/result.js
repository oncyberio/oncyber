// What Ace tells Oncyber when a match ends (docs/games/results.md). Pure, so
// the tests can run it: the reports for `results.report()` from a finished
// match. The format ids are the party formats' (games/runtime/src/party.ts);
// the caller passes them in.

/**
 * A match against the CPU. `match` is the rules' match state (games,
 * winner); player 0 is the visitor and player 1 the CPU opponent `foe` at
 * `difficulty`. `selfId` is the visitor's room id when they are in one.
 */
export function cpuMatchReport({
    format,
    match,
    name,
    selfId,
    foe,
    difficulty,
}) {
    return {
        format,
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

/**
 * A 1 v 1 between two party members, as this side saw it end. `match` is
 * this screen's match state: side 0 is the visitor, whoever ran the
 * engine. `players` are the two room ids from the party's roster; the
 * teams go in id order, so both browsers report the same teams in the same
 * order and only `kind` differs. A side the CPU finished for is still that
 * member's.
 */
export function versusMatchReport({ format, match, players, selfId, nameOf }) {
    const side = (id) => (id === selfId ? 0 : 1);
    const order = [...players].sort();
    const winner = order.findIndex((id) => side(id) === match.winner);
    return {
        format,
        teams: order.map((id) => ({
            score: match.games[side(id)],
            players: [
                {
                    id,
                    name: nameOf(id) || "Player",
                    kind: id === selfId ? "self" : "peer",
                },
            ],
        })),
        winner: winner >= 0 ? winner : null,
    };
}

/**
 * Exactly one result per match, for the game: a match opens when it
 * starts, closes with one report once it has a winner, and reports nothing
 * when it is left first. `call(operation, value)` is the host's `results`
 * service (begin, report, abandon) and returns a promise.
 */
export function createMatchResults(call) {
    let open = false;
    let sent = 0;
    const quiet = (promise, level = "warn") =>
        Promise.resolve(promise).catch((error) =>
            console[level]("ACE: result not reported", error)
        );
    const reporter = {
        /** A match starts. `match` is the id both browsers of a 1 v 1 share; none for a solo match. */
        begin(match = "") {
            open = true;
            quiet(call("begin", { match: match || "" }));
        },
        /**
         * A 1 v 1 starts or changes hands (duel.js's `start` hook). A
         * player's match opens under the shared id; a change of hands
         * mid-match keeps it open; watching reports nothing.
         */
        versus({ role, resume }, match) {
            if (role === "watch") reporter.abandon();
            else if (!resume) reporter.begin(match);
        },
        /** The match was left before it ended. */
        abandon() {
            if (!open) return;
            open = false;
            quiet(call("abandon", null));
        },
        /**
         * Once per frame with the rules' match state: when the open match
         * has a winner, send `report()` (built only then) and close it.
         */
        settle(match, report) {
            if (!open || !match || match.winner === null) return false;
            open = false;
            // A failed report must not stop the game. The call is made
            // now, so it reaches the host before the next match's begin.
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
    return reporter;
}
