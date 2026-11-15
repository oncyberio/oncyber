# Skyhoop

Broom ball in the Oncyber bowl. Seven riders a side fly over an oval pitch:
grab the **Comet** and throw it through one of the other team's three hoops
(10 points), dodge the two **Bolts** that hunt riders and knock the Comet
loose, and when the **Wisp** appears, catch it with your Finder for 30
points and the match.

You fly a Runner. `Tab` hands you your team's Finder and back. Bots fly
everyone else, at three difficulty levels.

## Controls

| Action                       | Keyboard and mouse        | Gamepad          | Touch          |
| ---------------------------- | ------------------------- | ---------------- | -------------- |
| Steer                        | mouse (click to capture)  | right stick      | drag right side |
| Fly forward / brake          | `W` / `S`                 | left stick       | left stick     |
| Strafe                       | `A` / `D`                 | left stick       | left stick     |
| Rise / dive                  | `Space` / `C`             | A / left trigger | RISE / DIVE    |
| Boost                        | `Shift`                   | left stick press | BOOST          |
| Throw (hold to charge)       | left mouse, `J`           | right trigger    | THROW          |
| Tackle the carrier           | left mouse without the Comet | right trigger | THROW          |
| Pass to the ringed teammate  | right mouse, `K`, `F`     | X                | PASS           |
| Barrel roll (dodge a Bolt)   | `Q`                       | B                | ROLL           |
| Runner ↔ Finder              | `Tab`                     | Y                | SWAP           |
| Mount the broom (arrival)    | `E`                       | A                | MOUNT          |
| Pause                        | `Esc`                     | Start            |                |

## How it's made

-   `src/game/sim.js`: the match, pure and seeded (riders, flight model,
    the three kinds of ball, bot roles, rules). Tested in `test/`.
-   `src/game/game.js`: the lifecycle game. Draws the sim with three.js
    WebGPU, runs the cameras, turns events into effects, cues and HUD state.
-   `src/game/arena.js`: terrain, pitch markings, stands, towers, flags,
    hoops and forest, every repeated thing one instanced draw.
-   `src/game/crowd.js`: about 12,000 spectators in one draw call, animated
    in the vertex shader (sway, jumps, raised arms, a rolling wave).
-   `src/game/riders.js`: fourteen riders as instanced body parts.
-   `src/game/balls.js`, `fx.js`, `sky.js`, `post.js`: the balls, particle
    pools, the sky shader (also baked for reflections), bloom, speed blur
    and vignette.
-   `src/host/`: the browser host: session, input (pointer lock, touch,
    gamepad), HUD, synthesised audio, and the Oncyber page bridge with the
    lobby handoff.

The visitor's VRM rides the broom when it loads (a riding pose over the
lobby clips); until then the team figure flies.

```sh
npm ci
npm run dev        # http://127.0.0.1:14740
npm test           # simulation tests
npm run build      # into frontend/public/games/skyhoop
```

`?webgl` forces WebGL 2, `?low` caps the pixel ratio at 1, `?qa` exposes
`window.__skyhoop` and `window.__session` outside localhost.
