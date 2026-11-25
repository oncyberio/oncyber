# World mods

Custom code for individual worlds, kept out of the shared engine.

```
worldMods/
  index.ts          registry: slug -> lazily imported mod, applyWorldMod()
                    and applyWorldScene()
  types.ts          WorldMod hooks and the contexts the engine passes them
  brush/            the procedural brush stroke (TSL) every technique draws
  paintedSky/       reusable technique: draw a sky as instanced brush strokes
  paintedSurface/   reusable technique: paint walls, floors and furniture as
                    brush strokes laid on flat underpaint
  worlds/<slug>/    one folder per world: index.ts default-exports a WorldMod,
                    plus that world's own data
```

The space loaders (`kits/classic` and `kits/kitbash`) make two calls. Nothing
else in the engine knows which worlds have mods.

-   `applyWorldMod(slug, { background, mobile })`, after the sky is built
    (`onBackground`). Not waited for: the world shows meanwhile.
-   `await applyWorldScene(slug, { scene, colliders, portalIds, mobile,
onDispose })`, before the world is shown (`onScene`). The walking
    collision is built from `colliders` after it returns, so a mod can add
    meshes to the list or give one another geometry.

Rules for a mod:

-   Each world's mod is its own chunk, loaded only when that world opens.
-   Hooks run after the engine's own work and must leave the world as it was
    if they fail (both calls catch and log). `onScene` holds up the world, so
    keep it short.
-   Reusable techniques go in their own folder next to `worlds/`, so other
    worlds can use them with their own data.
-   Static files go in `public/world-mods/<slug>/`.
-   A mod serves every space built on its world. Where a space's owner has
    put something of their own (a portal on a door, say), theirs wins.

Worlds today:

-   `thestarrynight_skydome`:
    -   The sky is repainted as brush strokes (`paintedSky`, stroke file
        built by `tasks/painted-sky`). Compare before and after at
        `/dev/painted-sky` (development only).
    -   The first house down the road from the spawn point (door
        `Portal_Door_073`) can be walked into (`house/`). Its door swings
        open as a visitor comes near; inside is a room after "Bedroom in
        Arles", painted with `paintedSurface`. See the room on its own at
        `/dev/painted-house` (development only). A space that has made that
        door a portal keeps it as a portal, and the house stays shut.

## Painting a surface

`paintedSurface/painter.ts` has no three.js in it. Describe what to paint in
any frame you like, then build the arrays:

```ts
const paint = createPainter({ seed: 7, light: lampLight });
paint.poly(corners, { palette, flow: Math.PI / 2 }); // a wall, a floor
paint.box(min, max, { palette, grain: "y", faces: "xXzZ" }); // a post
paint.beam(a, b, facing, width, depth, { palette }); // a rafter
paint.line(a, b, facing, { colour }); // a contour
const group = createPaintedSurface(paint.build(), "myRoom");
```

Corners go counter-clockwise as seen from the side that is looked at. There
is no lighting at run time: `light` is called once per stroke and the result
is painted into its colour, as the world's own unlit strokes are. One room
is two draw calls (the underpaint and every stroke).

## Opening another house

`worlds/thestarrynight_skydome/house/` is written for one house but split so
the next is mostly data: `layout.ts` (where it stands, its doorway),
`interior.ts` (what is painted inside, and the furniture that is solid),
`colliders.ts`, `door.ts` (the door's states, a pure machine) and
`openHouse.ts` (the only file that touches the scene). The house model is
shared by 27 copies; `openHouse` redraws the parts of one copy without what
closed its doorway and leaves the others alone.

Later, a mod could be loaded from the world's own hosted bundle instead of
this registry; the `WorldMod` shape is the contract either way.
