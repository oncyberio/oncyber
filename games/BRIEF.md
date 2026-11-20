# Brief: TODO game name

<!--
Fill this in before writing any game code. `pnpm games:new <id>` copies it to
games/<id>/BRIEF.md. `pnpm games:check <id>` fails while a section is empty
or still says TODO, and holds the Inspect section against the running game.
Rules and the definition of done: docs/games/good-game.md.
Text inside comments like this one is guidance and is ignored by the check.
-->

## Game

<!-- One or two sentences: what the visitor does, and what makes a round end.
     A game with matches sets "format": "match" in game.json; a world you
     only walk sets "format": "world". -->

TODO

## Players

<!-- Who plays at once, and against whom. Say what one player alone plays:
     every game keeps a solo path. The page puts a party in a room of its
     own; the game reads who is there from the trip (enter()'s
     continuity.trip, then party(trip)): its roster, the host, who dropped.
     Members play each other over the match channel (createPartyLink).
     docs/games/party.md. -->

TODO

## Formats

<!-- What you offer a party of 1, 2, 3, 4 and 5 to 8, and what late, dropped
     and extra players get. Write the same in game.json "party": "formats"
     ([{ id, label, sizes }], every size from 1 to 8 covered), "solo" (the
     format that needs nobody else, offered at every size), "play" (one two
     members start together), and a sentence each for "late", "dropped" and
     "extra". docs/games/party.md. -->

-   1 player: TODO
-   2 players: TODO
-   3 players: TODO
-   4 players: TODO
-   5 to 8 players: TODO
-   Late, dropped and extra players: TODO

## Arrival

<!-- Where a visitor from the lobby stands and what they can walk to, how
     they choose to start ("start the game" is a choice, never automatic),
     and where leaving a match puts them (back here). The lobby's last view
     arrives in enter() (continuity.arrival: { from: "lobby", view }); a
     direct visit ({ from: "direct" }) is the only one that sees a title
     screen. game.json says "arrival": { "walkable": true }.
     docs/games/contract.md, docs/games/locomotion.md. -->

TODO

## Devices

<!-- The devices game.json "devices" claims (desktop, phone, gamepad) and,
     for each action in "runtime.input", its keyboard, touch and gamepad
     binding. Escape, Enter, NumpadEnter and M are the page's: bind none of
     them. Say where the HUD sits: inside the page's safe areas
     (--oncyber-safe-*), on a phone too. docs/games/keys-focus.md,
     docs/games/devices.md, docs/games/safe-area.md. -->

TODO

## Kits

<!-- Which kits the game uses, or why not: the avatar kit (other people as
     their Oncyber avatars, the arrival pose), the locomotion kit (walk, run
     and jump as in the lobby, the arrival camera) and the UI kit (menus).
     docs/games/avatar-kit.md, docs/games/locomotion.md, docs/games/ui-kit.md. -->

TODO

## Sound and pausing

<!-- All sound goes through the SDK's one output (connectGameAudio); the
     page owns volume and mute. One pause path (sessionPausing): say what
     suspends alone (a hidden tab, the page's menu, typing) and that a match
     between people never does. docs/games/sound.md,
     docs/games/loading-and-pausing.md. -->

TODO

## Leaving and results

<!-- Where a finished or abandoned match returns to (the arrival), how the
     visitor leaves for the lobby (through the departure, from the arrival
     state), and what one finished match reports: exactly one result.
     docs/games/departure.md, docs/games/results.md. -->

TODO

## Saved data

<!-- The keys the game saves, each with its scope (visitor, party, game),
     declared in game.json "saved"; or "Nothing". Never sound settings or
     results. docs/games/saved-data.md. -->

TODO

## Inspect

<!-- The facts the game's host hands exposeInspect(), each in backticks.
     Always `screen` ("title", "arrival", "menu", "match" or "results"),
     `position` ([x, z] in metres) and `arrival` (from describeArrival).
     Add what a check needs to know the game works: the score, the phase,
     who won. -->

TODO

## Bot

<!-- How bot.json plays one match through declared input: which actions it
     presses to walk, to start, to play and to leave, and how long a match
     takes. scenario.json is the other half: the lifecycle scenario the
     contract check plays frame by frame. -->

TODO
