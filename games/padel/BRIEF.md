# Brief: Glasshouse · Padel

## Game

Doubles padel on one glass court, in a small club the visitor walks first.
The visitor moves, plays a control shot, a lob or a charged power shot as the
ball arrives, and aims where it lands. A match is one exhibition tiebreak:
first to seven points, win by two, capped at fifteen, and ends when a side
gets there. `game.json` sets `"format": "match"`.

## Players

One visitor plays with an NPC partner (Leo) against two NPCs (Noa and Mika),
at two difficulties (Practice, Club player). That match needs nobody else and
is always offered. There is no match between people yet: everyone else in
the room, a party included, shares the club, sees each other walk it as
their avatars, and plays their own match. The trip (`enter()`'s
`continuity.trip`, then `party(trip)`) is read for its size only; the match
channel is not used.

## Formats

-   1 player: doubles with an NPC partner against two NPCs.
-   2 players: each plays their own NPC doubles match; they share the club.
-   3 players: each plays their own NPC doubles match; they share the club.
-   4 players: each plays their own NPC doubles match; they share the club.
-   5 to 8 players: each plays their own NPC doubles match; they share the
    club.
-   Late, dropped and extra players: a late member arrives in the club and
    starts their own match when they like; a dropped member changes nothing
    for the others, since every match is local to its player; there are no
    seats to run out of. Doubles between party members is not built.

## Arrival

A visitor from the lobby stands outside the glass on the court's left side,
facing the lobby's camera with the court behind them, crouched and without a
racket, then stands and can walk, run and jump around the club, through the
four side doors and onto the court. The view comes from `enter()`
(`continuity.arrival.view`) through the locomotion kit's `arrival()`. "Play
padel" is a choice (J, the OK button, a gamepad's A, or the club card's
button): it opens the match setup, where "Play doubles" starts. Nothing
starts on its own. Leaving a match ("Explore the club" in the pause menu or
on the result) returns to the club, standing where the player stood. There
is no title screen: a direct visit lands in the same club, already standing.

## Devices

Desktop and gamepad. Keyboard: W A S D move, the arrow keys aim (and walk in
the club), J or Space a control shot, K a lob, hold F and release for power,
C changes the camera, P pauses, Space or J confirms, Backspace goes back; in
the club Shift runs, Space jumps, G waves, B dances, V sits. Gamepad: left
stick or d-pad moves, right stick aims, A hits and confirms, Y lobs, X or
the right bumper charges power, B goes back, Start pauses, Select changes
the camera, right trigger runs. Touch bindings are declared (the runtime's
stick, Hit, Lob, Power, OK, Pause, Run, Jump, and a drag to look) but the
phone is not claimed: aiming has no touch control and the HUD is not laid
out for a portrait phone. A left click on the court is a control shot; the
power meter can be clicked to charge and release. Escape, Enter and M are
the page's. The club card, the score, the shot panel, the prompts and every
menu sit inside the page's safe areas (`--oncyber-safe-*`).

## Kits

The avatar kit draws the visitor in the club and everyone else in the room
as their Oncyber avatars, with the lobby's motion and emotes, and stages
the arrival pose. The locomotion kit walks the visitor in the club and
frames the arrival; the club's walls are Padel's (`src/club.js`). The UI kit
draws the club card and the setup, settings, pause and results menus. On
court the four players are Padel's own bodies, because the kit's avatar has
no way to play a game's own motion capture on its rig: the visitor's is
their avatar again, from the same bytes, with the padel strokes and a
racket; the three NPCs share one bundled avatar.

## Sound and pausing

All sound goes through the runtime's one output (`context.audio`): the
paddle, floor, glass, mesh and net Foley and a very quiet open-air bed. The
page owns volume and mute; the Settings switch asks the page. One pause
(`sessionPausing`): the game is suspended by a hidden tab and the page's
menu, and a match also while the visitor types in the page. Every match is
against NPCs, so nothing is ever left running for another person. P opens
the game's own time out during a match.

## Leaving and results

A finished or abandoned match returns to the club. "Back to the lobby" (the
club card, the pause menu, the result) leaves through the departure: the
visitor is stood in the club, the interface hides, the world fades to black
around the avatar and the page matches the lobby's first frame to it. Every
finished match reports exactly one result: format `doubles`, the visitor
and Leo on one side, Noa and Mika on the other, all three NPCs as `cpu`. A
match left or restarted before it ends reports none.

## Saved data

`settings` (visitor): the opponents' difficulty, the graphics quality and
the camera view. Nothing else: not sound, not results.

## Inspect

`screen`, `position`, `arrival` (while in the club), `menu` (the open menu:
setup, settings, pause, results), `cameFrom`, `standing`, `walked`,
`partySize`, `formats`, `difficulty`, `phase` (the match's phase: serve,
rally, point, finished), `server`, `score` ("visitor's side-opponents"),
`pointsPlayed`, `matchesStarted`, `paused`, `matchOpen` and `resultsSent`.

## Bot

`bot.json` plays a match shortened to first to two (`points=2`): it holds
`up` to walk, presses `confirm` (its J binding, since Space jumps in the
club) for the setup and again for "Play doubles", presses `hit` every two and a half
seconds, which serves and returns some balls and lets others go (a control
shot on every ball is a rally that never ends in Practice), until the
result, then `down` and `confirm` for "Explore the club", which
returns to the club. `scenario.json` is the lifecycle scenario: a lobby
arrival with a party of two, a walk, the setup, a serve, one full point and
the walk back to the next serve, and the game's own pause, frame by frame.
A short match takes one to three minutes in headless Chromium.
