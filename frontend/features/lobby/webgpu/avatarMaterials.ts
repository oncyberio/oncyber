import * as THREE from "three/webgpu";

import {
    MeshLambertNodeMaterial,
    MeshBasicNodeMaterial,
    NodeMaterial,
} from "three/webgpu";
import { avatarLighting, isAvatarLighting } from "./avatarLighting";
import {
    collectAvatarTextures,
    disposeAvatarTextures,
} from "./avatarResources";

const NATIVE_MATERIAL_TYPES = new Set([
    "MeshStandardMaterial",
    "MeshPhysicalMaterial",
    "MeshBasicMaterial",
    "MeshLambertMaterial",
]);

/** Custom shaders keep ordinary VRM playback; crowd shaders cannot preserve them. */
export function supportsNativeAvatarMaterial(material: THREE.Material) {
    if (!material) return false;
    const node = material as NodeMaterial;
    if (node.isNodeMaterial) {
        return (
            ["MeshLambertNodeMaterial", "MeshBasicNodeMaterial"].includes(
                material.type
            ) &&
            material.onBeforeCompile ===
                THREE.Material.prototype.onBeforeCompile &&
            material.customProgramCacheKey ===
                NodeMaterial.prototype.customProgramCacheKey &&
            !Object.keys(node).some(
                (key) =>
                    key.endsWith("Node") &&
                    node[key] != null &&
                    !(key === "lightsNode" && isAvatarLighting(node[key]))
            )
        );
    }
    return (
        NATIVE_MATERIAL_TYPES.has(material.type) &&
        material.onBeforeCompile === THREE.Material.prototype.onBeforeCompile &&
        material.customProgramCacheKey ===
            THREE.Material.prototype.customProgramCacheKey
    );
}

function copyAvatarSurface(source: THREE.Material, material: THREE.Material) {
    const input = source as unknown as Record<string, unknown>;
    const output = material as unknown as Record<string, unknown>;
    for (const key of [
        "map",
        "lightMap",
        "lightMapIntensity",
        "aoMap",
        "aoMapIntensity",
        "emissiveMap",
        "emissiveIntensity",
        "bumpMap",
        "bumpScale",
        "normalMap",
        "normalMapType",
        "displacementMap",
        "displacementScale",
        "displacementBias",
        "alphaMap",
        "wireframe",
        "wireframeLinewidth",
        "wireframeLinecap",
        "wireframeLinejoin",
        "flatShading",
        "fog",
    ]) {
        if (input[key] !== undefined) output[key] = input[key];
    }
    if ((input.color as THREE.Color)?.isColor)
        output.color = (input.color as THREE.Color).clone();
    if ((input.emissive as THREE.Color)?.isColor)
        output.emissive = (input.emissive as THREE.Color).clone();
    if ((input.normalScale as THREE.Vector2)?.isVector2)
        output.normalScale = (input.normalScale as THREE.Vector2).clone();
}

/** NodeMaterial.copy does not copy the classic surface maps/color fields. */
export function cloneNativeAvatarMaterial<T extends THREE.Material>(
    source: T
): T {
    const clone = source.clone() as T;
    copyAvatarSurface(source, clone);
    // NodeMaterial.copy already preserves node expressions and generic render state.
    // These are classic Lambert/Basic fields retained by our native diffuse path.
    for (const key of [
        "envMap",
        "envMapIntensity",
        "reflectivity",
        "refractionRatio",
        "combine",
    ]) {
        if (source[key] !== undefined) clone[key] = source[key];
    }
    return clone;
}

/** Match the reference VRM Lambert path while keeping the original authored channels. */
export function applyNativeAvatarMaterials(
    root: THREE.Object3D,
    lightScale = Math.PI
) {
    const replacements = new Map<THREE.Material, THREE.Material>();
    const retainedTextures = new Set<THREE.Texture>();
    const replacedTextures = new Set<THREE.Texture>();
    const retainedMaterials = new Set<THREE.Material>();

    const convert = (source: THREE.Material) => {
        const existing = replacements.get(source);
        if (existing) return existing;
        if (
            (source as NodeMaterial).isNodeMaterial ||
            !supportsNativeAvatarMaterial(source)
        )
            return source;

        const material =
            source.type === "MeshBasicMaterial"
                ? new MeshBasicNodeMaterial()
                : new MeshLambertNodeMaterial();
        // Copy generic alpha, blending, vertex-color and clipping settings.
        // NodeMaterial.copy expects node-only fields; copy shared Material data first.
        THREE.Material.prototype.copy.call(material, source);
        // Both native VRM pipelines enable depth writes even for BLEND assets.
        // Pepe's body and glasses share one such material: GLTF's default false
        // lets farther face/body triangles paint over the visible surfaces.
        // Keep authored opacity/alpha blending, but restore native occlusion.
        material.depthWrite = true;
        material.depthTest = true;
        copyAvatarSurface(source, material);
        // Native VRMs use diffuse lighting, without metallic/environment response.
        material.envMap = null;
        material.reflectivity = 0;
        if (material instanceof MeshLambertNodeMaterial)
            material.lightsNode = avatarLighting(lightScale);
        replacements.set(source, material);
        return material;
    };

    root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map(convert)
            : convert(mesh.material);
        const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
        materials.forEach((material) => retainedMaterials.add(material));
    });
    retainedMaterials.forEach((material) =>
        collectAvatarTextures(material, retainedTextures)
    );
    replacements.forEach((_replacement, original) => {
        collectAvatarTextures(original, replacedTextures);
        original.dispose();
    });
    // Metalness/roughness maps can share a texture with retained color/AO maps,
    // or a custom shader. Only release textures no resulting material references.
    disposeAvatarTextures(replacedTextures, retainedTextures);
}
