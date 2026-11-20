# Parties: people coming and going, and playing each other

For coding agents building or changing a game. The page side and the
lifecycle are in [../games.md](../games.md); this is what a game does about
the other people in its party.

## The rule

A game states, in `game.json`, what it offers a party of **1, 2, 3, 4 and
5 to 8**, and what **late**, **dropped** and **extra** players get. Every
size includes a **solo** option: no member ever waits on another to play.
`pnpm games:check <id>` reads the statement, then holds the game to it.

```json
"party": {
    "sizes": [1, 8],
    "formats": [
        { "id": "singles", "label": "1 v 1", "sizes": [2] },
        { "id": "doubles", "label": "2 v 2", "sizes": [4] },
        { "id": "tournament", "label": "Tournament", "sizes": [3, 4, 5, 6, 7, 8] },
        { "id": "solo", "label": "Solo vs CPU", "sizes": [1, 2, 3, 4, 5, 6, 7, 8] }
    ],
    "solo": "solo",
    "play": "singles",
    "late": "A member who arrives mid-match is offered Watch and Solo vs CPU.",
    "dropped": "The CPU takes their side; the match goes on with the score kept.",
    "extra": "A match seats two. Anyone else can watch or play solo."
}
```

-   `sizes` and `formats` are the contract's declaration
    ([contract.md](contract.md)): the options a party of each size is
    offered are the formats that list that size, in the order written,
    which is the order the game shows them. Every size from 1 to 8 needs
    one. `solo` names the option that needs nobody else; it must be
    offered at every size.
-   `late`, `dropped`, `extra`: one or two plain sentences each. Say what
    the player sees, not how it is built. If something isn't built, say so.
-   `play`: an option two members can start together. The check starts it
    and drops a member mid-match. Leave it out only if no option is played
    between members yet.
