# Brief: TODO game name

<!--
Fill this in before writing any game code. `pnpm games:new <id>` copies it to
games/<id>/BRIEF.md. `pnpm games:check <id>` fails while a section is empty
or still says TODO, and holds the Inspect section against the running game.
Rules and the definition of done: docs/games/good-game.md.
Text inside comments like this one is guidance and is ignored by the check.
-->

## Game

<!-- One or two sentences: what the visitor does, and what makes a round end. -->

TODO

## Players

<!-- Who plays at once, and against whom. Say what one player alone plays:
     every game keeps a solo path. -->

TODO

## Formats

<!-- What you offer each party size. Copy the same five lines into
     game.json "party" (keys "1", "2", "3", "4", "5-8"). -->

-   1 player: TODO
-   2 players: TODO
-   3 players: TODO
-   4 players: TODO
-   5 to 8 players: TODO

## Arrival

<!-- Where a visitor from the lobby stands and what they can walk to, how
     they choose to start ("start the game" is a choice, never automatic),
     and where leaving a match puts them (back here). Title screens are for
     direct visits only. -->

TODO

## Devices

<!-- Keyboard, touch and gamepad: which input each action uses (they are
     declared in game.json "input"), and anything that differs on a phone. -->

TODO

## Inspect

<!-- The facts inspect() exposes, each in backticks. Always `screen`
     ("title", "arrival", "menu", "match" or "results"), `position` ([x, z]
     in metres) and `arrival` (from describeArrival). Add what a check needs
     to know the game works: the score, the phase, who won. -->

TODO

## Bot

<!-- How bot.json plays one match through declared input: which actions it
     presses to walk, to start, to play and to leave, and how long a match
     takes. -->

TODO
