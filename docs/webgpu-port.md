# WebGPU port: state, parity list, plan

The goal is for oncyber spaces and the lobby to run on three r180
`WebGPURenderer` + TSL, 1:1 with today's WebGL experience. After extensive testing it becomes the default.
This branch may seed the fresh repo.

## Where things stand (2026-10-22)

| Surface | Production (`master`) | `dev` |
|---|---|---|
| Spaces / galleries (`components/_3DExhibit-v2`) | WebGL, oncyber three fork r153 | same |
| Lobby (`features/lobby`) | not shipped | **WebGPU by default** (three 0.180 in its own webpack layer), auto-fallback to a separate WebGL2 build |
| Lobby → space travel reveal | n/a | runs in the spaces engine, so it is WebGL |

Today there are two three.js versions in one bundle: the fork for spaces and vanilla 0.180 for the lobby.

## Branch status (2026-10-22)

- The whole frontend runs on a single three r180. The fork and the separate lobby three layer are gone.
- The spaces engine renders with `WebGPURenderer`; `?renderer=webgl` forces the WebGL2 backend.
- Every engine `ShaderMaterial`/`onBeforeCompile` patch was rewritten as a TSL node material. These areas are
  all done: avatars, nametags, artwork, frames, labels, video, text, reflections, water, sky/backgrounds, PMREM,
  kitbash/cyber kits, portals and capture, post-processing (1:1 port of the previous bloom), particles, rain,
  starfield, editor tools, progressive uploads and the lobby→space travel reveal.
- The lobby has one renderer path. Its WebGL2 fallback is the same renderer on its WebGL2 backend.
- Visually checked so far: one gallery (`/cologne_dude`) loads and matches production on WebGPU.
- Not checked yet: everything else in the parity list, the `?renderer=webgl` fallback, and VR.
- QA handle: add `?inspect` to expose `window.__oncyber` (Renderer, Scene, Camera, Root, …) in production
  builds. WebGPU validation errors are logged as `WebGPU validation error:`.
- Gotchas found:
  - A pipeline may use at most 8 vertex buffers. If it uses more, it is invalid and the whole frame comes out
    black.
  - SWC breaks `float`/`int` TSL imports, so alias them.

## Approach

- Use **one three.js (r180)** for the whole frontend and drop the fork. `WebGPURenderer` compiles TSL to WGSL
  on WebGPU and to GLSL on its WebGL2 backend (`forceWebGL`), so one code path also gives us the WebGL
  fallback. There is no second engine to maintain.
- Re-implement the few fork features we really use: fog sampled from the environment PMREM, the dirty-flag
  matrix update, `manualFrame`, and `currentRenderList`. Nothing in the engine uses the fork's
  InstancedSkinnedMesh or MultiDrawMesh.
- Rewrite every `ShaderMaterial` and `onBeforeCompile` patch as a node material. That is about 58 materials
  and about 7.9k lines of GLSL, of which roughly 1.5k is dead.
- Keep the engine free of raw GL calls and DOM-only shortcuts, so it stays on the same stack the native
  portable runtime runs.

## Parity list

Status is the state on this branch. ✗ means not ported yet. Each row's port effort is noted.

