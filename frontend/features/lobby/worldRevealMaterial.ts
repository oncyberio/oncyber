const MESH_NODE_FAMILIES = [
    "isMeshBasicNodeMaterial",
    "isMeshLambertNodeMaterial",
    "isMeshPhongNodeMaterial",
    "isMeshStandardNodeMaterial",
    "isMeshPhysicalNodeMaterial",
    "isMeshToonNodeMaterial",
    "isMeshMatcapNodeMaterial",
    "isMeshNormalNodeMaterial",
];
const VERTEX_NODES = [
    "vertexNode",
    "positionNode",
    "geometryNode",
    "fragmentNode",
];

/** Custom shaders cannot be cut into world-space tiles: their vertex stage
 * places the source geometry itself. On WebGL these were ShaderMaterials; on
 * WebGPU every engine material is a node material, so a custom shader is a
 * node material outside the built-in mesh families, or one that replaces the
 * vertex stage or the whole fragment. Built-in materials and mesh-family node
 * materials that only recolour (glTF, cyber terrain) remain tile sources. */
export function isWorldRevealShaderMaterial(material: any): boolean {
    if (!material) return false;
    if (material.isShaderMaterial || material.isRawShaderMaterial) return true;
    if (material.isNodeMaterial !== true) return false;
    if (!MESH_NODE_FAMILIES.some((flag) => material[flag] === true))
        return true;
    return VERTEX_NODES.some((name) => material[name] != null);
}

// Identity, plus what Material.copy() already deep-copies.
const IDENTITY = new Set([
    "uuid",
    "id",
    "type",
    "version",
    "_listeners",
    "userData",
]);

/** NodeMaterial.copy() transfers only the node slots, not map, color,
 * normalMap and the other classic properties. Copy those the same way
 * WebGPURenderer converts classic materials, owning mutable maths values. */
export function copyWorldRevealMaterial(target: any, source: any) {
    target.copy(source);
    if (source.isNodeMaterial)
        for (const key in source) {
            if (IDENTITY.has(key)) continue;
            const value = source[key];
            if (typeof value === "function") continue;
            target[key] =
                value?.isColor || value?.isVector2 || value?.isEuler
                    ? value.clone()
                    : key === "defines" && value
                    ? { ...value }
                    : value;
        }
    return target;
}

export function cloneWorldRevealMaterial(source: any) {
    return copyWorldRevealMaterial(new source.constructor(), source);
}
