# Live swap prototype

Proof that a three.js world running in a sandboxed frame can take code edits
while it plays, on the existing portable lifecycle
(`prepare`, `enter`, `update`, `suspend`, `restore`, `dispose`, `inspect`).
Built on 14 November 2026 for [the decision doc](../agent-built-worlds.md).

## What is here

| Path | What it is |
| --- | --- |
| `rt/live.js` | The draft host. Runs inside the sandboxed frame: loads source text as modules, prepares the new version in the background, swaps between two frames, keeps the old version for a 20-frame trial, rolls back on any error, takes snapshots, records input, rewinds and replays. |
| `rt/runtime.html` | The frame page: an import map for `three`, then `live.js`. |
| `rt/three/` | three.js r187 build files. Not committed: `./setup.sh` copies them from `vendor/three/`. |
| `host/index.html` | The parent page: mounts the frame with `sandbox="allow-scripts"` and relays messages. |
| `world/` | Sample world that keeps geometry and materials between versions. |
| `world2/` | Same world, but keeps the whole static scene between versions (much faster edits, flat memory). |
| `drive.cjs` | Playwright driver that runs every test and prints JSON. |
| `results/` | JSON from the runs quoted in the doc. |

## Run it

Needs Node and Playwright with Chromium. First run `./setup.sh` once.

```sh
node drive.cjs webgpu          # swap cases, burst, 30-swap memory check
node drive.cjs webgl2          # same on the WebGL2 backend (presents to a canvas)
node drive.cjs manual          # rewind and replay tests on a manual clock
WORLD=world2 node drive.cjs granularity   # edit time when the scene is kept
WORLD=world2 node drive.cjs shot          # screenshots before and after swaps
GPU=real PW_CHANNEL=chrome HEADLESS=0 node drive.cjs webgpu   # on a real GPU
```

Query flags on the frame URL: `backend=webgl2|webgpu`, `present=0|1`,
`manual=1`, `freeze=1`, `nokeep=1`, `size=WxH`.

## What it showed (software GPU, headless Chromium 153)

- An edit is live in 0.18 to 0.33 s; the old version keeps 60 fps meanwhile
  and the swap itself takes under 1 ms.
- Syntax errors and throws in `prepare`, `enter` or the first frames after a
  swap never reach the player; the previous version carries on with its state.
- Data-only changes (`params`) need no swap.
- Rewind and replay through new code work when the world's rules are
  deterministic; the host detects when they are not.
- On a bigger world, keeping geometry and materials saved nothing (550 to
  680 ms per edit, heap 14 to 52 MB over 30 edits). Keeping the whole static
  scene cut edits to 7 to 34 ms and kept the heap near flat (14 to 19 MB).

## Known limits

- Software WebGPU loses its device when it presents to a canvas, so WebGPU
  runs draw to an off-screen target (`present=0`). Use `GPU=real` on a machine
  with a GPU.
- Under software WebGPU only the first pixel readback resolves, so pixel
  checks use the WebGL2 backend.
- One world, one browser. Not yet tried with multiplayer state.
