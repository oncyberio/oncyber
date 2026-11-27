/**
 * What a material with shader code of its own promises, to be drawn in a
 * crowd.
 *
 * A crowd draws one mesh for many avatars. It works on a copy of each
 * material (`material.clone()`), poses every instance from baked bone
 * matrices by moving `positionLocal` and `normalLocal` before the
 * instance's own transform, and fades avatars in through `opacityNode`.
 * It cannot tell what custom shader code relies on, so it only takes a
 * material with nodes of its own if the material says it keeps to this:
 *
 * - its nodes survive `clone()` and need nothing set on the copy;
 * - they read the resting mesh (`positionGeometry`, vertex attributes) and
 *   where the surface ends up (`positionView`, `normalView`), never the
 *   mesh's own skeleton or morph targets;
 * - it leaves `positionNode` and `opacityNode` alone.
 *
 * The mark is set in code only: nothing read from a model file can set it.
 * Kept free of imports, so the code that makes such materials can use it
 * without loading the lobby.
 */
const CROWD_MATERIAL = Symbol.for("oncyber.crowdMaterial");

/** Say that a crowd may draw this material. */
export function markCrowdMaterial<T extends object>(material: T): T {
    (material as Record<symbol, unknown>)[CROWD_MATERIAL] = true;
    return material;
}

/** Whether a material has said a crowd may draw it. */
export function isCrowdMaterial(material: unknown) {
    return (
        !!material &&
        (material as Record<symbol, unknown>)[CROWD_MATERIAL] === true
    );
}
