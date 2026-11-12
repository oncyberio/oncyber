/**
 * Low quality leaves the reflector and the visible water out of the scene;
 * other qualities keep them in it. Runs every frame (Root.update), so it only
 * touches the scene graph when an object is not where it belongs: Object3D.add
 * on a current child would detach it, push it to the end of the children and
 * dispatch removed/added events on every frame.
 *
 * @typedef { import("three").Object3D } Object3D
 * @typedef { { reflector?: Object3D, water?: Object3D } } QualityMeshes
 * @param { import("three").Scene & QualityMeshes } scene
 * @param { boolean } lowQuality
 */
export function syncQualityMeshes(scene, lowQuality) {

    if (scene == null) return

    const { reflector, water } = scene

    if (lowQuality) {

        if (reflector && reflector.parent === scene) scene.remove(reflector)

        if (water?.visible && water.parent === scene) scene.remove(water)

        return
    }

    if (reflector && reflector.parent !== scene) scene.add(reflector)

    if (water?.visible && water.parent !== scene) scene.add(water)
}
