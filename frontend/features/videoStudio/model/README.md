# Video Studio core API

The core is deliberately independent of React, Three.js, persistence services,
and video vendors. UI code can import from `model`, `store`, and `guide`.

```ts
const editor = createEditorStore(createDemoProject());
const unsubscribe = editor.subscribe(render);
editor.dispatch({
    id: "move-camera-1",
    source: "user",
    type: "camera.point.move",
    shotId: "shot-1",
    spline: "position",
    index: 0,
    point: [8, 3, 8],
});
```

`getSnapshot` and `subscribe` follow the shape expected by React's
`useSyncExternalStore`. Every returned project is deeply frozen. Operations and
agent proposals create new snapshots; undo and redo also create new monotonic
revisions so an old proposal cannot become current again accidentally.

Coordinates are right-handed, Y-up metres. Rotations are XYZ degrees. A
procedural node's `size` is its full bounding size. `SetOption.palette` contains
UI swatches; renderer-specific sky, fog, and lighting choices belong in an
adapter rather than the catalog model.

Camera paths are open chordal Catmull-Rom splines. A project uses a 30,000 tick
timebase at 30 fps, giving exactly 1,000 ticks per frame. `createCameraManifest`
samples the path without Three.js and returns stable, rounded frame data tied to
the project revision. `MockVideoProvider` supplies the same
capability/quote/submit/status/cancel boundary expected from a future provider.
