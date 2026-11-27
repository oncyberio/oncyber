# Match results

**Rule: every finished match reports exactly one result.** Not zero, not
two, and nothing for a match that was left before it ended.

A result says who played, on which sides, the score, who won, what was
played and how long it took. The page validates it, records it for a
signed-in visitor, shows a short card, and passes a one-line summary to the
visitor's party. A result is one browser's word: it is stored and shown as
**unverified**, unless it is a match between members of a party and every
player's page reported the same outcome: that one is **agreed by the
party**, and only those count for the leaderboard ([trust.md](trust.md)).

## Report from a game

```js
import { createResults } from "@oncyber/game-runtime/results";

// `post` sends a page bridge message of kind `result`: `oncyber:game:result`
// from a contract game (connectPage's `page.post("result", { result })`),
// `<id>:result` from an older build.
const results = createResults((result) => page.post("result", { result }));

results.begin(); // when a match starts (pass a shared id if several browsers play it)
results.report({
    // once, when it ends
    format: "solo", // a party format's id (party.md) or the game's own: "solo", "singles", "race", ...
    teams: [
        // 2 to 8 sides; a solo player is a team of one
        { score: 2, players: [{ id: selfId, name: "Ada", kind: "self" }] },
        { score: 1, players: [{ id: "cpu-pro", name: "Rally", kind: "cpu" }] },
    ],
    winner: 0, // index into teams, or null for a draw
});
results.abandon(); // the match was left unfinished: report nothing
```

-   `begin()` starts the clock and makes the match id; `report()` adds
    both, so a game doesn't time matches itself. Pass `durationSeconds` to
    override.
-   `report()` throws when no match is open (`RESULT_NO_OPEN_MATCH`), which
    is what stops a second result for the same match, and when the result
    is invalid (`RESULT_TEAMS`, `RESULT_WINNER`, ...). Catch it where a
    failed report must not stop the game.
-   Exactly one player has `kind: "self"`: the visitor whose browser is
    reporting. Others are `"peer"` (another person) or `"cpu"`. Ids are the
    game's own (room ids from the party's roster, `trip.roster`, where it
    has them: every member's page then sees the same players), at most 64 characters, unique within the result. At most 16
    players; names are cut to 24 characters.
-   When several browsers play the same match, each reports it, with the
    same match id (`begin(sharedId)`), from its own visitor's side, and
    with the teams in the same order.
-   Put `results.inspect()` (`{ matchOpen, resultsSent }`) in the game's
    `inspect()` so scenarios can assert on it.
-   A lifecycle game declares the `results` capability and its host turns
    `services.call("results", "begin" | "report" | "abandon", value)` into
    the same three calls.

The rules live in one function, `readMatchResult` in
`games/runtime/src/results.ts`. The page applies the same rules
(`frontend/features/games/results/gameResults.ts`); both run against
`games/runtime/test/results.fixtures.json`, so change the three together.

Two games report today. Ace reports each match against the CPU (format
`solo`) and each 1 v 1 between two party members (format `singles`, the
shared party formats' ids): `games/ace/src/result.js`, through the
`results` capability. In a 1 v 1 the member running the match makes its id
and sends it with the match's `start`; both browsers report under it, with
both players by their roster room ids in id order, whoever ran the engine
at the end and even when the CPU finished one side. A match left before it
ends, and a match only watched, report nothing. Bloom Garden reports each race and bout a
visitor's bloomling entered (`games/garden/src/game/result.js`), through
the `results` capability; a visitor who only watched reports nothing.

## What the page does

| From | Kind            | Meaning                                                                                                                              |
| ---- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| game | `result`        | `{ result }`: a finished match.                                                                                                      |
| page | `result-status` | `{ match, status, reason }`: `recorded`, `unrecorded` (signed out, a repeat, storage failed) or `rejected` (invalid or a duplicate). |

`useGameResults` (`frontend/features/games/results/useGameResults.tsx`) takes one
valid result per match id and at most 200 per visit. For a signed-in
visitor it calls the `games` RPC (`frontend/pages/api/_v2/games/`):

-   `reportResult({ game, result })` needs a session. It writes only under
    the caller's account: one match record and that account's standing.
    The same match again changes nothing, and results less than five
    seconds apart are refused. Other players in a result are stored as
    text and credit no account.
-   `leaderboard({ game })` is public: the top ten standings by wins, as
    `{ name, played, wins, verified }`, counting only results the whole
    party agreed on (below). A match against the CPU is kept and never
    ranked.

**Agreed results.** A match between members of a party is reported by each
player's page under the same match id. The page sends its outcome with the
summary through the party's room and compares it with what the other
players' pages sent (`judgeMatchResult` in `gameResults.ts`, on
`resultTrust.ts`; rules in [trust.md](trust.md)). When every player
reported the same outcome the result is recorded as `party-agreed` and its
card says "agreed by your party"; anything else, and every solo match, is
`solo-unverified`. The page waits up to five seconds for the other reports
before recording, so `result-status` for such a match can take that long.

Both answer only where game pages do (development, or `GAMES_PREVIEW=1`).

Firestore, per game:

| Document                                    | Fields                                                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `gameResults/<game>/matches/<user>_<match>` | the result, plus `game`, `reporter`, `outcome` (`win`, `loss`, `draw`), `verified: false`, `trust`, `source: "browser"`, `createdAt` |
| `gameResults/<game>/standings/<user>`       | `userId`, `game`, `name`, `played`, `wins`, `rankedPlayed`, `rankedWins` (agreed results only), `verified: false`, `updatedAt`       |

A guest's result is shown but not kept. The card ("Ada beat Rally · 2 – 1",
then the game's top players) shows for nine seconds; the visitor appears
under the name the page knows them by, not the game's own label. In a party the page
sends the summary through the party's room, so every member's page shows
it; that packet goes page to page and is never handed to a game.

## The check

`pnpm games:check <id>` records every `result` the game posts and fails
when one is invalid or a match is reported twice. Say in `game.json` how
the check run finishes a match, and it also requires exactly one result:

```json
"results": { "match": "autoplay&games=1&difficulty=rookie&slow=3", "timeoutSeconds": 240 }
```

`match` is added to the game's URL so its own bot plays one match to the
end (Ace). That match gets a visit of its own after the scenario's
(`?check=results&<match>`, straight in, alone; the game's host skips its
scenario for it, as for `?check=avatars`), and whatever the scenario's
visit posted counts too: it must post nothing. A lifecycle game whose `scenario.json` plays a match to the end
writes `"results": { "scenario": true }` instead; `"results": true` means
the game reports results but the check run finishes no match. The stage is
`scripts/games/results-stage.mjs` (in `run.stages` after departure; a
failure is a `RESULTS` finding); what it saw is in `check.json` under
`results`. The check page answers `result-status` in the form the game
spoke.

## Not built yet

-   Server-side verification: the pages of a match compare their reports
    and the server takes the reporting page's verdict; it does not yet
    compare the members' stored records itself ([trust.md](trust.md)).
-   A leaderboard outside the result card (a page or a lobby panel).
-   Results for guests.
