# Video Studio Lab

This feature is the development-only product slice at `/studio/video-lab`.
It owns an independent `three-vanilla` graph and does not import the legacy 3D
engine, or gallery schema.

The editor reuses the base Studio presentation shell (`StudioTheme`, toolbar,
scene frame, lockup, and inspector frame) without sharing scene state. Its edit
camera follows the base Studio navigation contract: drag to orbit, Shift-drag
to truck, wheel to dolly, WASD/arrows to move, Space/B vertically, and click a
walkable floor to move. Keyboard movement is active only while the viewport has
focus, so typing in Director or Inspector fields cannot move the camera.

## Modules

-   `model/`: renderer-neutral project data, procedural set fixtures, and typed
    immutable operations.
-   `store/`: local journal, undo/redo, and revision-bound agent proposals.
-   `guide/`: chordal spline sampling, deterministic 30 fps manifests, and the
    capability-driven mock generation provider.
-   `engine/`: the isolated Three.js renderer and the explicit model adapter.
-   `director/`: typed demo proposals. Agent output never becomes executable UI.
-   `components/`: Director chat, live set preview/editor, inspector, and timeline.

Run focused tests with:

```sh
fnm exec --using=22.23.1 corepack pnpm -C frontend \
  test -- features/videoStudio --runInBand --watchman=false
```

The mock provider is intentional. A real provider must be implemented behind a
server route with secret isolation, verified capability discovery, asynchronous
jobs/webhooks, output mirroring, idempotency, and credit holds/settlement.
