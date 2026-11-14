# Brief: Bloom Garden

## Game

A shared garden where each visitor hatches, feeds, pets and raises
bloomlings. There is no round to win: the core loop is care, and two mini
games (a race and a sparring bout) end on a results card.

## Players

Everyone in the room walks the same garden and sees each other's avatars and
bloomlings. One visitor alone raises their own bloomlings and enters either
mini game against CPU bloomlings.

## Formats

-   1 player: raise your own bloomlings, and race or spar against CPU bloomlings.
-   2 players: share one garden; race or spar each other's bloomlings, the rest watch and cheer.
-   3 players: share one garden; up to three bloomlings in a race, or two spar while one cheers.
-   4 players: share one garden; a four-bloomling race, or sparring in turns with the others cheering.
-   5 to 8 players: share one garden; races take everyone who joins, and anyone not racing can watch and cheer.

## Arrival

The garden is the arrival: a visitor from the lobby stands at the spawn
facing the lobby's camera with the garden behind them, crouched and holding
nothing, then stands and walks. Nothing starts on its own; mini games begin
at the race gate or the cave when the visitor chooses a bloomling and a
tier, and end back in the garden beside the gate or cave. There is no title
screen. `game.json` sets `"format": "world"`.

## Devices

Keyboard: WASD or arrows walk, Shift walks slowly, Space jumps, E picks up
and uses, F pets, Q throws, R whistles, G waves, C cheers, Tab opens the
roster, H help, M mute, Escape closes. Touch: a stick, a drag to look, a
pinch to zoom and buttons for each action, all in a separate UI frame.
Gamepad: left stick, right stick to look, face buttons. Portrait screens get
a wider lens.

## Inspect

`screen`, `position`, `arrival` (on a lobby trip), `booted`, `bloomlings`
(how many the visitor has), `stage0` (the first one's stage), `held` (what
the avatar carries: "bloomling", an item type or ""), `match` and
`matchPhase` (the mini game under way), `menu`, `avatar`, `online`, `peers`.

## Bot

`bot.json` walks `forward` from the spawn toward the first egg, presses
`interact` to pick it up (`held` becomes "bloomling") and `throw` to set it
down (`held` becomes ""). It takes a few seconds. It does not play a mini
game: a fresh save has only an egg, and both games need a hatched bloomling.
