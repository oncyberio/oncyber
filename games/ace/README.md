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
`ace:self` and `ace:peers`), **Play match** opens the party's formats first:
1 v 1, 2 v 2, a tournament, or a solo match against the CPU. `src/party.js`
decides the formats and builds the draw. Head-to-head play is not built yet;
the draw is shown, and the solo match works. Try it with `?party=4` on the
development server.

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
