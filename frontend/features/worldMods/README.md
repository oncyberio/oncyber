# World mods

Custom code for individual worlds, kept out of the shared engine.

```
worldMods/
  index.ts        registry: slug -> lazily imported mod, and applyWorldMod()
  types.ts        WorldMod hooks and the context the engine passes them
  paintedSky/     reusable technique: draw a sky as instanced brush strokes
  worlds/<slug>/  one folder per world: index.ts default-exports a WorldMod,
                  plus that world's own data
```

The space loaders (`kits/classic` and `kits/kitbash`) make one call,
`applyWorldMod(slug, { background, mobile })`, after the sky is built. Nothing
else in the engine knows which worlds have mods.

Rules for a mod:

-   Each world's mod is its own chunk, loaded only when that world opens.
-   Hooks run after the engine's own work and must leave the world as it was
    if they fail (`applyWorldMod` catches and logs).
-   Reusable techniques go in their own folder next to `worlds/`, so other
    worlds can use them with their own data.
-   Static files go in `public/world-mods/<slug>/`.

Worlds today:

-   `thestarrynight_skydome`: the sky is repainted as brush strokes
    (`paintedSky`, stroke file built by `tasks/painted-sky`). Compare before and
    after at `/dev/painted-sky` (development only).

Later, a mod could be loaded from the world's own hosted bundle instead of
this registry; the `WorldMod` shape is the contract either way.
