# Walking in a game

**Rule: when a visitor walks in a game, it feels like the lobby, unless the
game is about a different way of moving.**

A visitor arrives from the lobby already knowing how to move: W A S D, Shift
to run, Space to jump (twice for a double jump), drag to look. A game that
changes the pace, the camera or the keys for no reason feels like a different
product. A game about skating, flying, driving or a fixed court is the
exception, and says so.

## What to do

Use the locomotion kit, `games/kits/locomotion` (TypeScript source, no
dependencies; alias `@oncyber/kit-locomotion` to its `src/index.ts` in the
game's Vite config, as `games/ace/vite.config.js` does). Do not write a walk
controller, and do not copy the numbers.

```js
import {
    applyCameraPose,
    arrival,
    bindControls,
    cameraPose,
    createWalker,
    exposeLocomotionProbe,
} from "@oncyber/kit-locomotion";

const HEIGHT = 1.75; // the avatar's height in this game's units
// 1. On arrival: the lobby's last frame, in this game's space.
//    `view` is the page bridge's `arrival` view or enter()'s continuity;
//    null (a direct visit) gives the lobby's follow camera.
const arrived = arrival(view, { at: spawn, facing: 0, avatarHeight: HEIGHT });
const walker = createWalker(
    { ...spawn, rotation: arrived.avatarRotation },
    { scale: arrived.scale, constrain: (s) => keepInsideWalls(s) }
);
const controls = bindControls({ view: canvas, camera: arrived.camera });

// 2. Every frame (the host owns the clock; pass its seconds).
const input = controls.read(seconds); // keys, drag, wheel, touch stick, gamepad
const pose = walker.advance(seconds, input); // x, y (jump height), z, rotation
avatar.position.set(pose.x, ground + pose.y, pose.z);
avatar.rotation.y = pose.rotation;
applyCameraPose(
    camera,
    cameraPose(arrived.camera, { x: pose.x, y: ground, z: pose.z }, innerWidth)
);

// 3. Let the check measure it.
exposeLocomotionProbe(
    () => (walking ? walker : null),
    () => startWalking()
);
```

Then add `"locomotion": "lobby"` to `game.json`.

`bindControls` listens for keys, pointers and a gamepad itself. That suits a
page with nothing else on it. A game that runs through the lifecycle
([contract.md](contract.md)) may not: its keyboard is the declared actions
([keys-focus.md](keys-focus.md)) and its touch stick, buttons and gamepad
are the runtime's ([devices.md](devices.md)). There, declare the lobby's
actions in `runtime.input` and feed the walker from them, as Ace does
(`updateArrive` in `games/ace/src/game.js`):

```js
// game.json: up/down/left/right (0 to 1), "run" (ShiftLeft, ShiftRight),
// "jump" (Space), "lookX"/"lookY" (the drag), each with touch and gamepad.
const jump = createJumpInput();
function update(context, seconds) {
    const { input, pressed, deltas } = context;
    if (deltas.lookX || deltas.lookY)
        dragLook(camera, deltas.lookX * 100, deltas.lookY * 100); // CSS pixels
    if (pressed.jump) jump.queue();
    const strafe = input.right - input.left;
    const forward = input.down - input.up; // -1 walks ahead
    updateCamera(camera, seconds, Math.abs(strafe) + Math.abs(forward) > 0.05);
    const pose = walker.advance(seconds, {
        strafe,
        forward,
        yaw: camera.yaw,
        running: input.run > 0,
        jump: jump.read(seconds),
    });
}
```

Nothing more is needed for pausing: the walker only moves when the game's
`update` runs, so it stops with the session
([loading-and-pausing.md](loading-and-pausing.md)). Hold it still yourself
while the game stages its departure ([departure.md](departure.md)).

`arrival` is the one place that turns the lobby's view into a camera. The
avatar kit ([avatar-kit.md](avatar-kit.md)) stages the pose (crouch, empty
hands) and its `arrivalFraming` calls this same helper; the departure view
is read back from the camera it placed.

-   `facing` is the heading the camera looks along once arrived: 0 looks down
    -z, `Math.PI / 2` down -x. The whole lobby formation (camera and avatar)
    is turned to it, so the hand-over frame is the same picture.
    `avatarFacing` picks the avatar's heading instead and lets the camera
    fall where the lobby had it.
-   Headings: at rotation 0 the avatar faces -z; at yaw 0 the camera sits on
    +z. `input.forward` is -1 when walking ahead (the lobby's convention).
-   `scale` is game units per lobby metre (avatar height / 1.8). Pace, jump
    and camera distance all scale with it.
-   The kit has no collisions. `constrain(state)` is where the game clamps
    `x` and `z` to its walls; the ground height is the game's to add.
-   `walker.speed()` is in lobby metres per second; `GAIT.walk` (1.6) and
    `GAIT.run` (4.5) are the speeds the lobby's clips are authored at.
-   A game with its own touch stick calls `controls.setStick(strafe, forward)`.
-   The pure parts (`createWalker`, `cameraPose`, `arrival`, `readKeys`, ...)
    have no DOM or renderer in them and run in Node.

## The numbers

One file: `games/kits/locomotion/src/constants.ts`. Walk 3.2 m/s, run 5.4,
acceleration 6.4 m/s², jump 6 m/s against gravity 18 (1 m high, twice);
camera 5 m back from a point 1.2 m above the feet, pitch -0.28 rad (limits
-0.65 to 0.05), 58° field of view (72° under 600 px wide); drag 0.0032 rad
per pixel. Two seconds of forward from rest covers 5.6 m.

They are copies of the lobby's own code
(`multiplayer/protocol/movement.js`,
`frontend/features/lobby/createLobbyScene.tsx`, `lobbyControls.ts`), which
stays the source. Two tests fail when they drift:
`games/kits/locomotion/test/lobby-parity.test.mjs` (`pnpm games:test`) and
`frontend/features/games/locomotionParity.test.ts` (the frontend's Jest run
in CI). Change the lobby first, then the constants file.

The lobby reads no gamepad; the kit's gamepad mapping (left stick moves,
right stick looks, A jumps, left stick press or right trigger runs) is its
own.

## The check

`pnpm games:check <id>` runs a locomotion stage
(`scripts/games/locomotion-check.mjs`) for every game whose `game.json` says
`"locomotion": "lobby"`. It is one more visit of the check page
(`?check=locomotion`: straight in, alone; the game's host plays no scenario
on it). Once the game is entered the stage asks it to start walking (the
probe's `begin`), holds W for two seconds of the walker's own clock, and
compares the ground covered from rest with the lobby's own movement code.
More than 5 % off fails the check with `STAGE_LOCOMOTION`, and nothing is
published. The result is in `check.json` under `locomotion`. The probe
gives no walker while the game is leaving or is not where the visitor
walks, and `begin` does nothing then.

A game about another way of moving leaves the key out, or writes
`"locomotion": "own"`, and the stage is skipped. A game that says `"lobby"`
and exposes no walker fails.

## Today

| Game   | Walks                                          | `locomotion` |
| ------ | ---------------------------------------------- | ------------ |
| Ace    | Courtside after arrival, with the kit          | `lobby`      |
| Garden | Its own controller (5.2 m/s; Shift slows down) | not declared |
| Padel  | No free walk                                   | not declared |
