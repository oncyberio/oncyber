# ACE! Tennis

A Nintendo-style singles tennis mini game for Oncyber: toy-like characters, a
packed stadium, charge-and-time shots and a CPU opponent at three levels. It is
a fresh build, independent of the earlier Baseline tennis destination.

Open `/games/ace` on the local frontend (`pnpm dev:frontend`). It is hidden until launch: development only, or `GAMES_PREVIEW=1`.

## Arriving from the lobby

A lobby trip ends courtside in the lobby's own third-person framing: the page
sends the lobby camera (`ace:arrival`), the game stands the visitor beside the
near baseline with the same camera offset and field of view, facing the
camera and crouched as the lobby left them, then standing up, and answers
`ace:arrival-ready`. From there WASD walks, dragging looks around, and
**Play match** (Enter) opens the match setup. Leaving a match or the setup
returns here. A direct visit to `/games/ace` opens on the title screen instead.

## Parties

When the visitor arrived with a party (`ace:party`, then the party room's
`ace:roster`), **Play match** opens the party's formats first: 1 v 1, 2 v 2, a
tournament, or a solo match against the CPU. The formats and the seeded draw
come from the game runtime (`games/runtime/src/party.ts`).

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
Try it with `/games/ace?party=2` in two windows on the development server
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
  games. **Esc / P** pauses, **M** mutes.

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
| `src/main.js` | Screens, HUD, camera and the frame loop |
| `src/host.js` | Embedding: the Oncyber game page (`ace:*` messages, saved settings) or standalone |

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
