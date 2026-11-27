import { LoadingManager, MeshStandardMaterial } from "three";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import basisScript from "three/addons/libs/basis/basis_transcoder.js?url";
import basisWasm from "three/addons/libs/basis/basis_transcoder.wasm?url";
import { loadVRM } from "@oncyber/avatar-kit";

// Vite resolves the transcoder relative to this release, including when the
// game lives several directories below an Oncyber host.
export function avatarLoader(renderer) {
  const manager = new LoadingManager();
  manager.setURLModifier((url) =>
    url.endsWith("basis_transcoder.js")
      ? basisScript
      : url.endsWith("basis_transcoder.wasm")
        ? basisWasm
        : url,
  );
  const ktx = new KTX2Loader(manager)
    .setTranscoderPath("./")
    .setWorkerLimit(1)
    .detectSupport(renderer);
  async function load(bytes) {
    const vrm = await loadVRM(bytes, { ktx2: ktx });
    // MToon's GLSL material does not compile on Three's node backend.
    // Preserve the atlas, skinning, morphs, culling and alpha of each surface.
    const replacements = new Map();
    function supported(mat) {
      if (!mat.isShaderMaterial) return mat;
      if (replacements.has(mat)) return replacements.get(mat);
      const copy = new MeshStandardMaterial({
        name: mat.name,
        map: mat.map || null,
        roughness: 0.86,
        color: mat.color?.clone() || 0xffffff,
        transparent: mat.transparent,
        opacity: mat.opacity,
        alphaTest: mat.alphaTest,
        side: mat.side,
        depthWrite: mat.depthWrite,
        vertexColors: mat.vertexColors,
      });
      replacements.set(mat, copy);
      return copy;
    }
    vrm.scene.traverse((obj) => {
      if (!obj.isMesh) return;
      if (obj.material?.isOutline || obj.material?.userData?.isOutline) {
        obj.visible = false;
        return;
      }
      obj.material = Array.isArray(obj.material)
        ? obj.material.map(supported)
        : supported(obj.material);
      obj.receiveShadow = true;
    });
    const dispose = vrm.dispose;
    vrm.dispose = () => {
      dispose();
      for (const material of replacements.keys()) material.dispose();
    };
    return vrm;
  }
  return { load, dispose: () => ktx.dispose() };
}
