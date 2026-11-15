# Brief: Lantern Tag

## Game

Visitors walk a small night-time courtyard. Lanterns on twelve posts light up
at random, a few at a time; walking up to a lit one catches it before it
fades (nine seconds). A round ends after 90 seconds, and the score is the
lanterns caught. It has matches: "format" is "match".

## Players

One to eight play at once. Alone, a visitor plays a solo round against the
night: every lantern that fades uncaught is a point for the night. A party
plays one round together in its own room: the same lanterns for everyone,
each lantern goes to whoever reaches it first, and every member sees
everyone's score on the board. The game reads who is there from the trip's
roster (the party link), one member runs the round and sends it as
snapshots on the match channel, and the others send what they caught.

## Formats

-   1 player: Solo round (against the night).
-   2 players: Head to head (the two play the same round), or Solo round.
-   3 players: Everyone plays (one round for the whole party), or Solo round.
-   4 players: Everyone plays, or Solo round.
-   5 to 8 players: Everyone plays, or Solo round.
-   Late, dropped and extra players: a member who arrives while the party's
    round is on can join it in progress from zero, or play solo. When a
    member drops the round goes on without them, their score stays on the
    board marked as left, and if they were running the round another member
    takes it over. A round seats the whole party, so there are no extra
    players; anyone who would rather not join plays solo or walks the yard.

## Arrival

A visitor from the lobby stands beside the well, in the lobby's last view
(the locomotion kit's arrival helper), crouched, and stands up when the page
reveals the game. They can walk the whole courtyard, run, jump and look
around. Starting is a choice: the Start a round button, or E (Go on a phone,
X on a gamepad), opens a menu of the formats for their party's size, and
picking one starts the round. A direct visit sees a title card first, then
the same courtyard. Leaving a round, and the result screen, return to the
courtyard where the visitor stands. game.json says "arrival" is walkable.

## Devices

Desktop, phone and gamepad. Walk: W A S D or the arrows, the touch stick,
the left stick or the d-pad. Start, pick and confirm ("interact"): E or J,
the Go button, X. Jump: Space, the Jump button, A. Run: Shift, the Run
button, the right trigger or a left stick press. Back out of the menu:
Backspace, B. Look: drag on the view, or the right stick. Menu buttons are
ordinary buttons, so a click or a tap works too. The score, the board, the
buttons and the menus sit inside the page's safe areas on every screen; on a
phone the hint moves to the top so the stick and buttons have the bottom.

## Kits

The avatar kit draws the visitor and everyone else in the room as their
Oncyber avatars, with name tags and the arrival pose. A visitor with no
avatar is the game's own cloaked figure, because the kit's stand-in has
near-black legs that the departure check cannot see. The avatars' idle,
walk, run and jump are generated in code, not the kit's motion files, which
have no licence a new game can ship under. The locomotion kit does the
walking, the camera and the arrival framing. The UI kit styles every menu,
button and board.

## Sound and pausing

All sound is synthesised and goes through the SDK's one output: a quiet
night bed from the start, and notes for a lantern lighting, being caught and
fading, and for a round starting and ending. The page owns volume and mute.
One pause path (sessionPausing): alone, a hidden tab and the page's menu
suspend the game, and so does typing in the page during a solo round. A
round other people are in never pauses: a hidden member says so, hands the
round on if it was running it, and asks for its place back when shown.

## Leaving and results

A finished round shows its result and returns to the courtyard; a round left
early returns there too and reports nothing. Every way to the lobby (the
Lobby buttons on the title, the courtyard and the result, and the page's own
button) goes through the departure: the visitor is stood in the courtyard in
third person, the interface is hidden and the world fades to black around
the avatar. One finished round reports exactly one result: each player is a
side of one with their lanterns as the score; a round one person played is
reported against the night.

## Saved data

Nothing.

## Inspect

`screen`, `position` and `arrival` (the standard three), and `phase` (idle,
playing or over), `format` (solo, duel or round), `score` (lanterns the
visitor caught), `missed` (lanterns that faded), `left` (seconds left in the
round), `lanterns` (how many are lit) and `players` (how many are in the
round).

## Bot

bot.json runs a 20 second round (the query shortens it). It holds "up" to
walk into the yard, presses "interact" to open the menu and again to start
the solo round, then walks a square (up, right, down, left, a second and a
half each) past a lantern post until the result shows, about half a minute,
and presses "interact" to return to the courtyard. scenario.json is the
lifecycle half: a lobby arrival, a walk, the menu, and a solo round started
and running.
