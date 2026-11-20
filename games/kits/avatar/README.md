# Avatar kit

An optional library for three.js games on Oncyber. It shows the visitor and
the other players as their Oncyber avatars, plays the lobby's animations and
emotes, puts a name tag and a talking indicator over each head, and stages
the arrival pose (crouched, facing the camera, empty hands; standing once
the page says `entered`).

A game bundles it. It is not part of the lifecycle runtime, which has no
renderer. How to use it, the rule it serves and the check that enforces it:
[docs/games/avatar-kit.md](../../../docs/games/avatar-kit.md). Ace uses it
(`games/ace/src/main.js`).

| File             | What it holds                                                                   | Imports three.js |
| ---------------- | ------------------------------------------------------------------------------- | ---------------- |
| `src/index.ts`   | `createAvatarKit`: the visitor, the other players, arrival, `inspect()`         | yes              |
| `src/rig.ts`     | One avatar: stand-in body, VRM, lobby clips, the crouch                         | yes              |
| `src/vrm.ts`     | Bytes from `services.avatar()` to a VRM                                         | yes              |
| `src/tag.ts`     | Name tag and talking indicator                                                  | yes              |
| `src/motion.ts`  | Which clip plays, and the motion in a room pose's `a`                           | no               |
| `src/arrival.ts` | The arrival state, the lobby's camera framing, the crouch angles                | no               |
| `src/peers.ts`   | The page's `peers` list to a smooth pose each frame                             | no               |
| `src/facts.js`   | The `inspect()` facts, the `game.json` rule, the check's assertions             | no               |
| `src/page.ts`    | `pageAvatarService` and `answerInspect` for games not on the lifecycle host yet | no               |
| `src/probe.js`   | Proof a body was drawn                                                          | no               |
| `motion/`        | The lobby's clips, copied by `npm run motion`                                   |                  |

```sh
npm ci && npm test
```