-   `shared`: for a game that is one activity for everyone whatever the
    count (Bloom Garden's island). Say why in a sentence; `formats` then
    offers the same option throughout and the check skips the live part.

Decide these before writing the multiplayer code. "What does the third
person see?" has an answer in every game that ships; the only choice is
whether you wrote it down.

## What the page gives a party

A lobby group that travels together lands in a room of its own. The game
gets one party message, the trip ([contract.md](contract.md)): in `enter()`
(`continuity.trip`) and again through `party(trip)` whenever it changes.
The roster is part of it, not a message of its own.

| In the trip       | What                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `members`         | Who the lobby said travelled together: a hint, there before anyone has arrived.                |
| `self`, `arrived` | The visitor's id in the party's room and the others there now (room ids).                      |
| `roster`          | Who is in the room, from the server: arrival order, host, seats, who dropped. Null until sent. |

And as `oncyber:game:<kind>` messages:

| Kind          | What                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------- |
| `match`       | A packet from another member on the real-time channel: `{ from, data }`.                  |
| `match-limit` | The page or the server dropped some of this game's packets: `{ dropped }`.                |
| `net`         | The slower relay (about five packets a second). Use it for turn state, never for a rally. |

`tripPlayers(trip, me)` lists the party with the roster's ids once there is
one. For the roster's events and the channel, use `createPartyLink` from
the runtime instead of reading these by hand. It reads the same trip (from
`enter` and `party`) and speaks the contract prefix; pass a game id only
for a build from before the contract:

```js
import { createPartyLink } from "@oncyber/game-runtime/partyLink";
import { assignSeats, matchAuthority } from "@oncyber/game-runtime/roster";
import { buildLineup, partyFormats } from "@oncyber/game-runtime/party";

const link = createPartyLink();
link.on("arrived", ({ member, late }) => late && offerWatch(member));
link.on("dropped", ({ member }) => cpuTakesOver(member.id));
link.on("returned", ({ member }) => giveSeatBack(member.id));
link.on("left", ({ member }) => forget(member.id));
link.on("host", ({ self }) => self && becomeHost());
link.on("offline", () => playOnAlone());
```

### Roster

`link.roster` is `{ self, host, online, members }`; each member is
`{ id, session, name, pfp, avatarUrl, seat, state, order }`.

-   **`id` is stable** for the visit, reconnects and page reloads included.
    Key scores, seats and draws by it. `session` is the member's current id
    in the room (what `peers` uses) and changes on a reconnect.
-   **Late**: `arrived` with `late: true` is anyone who came after you.
    The first roster lists who was already there (`late: false`).
-   **Dropped**: a lost connection makes a member `away`. The server holds
    their seat and place in the order for 20 seconds, then they are `left`.
    Coming back in time is `returned`, same `id`. Later than that they
    arrive again with the same `id` at the back of the order. Leaving on
    purpose is `left` at once.
-   **Host**: one member, the earliest arrival still here. When the host
    drops the role moves to the next member and stays there; the old host
    comes back as an ordinary member. Never assume you are still host:
    listen for `host`.
-   **Seats**: the room gives the first eight arrivals a `player` seat;
    later ones are `spectator` and can receive on the match channel but
    not send. A freed seat goes to the earliest spectator (`seat` event).
    For a game that plays fewer at a time, `assignSeats(roster, n)` gives
    `{ players, spectators }` the same way on every screen.
-   **Your own connection**: `offline` / `online`. While offline the game
    keeps its last roster. Do not freeze: play on alone, and sort out who
    has the truth when you are back.

### Formats and draws

`partyFormats(size)` returns the default menu for a party (1 v 1 for two,
teams or a tournament for four, a round robin for three, a knockout for
five to eight, solo always last). `oneVOne`, `teams`, `roundRobin`,
`knockout` and `buildLineup(format, players, seed)` make the draw. Pass the
party id as the seed and members' roster `id`s as players: every member
then builds the same bracket without sending it.

### The match channel

About thirty packets a second per member, relayed by the party's room to
the other members (or to one, with `to`). The server enforces, per sender:
32 packets a second with a burst of 16, and 1200 characters of JSON a
packet. What exceeds that is dropped and you are told (`match-limit`).

```js
link.channel.state(snapshot); // newest wins: a late snapshot is dropped
link.channel.event({ t: "hit" }); // each one arrives, in order
link.channel.pump(); // once per frame; sends at the channel's pace
link.on("match", ({ from, kind, data }) => { ... });
```

-   Send **state** as whole snapshots, small arrays of rounded numbers, not
    deltas: any one packet may be the only one that arrives this frame.
-   Send **events** for things that happen once (a point, a button press).
-   One member simulates (`matchAuthority(roster, playerIds)`), the others
    send input and draw what they receive. Do not run the simulation on
    two machines and hope they agree.
-   The channel is a WebSocket today: ordered, and it stalls briefly when
    a packet is lost. Design for a snapshot arriving late, not out of
    order.
-   Never trust a packet's contents: clamp numbers, check ids against the
    roster, ignore senders who aren't in your match.

## When someone goes mid-match

The game continues. Pick the smallest thing that keeps the others playing
and write it in `party.dropped`:

-   **A player drops**: a CPU takes their side, or their side forfeits the
    point, or the round goes on without them. Not a frozen screen and not
    "waiting for player".
-   **The member running the match drops**: another member takes it over
    from the last state they received. Listen for `dropped` on that
    member (and for silence: no packets for three seconds), not only for
    `host`.
-   **They come back**: the returning member asks; whoever kept the match
    going answers and keeps it. The returner never resumes its own copy.
-   **They reload the page**: same member `id`, a game that remembers
    nothing. Tell them their match is still on and offer their side back
    (Ace: "Rejoin your match").
-   **A tab is hidden**: it draws no frames. Treat it as a drop: say so on
    the channel (`channel.flush()` sends it at once) and ask to rejoin
    when shown. The game's pausing calls `away(true)` and `away(false)`
    for exactly this ([loading-and-pausing.md](loading-and-pausing.md)); the
    match is not suspended meanwhile.

Ace does all five in `games/ace/src/duel.js` (who runs the match) and
`games/ace/src/versus.js` (the snapshot); `games/ace/test/duel.test.js`
plays whole matches through an in-memory room and is a template for
testing your own.

## What the check does

`pnpm games:check <id>` runs the party stage after the others
(`scripts/games/party-check.mjs`) and fails the check when:

1. `game.json` has no `party` statement, a size from 1 to 8 has no format,
   a size has no solo option, or 2 and 4 are offered the same thing without
   `shared`.
2. The game, told it arrived with a party of 1, 2, 3, 4 and 6, reports
   options that differ from the statement, or the same options for 2 and 4.
3. With `play` set: two copies of the game pick it and no match starts;
   the match doesn't move; either copy breaks the channel's limits; or,
   after one member drops mid-match (first the guest, then the host), the
   other's match stops moving, or moves on still counting the dropped
   member as playing (they must be in `standIns` or out of `players`).

The game answers the check through the link:

```js
link.report(() => ({
    options: [
        { id: "singles", solo: false },
        { id: "solo", solo: true },
    ],
    phase: "menu", // "menu" | "match" | "results"
    match: null, // or { format, players, authority, role, progress, standIns }
}));
link.on("choose", (option) => start(option)); // only ever fires under ?check
```

`progress` is any number that grows only while the match is really being
played (Ace uses the simulation clock: its own when it runs the match, the
last snapshot's when it doesn't, so a guest that has lost the authority
stops counting). Under `?check` nobody is at the keyboard, so
the game must play the chosen option by itself.

Results land in `check.json` under `party`: the options seen per size, and
for each drop the packets a second each member sent, the largest packet,
and who ran the match afterwards. The packet rate there follows the
headless browser's frame rate (a few frames a second on a software
renderer), not the channel's: a game sends one state per frame up to
thirty a second.

On the development server, `/games/<id>?party=2` in two windows is a
party of two in a real room.

## Not built yet

-   Playing doubles and tournaments through in Ace: the draw is shown, only
    1 v 1 is played.
-   Datagrams: the channel rides the room's WebSocket. The shared lobby
    world has WebTransport; moving the channel there removes the stall on
    a lost packet. The game-side API would not change.
-   Guest-side prediction in Ace: the guest's own athlete moves when the
    authority's snapshot says so, about one round trip late.
