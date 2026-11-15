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
-   Late, dropped and extra players: a late member arrives on the island as
    it is and can join a mini game while its gate is open; a dropped
    member's avatar and bloomlings leave and their save returns with them;
    mini games seat four racers or two fighters, everyone else watches, and
    empty spots get CPU rivals.

## Arrival

The garden is the arrival: a visitor from the lobby stands at the spawn
facing the lobby's camera with the garden behind them, crouched and holding
nothing, then stands and walks. The build still speaks `garden:<kind>`, so
the view comes in the older `arrival` message, not in `enter()`. Nothing starts on its own; mini games begin
at the race gate or the cave when the visitor chooses a bloomling and a
tier, and end back in the garden beside the gate or cave. There is no title
screen. `game.json` sets `"format": "world"`.

## Devices

Desktop and gamepad are claimed; the phone is not yet (its touch controls
are the game's own, in a separate UI frame, not the runtime's). Keyboard:
WASD or arrows walk, Shift walks slowly, Space jumps, E picks up and uses, F
pets, Q throws, R whistles, G waves, C cheers, Tab opens the roster, H help.
Escape, Enter and M are the page's. Gamepad: left stick, right stick to
look, face buttons. Portrait screens get a wider lens. The HUD keeps inside
the page's safe areas.

## Kits

The avatar kit's probe reports how other people are drawn; the garden
draws avatars and walks with its own code, older than the kits, and its
menus do not use the UI kit yet (the check warns).

## Sound and pausing

All sound goes through the runtime's one output; the page owns volume and
mute. One pause: alone in the garden the game is suspended by a hidden tab
or a page menu; in a mini game with other players it keeps simulating.

## Leaving and results

A mini game ends on a results card and returns to the garden beside its
gate or cave. The Lobby button leaves through the page (`exit`); the
matched departure frame is not built yet. Every finished mini game reports
exactly one result.

## Saved data

`save` (visitor): the garden and its bloomlings.

## Inspect

`screen`, `position`, `arrival` (on a lobby trip), `booted`, `bloomlings`
(how many the visitor has), `stage0` (the first one's stage), `held` (what
the avatar carries: "bloomling", an item type or ""), `match` and
`matchPhase` (the mini game under way), `menu`, `avatar`, `online`, `peers`.

The garden's lifecycle `inspect()` carries the three standard facts itself,
so its host hands it to `exposeInspect()` as it is.

## Bot

`bot.json` walks `forward` from the spawn toward the first egg, presses
`interact` to pick it up (`held` becomes "bloomling") and `throw` to set it
down (`held` becomes ""). It takes a few seconds. It does not play a mini
game: a fresh save has only an egg, and both games need a hatched bloomling.
`scenario.json` is the lifecycle scenario the contract check plays.
