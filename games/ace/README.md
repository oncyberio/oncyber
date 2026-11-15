# ACE! Tennis

A Nintendo-style singles tennis mini game for Oncyber: toy-like characters, a
packed stadium, charge-and-time shots and a CPU opponent at three levels. It is
a fresh build, independent of the earlier Baseline tennis destination.

Open `/games/ace` on the local frontend (`pnpm dev:frontend`). It is hidden until launch: development only, or `GAMES_PREVIEW=1`.

## Arriving from the lobby

Ace runs through the lifecycle (`docs/games/contract.md`). `enter()` says
how the visitor arrived. A lobby trip ends courtside in the lobby's own
third-person framing: `continuity.arrival.view` is the lobby camera, the
game stands the visitor beside the near baseline with the same camera offset
and field of view, facing the camera and crouched as the lobby left them.
The host holds the clock until the lobby lets go, then they stand up. From
there WASD walks, dragging looks around, and **Play match** (Space) opens the
match setup. Leaving a match or the setup returns here. A direct visit to
`/games/ace` opens on the title screen instead.

## Leaving for the lobby

Every way out (the Lobby buttons, the pause menu, a party member leaving)
goes through `departure.leave()` in `src/host.js` or the page's `departure`
message. The game returns the visitor courtside in the avatar kit's arrival
state (standing, empty hands, the arrival framing), hides the interface,
fades the court to black around the lit avatar (`src/departure.js`) and
answers `departure-ready` with the view on screen, read back from that same
kit state; the lobby opens on the same frame. See
`docs/games/departure.md`.

## Parties

When the visitor arrived with a party (`continuity.trip`, then `party(trip)`
as members arrive in the party's room; the room's roster is `trip.roster`),
**Play match** opens the party's formats first: 1 v 1, 2 v 2, a
tournament, or a solo match against the CPU (arrows and Space work too).
`game.json` declares the formats by party size; the formats and the seeded
draw come from the game runtime (`games/runtime/src/party.ts`), and a test
there keeps the two in step.

**1 v 1 is played between the two members.** Both pick it; the party's host
runs the engine and the other plays as its guest over the room's match
channel, each seeing themselves on the near half.

-   `src/duel.js`: who runs the match and what happens when someone comes or
    goes. A player who drops, hides the tab or leaves is replaced by the CPU and
    the match goes on; if they were running it, the other player takes it over
    and the point is replayed. Coming back (a reconnect, or **Rejoin your match**
    after a reload) returns their side with the score kept. A third member can
    **Watch**.
-   `src/versus.js`: the engine packed into a snapshot about thirty times a
    second, the guest's view rebuilt from it, and the guest's input on the way
    back.
-   `test/duel.test.js` plays whole matches through an in-memory room.

Doubles and tournaments show the draw; playing them through is not built yet.
Try the menu with `?party=4` on the development server, or `?arrive&party=4`
on the game's own dev server (`npm run dev`); play 1 v 1 with
`/games/ace?party=2` in two windows on the development server
(the room needs `multiplayer/` running: `npm --prefix multiplayer start`,
`NEXT_PUBLIC_ARENA_URL=http://localhost:2567`). The rule every game follows
for parties: [docs/games/party.md](../../docs/games/party.md).

## How it plays

- **Move** with WASD / arrows / left stick / the touch stick. Near the ball you
  get a gentle pull into hitting position.
- **J / Space / click** topspin, **K / right click** slice, **L** lob. Pads use
  A / B / X. Press early to charge: the longer the charge the harder the hit,
  and a full charge with clean contact is a **PERFECT** shot (hitstop, flash,
  wider safe angles, extra pace).
- Hold a direction while you swing to aim: left/right picks the side, up hits
  deep, down plays short. A reticle on the far court shows where a clean hit
  will land.
- **Serve:** press once to toss, again at the top. Timing sets pace and accuracy.
- Real tennis scoring (deuce, advantage, faults, lets, net cords), 1, 3 or 5
  games. **P** pauses. Esc (menu), Enter (chat) and M (sound) belong to the page.

## Code map

| File | Owns |
| --- | --- |
| `src/physics.js` | Fixed-step ball flight (gravity + spin), bounces, net, exact shot solver, prediction |
| `src/rules.js` | Scoring, serve sides, the rally referee |
| `src/athlete.js` | Shared footwork, intercept planning and contact rules |
| `src/shots.js` | Aim, accuracy spread and unforced-error placement |
| `src/cpu.js` | CPU reading, movement and shot choice |
| `src/engine.js` | Renderer-independent match simulation; emits events for the presentation |
| `src/character.js` | Procedural characters, faces and per-frame posing |
| `src/world.js` | Stadium, crowd, sky and props |
| `src/fx.js` | Particles, trail, shadow, markers, rings |
| `src/audio.js` | All sound and music, synthesized with Web Audio |
| `src/game.js` | The lifecycle game: screens, HUD, camera, one frame per `update()` |
| `src/host.js` | The browser host: runs the lifecycle, the page bridge, saved settings, the check |
| `src/actions.js` | The declared input actions read as moves, shots and menu events |
| `src/input.js` | Mouse, touch and gamepad bound to the declared actions |

Everything is procedural: no meshes, textures or samples to license. Text uses
system fonts.

## Development

```bash
npm install
npm run dev      # http://127.0.0.1:14720
npm test         # rules, solver and full bot-vs-CPU matches
npm run build    # writes ../../frontend/public/games/ace
```

`node scripts/sim-human.mjs <rookie|pro|ace> <lead-seconds> [nosteer]` plays the
human side through the normal input path and prints return rate, grades,
points won and average rally length; use it when tuning difficulty.

QA URL flags: `?autoplay` lets a bot play the human side, `&slow=0.3` slows
time, `&difficulty=ace&games=1` skips the setup screen choices.