| Feature | How it works today | Port effort |
|---|---|---|
| Renderer bootstrap and frame loop | module-level singleton, manual clears, global clipping plane, custom opaque sort | Med: async `init()`, `ClippingGroup`, no `currentRenderList` |
| Material "pipeline" (diffuse/lit × occlusion/mirror variants swapped by events) | `#define` variants on every ShaderMaterial | High: cross-cutting; becomes node variants or uniforms |
| Fog (including env-texture fog) | fork `Fog(..., fogTexture)` + ShaderChunk overrides | Med: custom `fogNode` |
| Colour output / tone mapping overrides | ShaderChunk `colorspace_fragment` replaced | Low-Med: `outputNode` |
| **Avatars** (instanced VRM, GPU-baked animation, crossfade, atlas) | 1.2k lines of GLSL | High: reuse the lobby's `webgpu/avatarCrowd.ts` |
| **Animations / emotes** baking | worker bake + float render target | Low-Med |
| GLTF models and kit animations (normal skinning) | built-in | Low |
| Name tags, chat bubbles | instanced shader + canvas sprite | Low-Med |
| Artwork images + texture LOD, 360 artworks | MeshBasic + a 360 shader | Low / Med |
| Artwork frames (instanced borders) | ShaderMaterial | Med |
| Loaders, placeholders, trigger zones | small animated shaders | Low-Med |
| **Artwork info / labels / encart animation** | canvas textures + sprites + gsap + a shader background | Low |
| Video, streams, YouTube/HTML (CSS3D overlay) | VideoTexture, CSS3D | Low |
| **Portals** (stencil see-through, dissolve, 360) | raw `gl.stencil*`/`colorMask` + clipping + RT | High: per-material stencil and ClippingGroup |
| Portal screenshots, 360 capture, highlight palette, preview baker | sync `readRenderTargetPixels` | Med: async readback |
| **Floor reflections / mirror** | Reflector clone using `renderer.state`, HalfFloat MSAA, blur pass | High: TSL `reflector()` + node blur |
| Water | Water clone, `renderer.state` | Med-High: `reflector()` + TSL / `WaterMesh` |
| Sky, skybox, ground-projected background | Sky clone, `ShaderLib.backgroundCube` | Med: `SkyMesh`, `GroundedSkybox`, `backgroundNode` |
| Env maps / IBL | local 900-line PMREMGenerator copy | Low-Med: built-in PMREM |
| Lighting + shadows (one directional light, PCF soft, manual shadow updates) | built-in, plus custom lit shaders | Low-Med |
| Lightmaps / AO | from GLTF | Low |
| Kitbash kit materials (holo screens, etc.) | 600 lines GLSL + onBeforeCompile hooks | High |
| Cyber kit terrain (biplanar), grid, spawn | onBeforeCompile, derivatives | Med-High |
| Post-processing: Bloom, CyberCity, LUT, Trippy | custom quad + pmndrs `postprocessing` (WebGL-only) | High for bloom (TSL `bloom()`), Med for the others |
| Particles, rain, sprite sheets | instanced ShaderMaterials | Med |
| MSDF text | ShaderMaterial | Low-Med |
| Fat lines, meshline | ShaderChunk registrations | Low-Med: `Line2NodeMaterial` |
| Panorama viewer | ShaderMaterial | Med |
| Cinematic camera / intro composer / thumbnail | overlays + scissor | Med |
| Starfield loading transition | 400-line lit shader + an OffscreenCanvas worker renderer | High |
| Confetti | separate WebGL canvas | Low: can stay as is |
| Recorder (WebCodecs) | canvas grab | Low |
| Texture atlas, progressive uploads | `copyTextureToTexture` (r153 signature), capabilities | Med |
| KTX2 / Draco / VRM loading | local KTX2Loader | Low-Med |
| Editor: gizmos, transform/pivot controls, grid, cursor | mostly basic materials; grid and meshline are shaders | Med |
| WebXR / VR | `renderer.xr` | High risk: WebXR under WebGPURenderer is limited |
| User scripts (`THREE` exposed to space scripts) | whole namespace | Compatibility risk |
| Lobby | already WebGPU | Low: delete the legacy backend and the dual-three webpack layer |
| Lobby → space travel reveal | spaces engine | follows the spaces port |

**Dead code to drop instead of porting:** occlusion queries, cube parallax, `vertcube`/`fragcube`, the old
starfield, and the unused post passes (SMAA, SSAO, FXAA, unreal bloom, TV, mipmap blur). The `SelectiveBloom`
and `SSAO` options are listed in the GUI but no code path renders them.

## Milestones

Each milestone ends with a gate: screenshots of the same fixed set of test spaces on `dev` (WebGL) and on this
branch (WebGPU, and WebGPU with `forceWebGL`), plus frame timings.

1. **Foundation.** Move to a single three r180. Async WebGPU renderer facade, loaders (KTX2, PMREM, VRM),
   built-in materials, lighting, shadows, lightmaps, and the fork features we use (fog texture, dirty-flag
   matrices). Gate: a GLTF space with lightmaps renders.
2. **Material pipeline.** Lit/diffuse/occlusion/mirror variants, fog and output nodes, instancing helpers.
3. **People.** Instanced VRM avatars, baked animations, emotes, name tags, chat bubbles.
4. **Artwork.** Images + LOD, frames, video, info/label animation, loaders, placeholders, text, highlight, 360.
5. **Surfaces.** Reflections, water, sky/background/environment, kit materials (kitbash, cyber terrain).
6. **Portals.** Stencil portals, screenshots and 360 capture, and the lobby → space reveal on WebGPU.
7. **Effects.** Bloom/CyberCity/LUT/Trippy, particles, rain, sprites, panorama, cinematic, starfield.
8. **Editor and tooling.** Gizmos, lines, grid, preview baker, atlas uploads, recorder.
9. **WebGPU-only wins.** Compute-driven avatar animation, GPU culling and indirect draws, MRT bloom instead
   of a second occlusion render, BatchedMesh for kit geometry, async pipeline pre-compilation.
10. **Default switch.** Lobby and spaces on WebGPU by default, with the WebGL2 backend as fallback.
