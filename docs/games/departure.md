# Leaving a game

Arrival from the lobby is frame-matched: the lobby hands the game its last
third-person view and the game opens on it. Leaving is the mirror. The game
hands the page the view of its last frame, the page waits for it, and the
lobby opens on that view, where the visitor left it.

## The rule

**Exit always returns to the lobby, from the walkable arrival state, never
from a dead end.**

For a coding agent building or changing a game, that means:

1. **One way out.** Every exit (a Lobby button, a pause menu, a results
   screen, a game-over card, the page's own Lobby button, a party member
   leaving) ends in the same call: `departure.leave()`, or the page's
   `departure` message. Never navigate, reload or close from game code.
2. **Every screen has it.** No screen may be a dead end. If a visitor can
   reach a state, they can leave from it in one action.
3. **Leave from where they arrived.** Before the last frame, put the visitor
   back in the state they arrived in: standing, third person, able to walk
   (Ace: courtside). Not mid-match, not in a menu, not in first person, not
   in a cutscene camera.
4. **The last frame is the avatar alone on black.** Hide the interface, fade
   the world to black, keep the avatar lit and still. That is the lobby's
   first frame too, so nothing jumps.
5. **Hand over what is on screen.** Build the view from the camera and avatar
   you actually rendered (`departureView`), not from constants. The avatar's
   height is the height on screen.
6. **Be quick and hold still.** The page waits 1.5 s. After answering, keep
   drawing the same frame until the page disposes the game.

## In the game

```js
import { createDeparture } from "@oncyber/game-runtime/departure";

const departure = createDeparture({
    post: (kind, data) => page.post(kind, data), // connectPage: "oncyber:game:<kind>"
    async stage(reason) {
        // reason is "self" or "party"
        goToArrivalState(); // rule 3
        hideInterface();
        await fadeWorldToBlack(); // rule 4
        return {
            // rule 5, in the game's world coordinates
            camera: { position, target, fov },
            avatar: { feet, yaw, height }, // yaw 0 faces -z, or give `facing`
        };
    },
});
page.on("departure", (reason) => departure.receive("departure", { reason }));
lobbyButton.onclick = () => departure.leave();
```

The runtime turns the shot into a view relative to the avatar's feet (the
same shape as the `arrival` view), refuses one the lobby can't frame (camera
inside the avatar, avatar off screen or behind the camera), waits two drawn
frames and answers. Ace is the worked example: `games/ace/src/departure.js`
(the fade: the scene, a black veil, then the avatar alone on its own layer),
the departure section of `games/ace/src/game.js` and the top of
`games/ace/src/host.js`. Ace stages its last frame on the avatar kit's
arrival state (`kit.arrival`, the arrival framing, `kit.pose`), the same
state its arrival uses, so the two can't drift apart
([avatar-kit.md](avatar-kit.md)).

## Messages

| From | Kind                | Meaning                                                                                        |
| ---- | ------------------- | ---------------------------------------------------------------------------------------------- |
| game | `exit`              | The visitor chose to leave (`departure.leave()`).                                              |
| page | `departure`         | `{ reason: "self" \| "party" }`: stage your last frame. Sent for every exit, however it began. |
| game | `departure-staging` | At once: "I know this message, wait for me." Without it the page leaves after 0.6 s.           |
| game | `departure-ready`   | `{ view }`: the last frame is on screen. `{ view: null, problem }` when there is none.         |

The page (`frontend/features/games/room/gameDeparture.ts`, `useGameDeparture.tsx`)
turns the view into the lobby's return view (planted, idle, third person) and
gives it to the lobby through the same bridge native spaces use
(`registerLobbyDestinationEntry`'s `depart`). A game that doesn't know the
messages still leaves; the lobby then opens without a matched frame.

## A party leaves together

When a member of a party starts the trip back, their page tells the party's
room, and every other member is offered to follow ("Ada is heading back to
the lobby. Follow / Stay"). Following is an ordinary exit with reason
`"party"`, so the game stages the same last frame. Staying keeps playing; the
offer lapses after 30 s. The notice travels between pages
(`gamePartyLeave.ts`); a game cannot send or forge one, and needs no code for
it beyond rule 1.

## The check

A game that declares `"departure": "matched"` in `game.json` gets a
`departure` stage in `pnpm games:check` (`scripts/games/departure-check.mjs`).
It plays the page's part and fails when:

| Code                      | What happened                                                     |
| ------------------------- | ----------------------------------------------------------------- |
| `DEPARTURE_NO_ANSWER`     | No `departure-ready`.                                             |
| `DEPARTURE_SLOW`          | The answer took longer than the page waits.                       |
| `DEPARTURE_NO_VIEW`       | No view, or one the lobby can't frame.                            |
| `DEPARTURE_BLACK_FRAME`   | A black, avatar-less frame at any point while leaving.            |
| `DEPARTURE_NO_AVATAR`     | The last frame shows no avatar.                                   |
| `DEPARTURE_WORLD_VISIBLE` | World or interface still lit in the last frame.                   |
| `DEPARTURE_MISMATCH`      | The avatar is not where, or not the size, the lobby will draw it. |
| `DEPARTURE_NOT_HELD`      | The frame changed after the game answered.                        |
| `DEPARTURE_NO_SEAM`       | With `--lobby`: the trip through the running lobby failed.        |

It measures the avatar in the last game frame (the lit pixels) and compares
its centre, feet, head and height with the lobby's first frame. By default
the lobby's frame is projected from the view. With a running app the real
seam is recorded too, one animation frame at a time on a stepped clock:

```sh
pnpm dev                                    # and: npm --prefix multiplayer run lobby:dev
pnpm games:check ace --lobby http://localhost:13000
```

That travels lobby → game → lobby in headless Chromium and keeps the game's
last three frames and the lobby's first three; all six must show the avatar,
and the last and first must agree. Frames are written to
`games/<id>/.check/departure-*.png`, numbers to `check.json` under the
`departure` stage.

Tolerances: 4 % of the frame for position (6 % for the head), 15 % for size.

## Not built yet

-   Bloom Garden still leaves with a cut: it needs the fade in its WebGPU
    post-processing chain and a stage in its game module.
-   The idle pose is not matched across the seam, only position and size.
-   Party members who follow return one by one, not as a formation.
