# Locomotion kit

Walk, run, jump and look around the way the Oncyber lobby does, and arrive
from the lobby on the same frame. Optional: a game about another way of
moving doesn't use it.

How to use it, the rule and the check: [docs/games/locomotion.md](../../../docs/games/locomotion.md).

| File               | What it is                                                                  |
| ------------------ | --------------------------------------------------------------------------- |
| `src/constants.ts` | Every number, copied from the lobby's code. The drift tests guard it.       |
| `src/motion.ts`    | The walker: the lobby's fixed 60 Hz step, plus scale and a wall hook. Pure. |
| `src/input.ts`     | Keys, touch stick and gamepad to the same actions. Pure.                    |
| `src/camera.ts`    | The third-person follow camera as numbers. Pure.                            |
| `src/arrival.ts`   | `arrival`: the lobby's view from enter() in the game's space. Pure.         |
| `src/three.ts`     | `applyCameraPose`: puts a pose on a three.js camera (imports no three.js).  |
| `src/controls.ts`  | `bindControls`: binds the actions to a page. Browser only.                  |
| `src/probe.ts`     | `exposeLocomotionProbe`: what `pnpm games:check` reads.                     |

```sh
npm test    # from this folder, or `pnpm games:test` from the repository root
```
