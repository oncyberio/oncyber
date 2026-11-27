# Brief: ACE! Tennis

## Game

An arcade tennis match on one court. The visitor moves, times a shot as the
ball arrives and aims with the stick; a match is one to three games, and the
first to win them ends it. `game.json` sets `"format": "match"`.

## Players

One visitor plays a CPU opponent at three difficulties (rookie, pro, ace).
That solo match is always offered, whatever the party. Two members of a
party play each other 1 v 1 over the party's match channel; the room's
roster (from the trip) says who is there, who runs the match and who
dropped. Anyone else in the room watches the live match or plays the CPU.

## Formats

-   1 player: a match against the CPU, at three difficulties.
-   2 players: 1 v 1 between the two, or each plays the CPU.
-   3 players: a tournament draw, or solo against the CPU.
-   4 players: 2 v 2 doubles or a four-player tournament draw, or solo.
-   5 to 8 players: a tournament draw seeded by the party, or solo.
-   Late, dropped and extra players: a late member is offered Watch and
    Solo vs CPU; the CPU takes a dropped player's side with the score kept;
    a match seats two, everyone else watches or plays solo. Doubles and
    tournaments show the seeded draw; playing them through is not built yet.

## Arrival

A visitor from the lobby stands courtside behind the near baseline, facing
the lobby's camera with the court behind them, crouched and without a
racket, then stands and can walk, run and jump around the club. The view
comes from `enter()` (`continuity.arrival.view`) through the locomotion
kit's `arrival()`. "Play match" is a choice (J, the OK button, a gamepad's
A): it opens the party formats or the match setup. Leaving a match or its
result ("Title") returns to the same spot. The title screen with the logo
appears only on a direct visit.

## Devices

Desktop, phone and gamepad. Keyboard: WASD or arrows move, J or Space a
regular shot, K topspin, H a cut, U a lob, Space or J confirms, Backspace
goes back, P pauses; courtside Shift runs, Space jumps, G waves, B dances, V
sits. Touch: the runtime's stick, shot buttons, OK, Pause, Run and Jump, and
a drag to look. Gamepad: left stick or d-pad, face buttons, bumpers for a
drop shot, Start to pause. Escape, Enter and M are the page's. The HUD and
the controls sit inside the page's safe areas at every size.

## Kits

The avatar kit draws the visitor and the others in the room as their
Oncyber avatars and stages the arrival pose. The locomotion kit walks the
visitor courtside and frames the arrival. The party and setup sheets use
the UI kit; the title, pause and results menus are Ace's own.

## Sound and pausing

All sound goes through the runtime's one output; the page owns volume and
mute, and the game is lowered while someone in the room talks. One pause:
alone or against the CPU the game is suspended by a hidden tab, the page's
menu and typing; a match another person is playing goes on.

## Leaving and results

A finished or abandoned match returns courtside. The Lobby button leaves
through the departure: the game stages the visitor courtside in the arrival
framing and the page matches the lobby's first frame to it. Every finished
match reports exactly one result (solo, or singles under the id both sides
share); a match left early reports none.

## Saved data

`settings` (visitor): difficulty and match length. `format` (party, for the
trip): the format the party picked. `tally` (game, shared by everyone):
matches played at the club.

## Inspect

`screen`, `position`, `arrival` (while arriving), `phase` (the engine's
phase: serve, toss, rally, point, over), `games` (games won, "visitor-CPU",
while a match is on), `points`, `difficulty`, `length`, `standing`,
`walked`, `matchOpen` and `resultsSent`.

## Bot

`bot.json` plays a one-game match against the rookie CPU: it walks `up`,
presses `confirm` (its J binding, since Space jumps courtside) twice (Play
match, then the setup's Play), holds and lets go of `flat` about once a
second until the result, then `right` and `confirm` for "Title", which
returns courtside. `scenario.json` is the lifecycle scenario: a lobby
arrival with a party of four, frame by frame. A match takes one to five
minutes in headless Chromium.
