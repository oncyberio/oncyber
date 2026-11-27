# Games: network and results

Two rules for anyone building a game, human or coding agent. Both are
enforced: the first by the browser and `pnpm games:check`, the second by
the page. Overview of games: [../games.md](../games.md).

## Rule 1: declare every host the game reaches

A game reaches its own files and the hosts listed in `network` in its
`game.json`. Nothing else loads.

```json
{
    "name": "ACE! Tennis",
    "network": ["cyber.mypinata.cloud"]
}
```

-   An entry is a host name: `cdn.example.com`, `*.example.com` (any
    subdomain, not `example.com` itself), optionally `:port`. No scheme, no
    path, no address, no bare `*`. At most 16.
-   Declared hosts are reached over `https` and `wss` only, for `fetch`,
    sockets, images, audio and video.
-   Code is never loaded from a declared host. Scripts, workers and frames
    come from the game's own files. No `eval`, no inline event handlers.
    WebAssembly is allowed. An inline `<script>` already in the build's
    HTML runs (it is recorded by its hash); one added at run time does not.
-   A game with no `network` list fails the check. Write `"network": []`
    for a game that reaches nothing outside its files.
-   Avatars and portraits come from the visitor, so their host may not be in
    your list. Treat a failed avatar or portrait load as normal and show a
    fallback. Don't widen the list to make one visitor's file load.

What a game gets through the page needs no host: saved data, results,
chat and voice, the party's roster and match channel, and its own files
(motion JSON, the kits' CSS and fonts, a UI frame) are all the page's or the
build's. Ace and Garden declare one host, `cyber.mypinata.cloud`: Oncyber's
avatar and portrait storage, which the game's frame fetches a vouched
avatar from itself.

Before adding a host, ask whether the file can ship in the build instead.
A host in the list is a server that sees every player's address and can
receive anything the game sends it.

### How it is enforced

| Where                                              | What happens                                                                                                                                                                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/features/games/publish/networkPolicy.js` | Reads the declaration and builds the game's `Content-Security-Policy`.                                                                                                                                                      |
| `frontend/public/game-builds/<id>/network.json`    | The declaration as published, written by the check. Part of the release: commit it with the build.                                                                                                                          |
| `frontend/next.config.js`                          | Serves the policy on every file under `/game-builds/<id>/`. A game with no `network.json`, or a malformed one, gets its own files only.                                                                                     |
| `scripts/games/networkCheck.mjs`                   | The check serves the build with the same policy and fails on `NETWORK_DECLARATION` (missing or malformed list), `NETWORK_UNDECLARED` (a request to a host not in the list) and `POLICY_BLOCKED` (eval, an injected script). |

A game loaded from a hosted release gets the same policy from the
release's host, built from the `network.json` inside the release; a host
that does not send it is never pointed at, and the check's hosted stage
runs the game under it ([releases.md](releases.md), "What a host must
send"). For a release on IPFS that host is the site's own releases route,
which reads the release from its gateway and adds the policy.

The policy covers the whole check, not only the scenario: every stage's
server serves the game's files with it and every browser a stage opens is
watched (`guard` and `patrol` in `networkCheck.mjs`), so the social, keys,
safe-area, devices, locomotion, avatar, party, saved-data and process
stages all run as the site would serve the game. A new stage with a server
or a browser of its own takes `network` and calls both.

`check.json` records `network.hosts` and `network.requested` (the declared
hosts the run actually used). Remove a host that is never requested, unless
it is the avatar host: the check hands the game a test avatar from its own
server, so a game that only loads visitors' avatars never requests it there.

Changing `network` in `game.json` changes nothing on the site until
`pnpm games:check <id>` (or `games:publish`) rewrites `network.json` and it
is committed.

## Rule 2: a result is a claim until someone else confirms it

A game computes its result in the player's browser, and the player controls
that browser. So every result has a trust level:

| Level             | Meaning                                              | On a leaderboard |
| ----------------- | ---------------------------------------------------- | ---------------- |
| `solo-unverified` | One client reported it.                              | no               |
| `party-agreed`    | Every member of the party reported the same outcome. | yes              |
| `server-judged`   | A server ran or replayed the match. Not built yet.   | yes              |

`frontend/features/games/results/resultTrust.ts` holds the comparison,
`judgePartyResult(members, reports)`, and `leaderboardEligible(trust)`.
It is pure: the page runs it now, and a server can run the same code on
what the pages submit.

The page runs it on every result ([results.md](results.md)). A match
between members of a party is reported by each player's browser under one
match id; each page passes its outcome (`resultOutcome`: the match, format,
each side's score and players by room id, the winner) through the party's
room, and `judgeMatchResult` compares them. The players must be members of
the room's roster by the ids the room gave them, and a report counts for
the member the room says sent it. The page waits up to five seconds for the
others, then records the result: `party-agreed` when every player's report
matched, `solo-unverified` otherwise (someone missing, a dispute, or a
match against the CPU). Only agreed results add to the standings the
leaderboard lists.

For a game's result to reach `party-agreed`:

-   Report the outcome as small plain JSON (at most 4096 characters, eight
    levels deep, finite numbers).
-   Make it the same on every member's client. Name players by their room
    id, never "me" or "opponent". Leave out anything local: timestamps,
    frame counts, this client's settings or latency.
-   Report once, when the match ends. A second, different report from the
    same member is a dispute.
-   Every member reports, losers included. One missing report leaves the
    result `solo-unverified`.

What the page does with it: members are the party room's roster, taken from
the room server, never from a game. Reports from anyone else are ignored.
Two reports that differ make the result `disputed` and name who differs.

What "agreed" does not mean: a whole party can agree on a match that never
happened. `party-agreed` says nobody who played disputes the result. Rank
it, but don't pay out on it; that needs `server-judged`.

Not built yet: the server recomputing the verdict. `reportResult` takes the
page's verdict (`agreedBy`, the players' room ids) and checks only that it
names exactly the people the result says played; it does not compare the
members' stored records. A client's own verdict is a hint, since a changed
client can send any value: before anything is paid out or ranked publicly,
the server must recompute it from every member's submission.
