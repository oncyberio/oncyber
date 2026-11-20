import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import type { VrmLike } from "./rig.ts";

/**
 * An Oncyber avatar (VRM 0 or 1) from the bytes `services.avatar()` returns.
 * It comes back facing +z. Pass a configured `KTX2Loader` as `ktx2` when
 * avatars may carry compressed textures. A game with its own glTF reader can
 * skip this file and give the kit a `load` function instead.
 */
export async function loadVRM(
    bytes: ArrayBuffer,
    options: { ktx2?: unknown } = {}
): Promise<VrmLike> {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    if (options.ktx2) loader.setKTX2Loader(options.ktx2 as any);
    loader.register((parser: any) => new VRMLoaderPlugin(parser));
    const gltf = await loader.parseAsync(bytes, "");
    const vrm = gltf.userData.vrm;
    if (!vrm?.humanoid?.getNormalizedBoneNode("hips")) {
        VRMUtils.deepDispose(gltf.scene);
        throw new Error("NOT_A_VRM");
    }
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.rotateVRM0(vrm);
    vrm.scene.traverse((o: any) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        // Skinned bounds are wrong once the rig moves.
        o.frustumCulled = false;
    });
    vrm.dispose = () => VRMUtils.deepDispose(vrm.scene);
    return vrm;
}
