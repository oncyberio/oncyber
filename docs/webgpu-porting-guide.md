# Porting a spaces-engine subsystem to WebGPU (three r180 + TSL)

This is the shared playbook for the port described in `docs/webgpu-port.md`.

## What changed underneath you

- The frontend has **one** three.js, `three@0.180.0`. The oncyber fork (r153) is gone.
  - `import … from "three"` gives the core classes.
  - Node materials, `WebGPURenderer`, `PostProcessing`, `RenderTarget` and friends come from `"three/webgpu"`.
  - TSL functions come from `"three/tsl"`.
  - All three entries share one core, so classes are identical across them.
- The engine's renderer (`components/_3DExhibit-v2/three/renderer.js`, alias `@3renderer`) is a `WebGPURenderer`.
  - It falls back to its WebGL2 backend when WebGPU is missing, or when the URL has `?renderer=webgl`.
  - TSL compiles to WGSL or GLSL. **Never write GLSL or WGSL strings, and never touch `getContext()` or `gl.*`.**
- `WebGPURenderer` **cannot draw `ShaderMaterial`, `RawShaderMaterial`, `onBeforeCompile` patches or `ShaderChunk`
  edits.** Those meshes simply don't render. Classic built-in materials still work, because three converts them
  to node materials automatically (`MeshBasicMaterial`, `MeshLambertMaterial`, `MeshStandardMaterial`,
  `SpriteMaterial`, `PointsMaterial`, `LineBasicMaterial`, and so on).
- Fog is global and node-based (`three/tsl/fog.js` in the engine). Any node material with `fog: true` gets the
  oncyber fog automatically. That fog is mixed in sRGB space and supports the env-texture fog. Don't re-implement
  fog in a material.
- Shadows: `renderer.shadowMap.autoUpdate` is forwarded to the registered light shadows (see `registerShadow` in
  `renderer.js`). Keep using it as before.
- `renderer.capabilities` is a small shim (`isWebGL2`, `precision`, `maxTextureSize`, `getMaxAnisotropy()`).
- These no longer exist: `renderer.state`, `renderer.extensions`, `renderer.properties`,
  `renderer.clippingPlanes`, `readRenderTargetPixels` (use `await renderer.readRenderTargetPixelsAsync(...)`),
  `WebGLRenderTarget` (use `RenderTarget` from `three/webgpu`; cube capture: `CubeCamera` + `WebGLCubeRenderTarget` render under WebGPURenderer, but `fromEquirectangularTexture` does not; feed equirect maps to `pmremTexture()` / `scene.environment` instead) and
  the r153 `copyTextureToTexture(position, src, dst)` signature (it is now
  `copyTextureToTexture(src, dst, srcRegion, dstPosition, srcLevel, dstLevel)`, and the source must be a real
  `Texture`).
- Renamed or removed in core: `XBufferGeometry` becomes `XGeometry`. `texture.encoding` / `sRGBEncoding` /
  `LinearEncoding` become `texture.colorSpace` with `SRGBColorSpace`, `LinearSRGBColorSpace` or `NoColorSpace`.
  `renderer.outputEncoding` becomes `outputColorSpace`. Also gone: `useLegacyLights`, `WebGL1Renderer`, and
  `material.extensions`.

## How to port a GLSL material

1. Replace the `ShaderMaterial` with a node material:
   - `MeshBasicNodeMaterial` for unlit.
   - `MeshLambertNodeMaterial` or `MeshStandardNodeMaterial` when the original used `lights: true`.
   - `SpriteNodeMaterial`, `PointsNodeMaterial` or `LineBasicNodeMaterial` where it fits.

   Keep the same class/export name and constructor signature, so callers don't change.
2. **Keep `material.uniforms`.** Engine code everywhere does `material.uniforms.foo.value = x`. Build
   `this.uniforms = { foo: uniform(initial) }` with TSL `uniform()` nodes (they expose `.value`) and read them in
   the node graph. Texture uniforms work the same way: `const map = texture(tex)` and `uniforms.map = map`, then
   `map.value = otherTexture`.
