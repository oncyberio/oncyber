# Brief: ACE! Tennis

## Game

An arcade tennis match on one court. The visitor moves, times a shot as the
ball arrives and aims with the stick; a match is one to three games, and the
first to win them ends it.

## Players

One visitor plays a CPU opponent at three difficulties (rookie, pro, ace).
That solo match is always offered, whatever the party. Party members see the
same draw; playing each other waits for a real-time match channel.

## Formats

-   1 player: a match against the CPU, at three difficulties.
-   2 players: 1 v 1, or each plays the CPU.
-   3 players: a round robin: everyone plays everyone, one match at a time.
-   4 players: 2 v 2 doubles, or a four-player tournament.
-   5 to 8 players: a knockout bracket, seeded by the party.

## Arrival

A visitor from the lobby stands beside the near baseline, facing the lobby's
camera with the court behind them, crouched and without a racket, then stands
and can walk the near half of the court and look around. "Play match" is a
button (Enter): it opens the party formats or the match setup. Leaving a
match or its result ("Title") returns to the same spot on the court. The
title screen with the logo appears only on a direct visit.

## Devices

Keyboard: WASD or arrows move, J or Space a regular shot, K topspin, H a cut,
U a lob, H and K together a drop shot, Enter confirms, Escape goes back, P
pauses, M mutes. Touch: a stick on the left and shot buttons on the right.
Gamepad: left stick and face buttons. On tall screens the camera pulls back
to keep the court in frame.

## Inspect

`screen`, `position`, `arrival` (while arriving), `phase` (the engine's
phase: serve, toss, rally, point, over), `games` (games won, visitor first)
and `winner` (0 for the visitor, 1 for the CPU, null while playing).

## Bot

`bot.json` plays a one-game match against the rookie CPU: it walks forward,
presses `confirm` twice (start, then the setup's "Play"), presses `topspin`
about three times a second until the result, then `right` and `confirm` for
"Title". A match takes one to three minutes in headless Chromium.
