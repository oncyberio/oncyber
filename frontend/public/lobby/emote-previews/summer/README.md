# Summer animation icons

These are renders of the **actual Summer avatar mesh**, posed with each native
emote. They are not generated mannequin drawings or approximations of the poses.
The source is `public/models/summer_unlit_fixed.vrm` (2,384 vertices / 2,756
triangles); source model, clip and generator hashes are recorded in
`manifest.json`. The original avatar and its metadata are unchanged.

The offline generator applies the same normalized VRM 0 rotation conversion and
hip scaling as the native avatar adapter, CPU-skins the mesh, and rasterizes its
triangles with a depth buffer. A quiet pearl material preserves Summer's cap,
spikes and crisp X goggles while simplifying fine fabric texture. Rendering at
2× resolution produces soft, clean edges on the transparent output.

From the repository root, using the existing Node dependencies and `img2webp`:

```sh
node frontend/scripts/generate-summer-emote-previews.mjs
node frontend/scripts/generate-summer-emote-previews.mjs --check
```

`--only WAVING,FLOORSITTING` can render a quick visual sample. Full generation
writes all fifteen pairs, the authoritative manifest, and
`features/lobby/summerEmoteData.ts`. Verification checks source hashes, coverage,
content-versioned URLs, transparent WebP encoding and dimensions.

-   Still icons are 192 × 192, ready for high-density displays.
-   Hover/focus animations are 160 × 160 transparent animated WebP at 12 fps,
    retaining the original duration up to a six-second excerpt (72 frames).
-   The first motion frame matches its representative still pose. Each clip keeps
    the same projection and bounds throughout playback, including seated and
    collapsed poses.
-   Only stills are needed to open the grid. Motion files load for the active card;
    the browser handles playback. Reduced motion, hidden tabs and inactive cards
    display the still. No avatar mesh, textures, rig, animation mixer or additional
    WebGL context is loaded by the panel.

The older generic SVG preview assets are retained separately and are not used by
the Summer picker.