3. Build the graph in the constructor, or in `setup(builder)` when it depends on defines:
   - Vertex work goes in `positionNode` (local space), or `vertexNode` when you must output clip space.
   - Colour goes in `colorNode` (it is lit by lighting models). Use `outputNode` or `fragmentNode` for the exact
     final colour.
   - `opacityNode` and `alphaTestNode` handle alpha. `Discard()` / `If(cond, () => Discard())` replace `discard`.
   - Varyings: use `varying(node)` or `.toVarying()`. Vertex-stage-only values computed in `positionNode` are
     available through `varyingProperty`.
   - Attributes: `attribute("name", "vec3")`. Instanced attributes on an `InstancedBufferGeometry` are read the
     same way, or with `instancedBufferAttribute` / `instancedDynamicBufferAttribute` when you own the buffer.
   - Built-ins: `positionLocal`, `positionWorld`, `positionView`, `normalLocal`, `normalWorld`, `uv()`,
     `cameraPosition`, `modelWorldMatrix`, `cameraViewMatrix`, `cameraProjectionMatrix`, `screenUV`,
     `frontFacing`, `instanceIndex`, `vertexIndex`. Use `fwidth`/`dFdx`/`dFdy` and `time` (the renderer's
     elapsed seconds).
4. **Pipeline variants.** `abstract/pipelinemesh.js` (and its skinned, instanced, sprite and line siblings) still
   swap between `material`, `occlusionMaterial` and `mirrorMaterial`. They copy the diffuse material's `defines`
   onto the variant and add `defines.OCCLUSION` or `defines.MIRROR`. Node materials ignore `defines`, so read
   them yourself: override `setup(builder)`, branch in JS on `this.defines?.OCCLUSION` / `this.defines?.MIRROR`
   to pick the nodes, then call `super.setup(builder)`. Each variant is its own material object, so each gets its
   own cached pipeline. Swapping between them is cheap.
5. **Colour space parity.** The WebGL engine output a `ShaderMaterial`'s `gl_FragColor` as-is, unless the shader
   included the colour-space chunk (`#include <colorspace_fragment>`, `<encodings_fragment>`,
   `<output_fragment>`, `linearToOutputTexel`). Node materials always convert linear to sRGB at the end.
   - **If the original did not convert**, wrap its final colour in `sRGBTransferEOTF(...)` (sRGB to linear) so the
     final conversion gives back the same pixels.
   - **If it did convert**, use the colour as-is.
   - Textures follow `texture.colorSpace` automatically. A texture the original sampled as raw sRGB values with
     no decode (`colorSpace` unset) is still raw in TSL.
6. Fog: set `fog: true` exactly when the original included the fog chunks. Don't merge `UniformsLib.fog`.
7. Lit materials: map `lights: true` + `UniformsLib.lights` shaders onto a lit node material (`colorNode`,
   `normalNode`, `emissiveNode`, …). Don't hand-write light loops. **Light intensity:** WebGL used legacy lights,
   and r180 is physically based. The lobby uses a `Math.PI` light scale for parity (see
   `features/lobby/webgpu/backend.ts`, `lightScale`). If a lit material looks darker or brighter than on dev,
   check this before changing the shader.
8. Delete the `.glsl/.vert/.frag` files you replaced, and remove their imports.
9. Render targets and readback: use `RenderTarget` from `three/webgpu`. Read back with
   `await renderer.readRenderTargetPixelsAsync(rt, x, y, w, h)`. Note that WebGPU is not flipped relative to
   WebGL (`renderer.coordinateSystem === WebGPUCoordinateSystem`); check any "upside down" fix-ups.
10. Full-screen passes: use `QuadMesh` from `three/webgpu` with a node material, or the `PostProcessing` + TSL
    `pass()` pipeline. TSL ships `gaussianBlur`, `bloom`, `fxaa` and `smaa` among others; import them from
    `three/examples/jsm/tsl/display/*.js`.
11. Stencil and clipping: material-level `stencilWrite`, `stencilRef`, `stencilFunc`, `stencilZPass`,
    `colorWrite`, `depthWrite` and `depthFunc` all work. Global clipping planes become a `ClippingGroup`
    (`three/webgpu`).

## Prior art in this repo

- `features/lobby/webgpu/` is a WebGPU lobby: VRM avatars, an instanced animated crowd, TSL materials and a TSL
  grid floor.
- `features/videoStudio/engine/`.

## Verification

- The node-material class must construct without throwing. Building its graph with
  `material.setup` or `renderer.compileAsync` should not throw either.
- Grep that no `ShaderMaterial`, `RawShaderMaterial`, `onBeforeCompile`, `ShaderChunk`, `ShaderLib`,
  `UniformsLib`, `getContext()`, `.glsl` import or `WebGLRenderTarget` remains in your files.
- Run the jest tests that touch your files: `pnpm -C frontend exec jest <path>`.
- Visual verification against dev happens centrally in the browser. Note anything you could not verify.

## Gotcha: `float` / `int` imports

Next's SWC build renames identifiers that were reserved words in ES3 (`float`, `int`, `double`, `byte`, `short`,
`long`, `char`, `boolean`) and breaks the import binding at runtime ("_float is not defined"). Always alias them:
`import { float as tslFloat, int as tslInt } from "three/tsl"`.
