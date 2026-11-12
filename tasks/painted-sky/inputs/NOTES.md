# Painted Starry Night sky: inputs and findings

Everything here was gathered on 2026-11-12 from the local dev server
(`/spaces/Em8Sj1LhKXg3mOIeIp6K`, destination `TheStarryNight_Skydome`), so a
machine without access to IPFS, Pinata or Wikimedia can continue the work.

## Files

| File                                  | What                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| `sky-envmap-2048x1024.jpg`            | The sky as shown today: the destination's envMap / backgroundMap, equirect, 317,567 B  |
| `sky-mesh.json`                       | How the sky is drawn: mesh, material, transform, direction to UV formula               |
| `thestarrynight_skydome-high.glb`     | The destination GLB (22,913,520 B, glTF-Transform, EXT_mesh_gpu_instancing)            |
| `starry-night-1889-8000px.jpg`        | The Starry Night (1889, MoMA), Google Art Project scan on Wikimedia Commons, 8000×6335 |
| `scene-info.json`                     | Camera and background mesh as read from `window.__oncyber` (`?inspect`)                |
| `screenshots/before-*.png`            | Today's sky at 1280×800: front, right, back, left, up (pitch 1.5), up-high (0.8)       |
| `reference/cafe-terrace-brushwork.ts` | Café Terrace instanced-stroke code (structure tensor flow, bristle atlas, instancing)  |
| `reference/cafe-terrace-paint.ts`     | Café Terrace paint helpers (brush and canvas sampling), for reference only             |

The scan's source page:
https://commons.wikimedia.org/wiki/File:Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg
(public domain; the original is 30000×23756, 696 MB, downscaled here with sips).

## Where the sky comes from

-   The sky is **not** a mesh in the GLB. It is the destination's environment
    image (`roomParameters.envMap` / `backgroundMap`, a `.jpg`), a 2048×1024
    equirect JPEG of 317,567 bytes. It is not the painting itself but a
    360° re-composition in its style: moon, swirls and stars rearranged
    around the horizon. The bottom ~46% of the image is black; the GLB's
    mountain backdrop meshes (`Mtn_Backdrop`, `Blue_UNIFORM`, `Green`,
    radius ~84,000 units before node scale) hide it.
-   "Pixelated": 2048 px across 360° is about 5.7 px per degree, and the
    material samples it with `LinearFilter`, no mipmaps, so at fov 65 on a
    1280 px wide screen each texel covers ~3.4 screen pixels; on a retina
    screen ~7. JPEG blocks also show in the dark blues.
-   "Exactly the same drawing" therefore means the env image, not the
    museum painting: the swirls and stars must land where they are in
    `sky-envmap-2048x1024.jpg`. Use the 8000 px scan as a source of real
    stroke detail and colour (for example, match each env-image region to
    the painting region it was copied from) but register to the env image.
-   The same image also feeds the PMREM environment (lighting, reflections)
    and the fog colour (`FogFactory.get(background)`). Leave those as they
    are; only replace what the background mesh draws.

## Weights (cold load, measured with network logging)

-   Sky texture: 317,567 B (JPEG). This is the budget the stroke file must
    beat.
-   Destination GLB: 22,913,520 B. Both `-mid.glb` and `-high.glb` are
    fetched on load and are the same size, so ~45.8 MB of GLB per cold
    visit (a separate issue worth reporting).
-   The GLB's 53 images total 12.9 MB (mostly 512² PNG brush textures).
    `VG_VR_small` (512×407 JPEG) is a small framed painting quad
    (`DIS_Painting_VGSN`), not the sky.

## How the sky is drawn (engine path)

1. `frontend/components/_3DExhibit-v2/three/factory/space/kits/kitbash/index.js`
   (around line 165): after the GLB loads, `getBackgroundDisplay(opts)` then
   `BackgroundFactory.get(background)`, then
   `new Space({ scene: kitbash.scene, background: backgroundMesh })`.
   `opts.roomParameters.slug` is the destination slug (also passed as
   `kit`), a good key for the hook.
2. `frontend/components/_3DExhibit-v2/three/factory/abstract/spacefactory.js`
   `getBackgroundDisplay` → `loadCubeImage`: loads the JPEG into a
   `Texture` (sRGB, LinearFilter), builds the PMREM env from it and sets
   `background.sharp = tex`.
3. `frontend/components/_3DExhibit-v2/three/factory/background/index.js`
   `get(value)`: with `value.sharp`, a `SphereGeometry(2, 32, 32)` with
   `SharpMaterial`, `scale.z = -1`, follows the camera in `onBeforeRender`,
   `renderOrder -1e8`, named `backgroundMesh`.
4. `frontend/components/_3DExhibit-v2/three/factory/space/space.js`:
   `Space.background` setter adds the mesh to the scene.

Hook idea: a feature folder (e.g. `frontend/features/worldMods/` (now built: see its README)) with a
function the kitbash kit calls after `BackgroundFactory.get` when the slug
is the Starry Night one. It loads the stroke file, builds the instanced
strokes as a camera-centred group (same trick as the sharp sphere: copy the
camera position into `matrixWorld`, depth write off, depth at the far
plane, low renderOrder), and only then hides the sharp sphere. If the
stroke file fails, the sphere stays.

Debug: `?inspect` exposes `window.__oncyber` (`Renderer`, `Scene`,
`Camera`, `Root`, `PostProcessing`, `world`). Camera at spawn: fov 65,
far 1400, position (0, 2.85, 0). Setting `Camera.current.rotation` with
order `YXZ` every rAF frame points the view (that is how the screenshots
were taken: yaw 0 / -π/2 / π / π/2 at pitch 0.25, then pitch 0.8 and 1.5).

## Café Terrace approach (reference/cafe-terrace-brushwork.ts)

-   Each canvas patch becomes one instanced quad lying on the surface, its
    long axis along the paint's flow: the smoothed structure tensor of the
    canvas luminance (Sobel gradients, box blur radius 5, angle =
    0.5·atan2(2xy, xx−yy) + π/2).
-   Strokes every 3 canvas px with jitter, length ≈ 2.2–3 steps, width ≈
    1.15–1.45 steps, big patches split so no stroke is longer than a brush.
-   Brush: a 4-mark bristle atlas painted on a canvas at load (tapered body,
    22 streaks of varying light and length), colour = stroke colour × mix
    (0.86, 1.12, streak light), `alphaTest 0.5`, no fog.
-   One `InstancedMesh` per 24 m cell with per-instance `strokeColour` and
    `strokeKind` attributes; about 255k strokes.
-   For the sky the brief asks for a procedural TSL mask instead of the
    atlas (no texture at all), coarse-to-fine layering, denser in swirls,
    stars and moon, and a compact offline-built binary.

## Target for the sky (from the brief)

-   Offline script under `tasks/painted-sky/` samples the source through the
    dome's direction-to-UV mapping and writes a compact binary: direction
    (or UV), angle, length, width, colour, layer.
-   Runtime in its own feature folder, TSL only (WebGPU and
    `?renderer=webgl`), unit test for the decoder, stroke file well under
    317,567 B, frame time near today's.
-   Never write the word for the old project name in this repo (see
    `AGENTS.md` and the repo rules).
