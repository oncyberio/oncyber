# World controls

`createFollowControls` is the character controller WebGPU worlds on Oncyber
should use. It is built from the lobby's own parts, so a world feels exactly
like the lobby:

| Input             | Does                                           |
| ----------------- | ---------------------------------------------- |
| W / S, ↑ / ↓      | Walk forward and back                          |
| A / D             | Strafe                                         |
| ← / →             | Turn the camera                                |
| Shift             | Run                                            |
| Space             | Jump; press again in the air for a second jump |
| Drag              | Look around                                    |
| Wheel             | Tilt the camera up and down                    |
| Thumb pad (touch) | Walk; drag anywhere else to look               |

Speeds, acceleration and braking come from `multiplayer/protocol/movement`,
the same code the lobby server runs. The key mapping and the jump buffer come
from `features/lobby/lobbyControls.ts`. The camera is the lobby's: 5 m behind,
looking at chest height, pitch between -0.65 and 0.05 rad.

```ts
import { createFollowControls } from "@features/worldControls/followControls";

const controls = createFollowControls({
    canvas,
    start: { x: 0, z: 0, yaw: Math.PI },
    ground: (x, z) => terrain.height(x, z),
    collide: (point, radius) => walls.resolve(point, radius),
    cameraReach: (x, z, dx, dz, far) => walls.raycast(x, z, dx, dz, far),
    onKey: (code) => code === "KeyE" && interact(),
});

// every frame
controls.update(dt);
avatar.position.set(controls.player.x, controls.player.y, controls.player.z);
avatar.rotation.y = controls.player.heading; // 0 faces +Z
camera.position.copy(controls.camera.position);
camera.quaternion.copy(controls.camera.quaternion);
```

The world supplies only what it knows (ground height, walls, ceilings, extra
keys); the controller never touches the scene. `hold(true)` freezes the player
in place (seated, in a cutscene) while still reporting input through
`onActivity`, which is how "walk to stand up" works in the café world.

The lobby itself still runs its own copy of this loop, because it also does
server reconciliation and travel animations. Moving it onto this module is a
follow-up.
