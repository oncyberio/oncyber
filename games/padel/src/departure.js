// Leaving for the lobby: the mirror of the arrival view. The visitor is
// stood in the club (the walkable arrival state), the interface is hidden and
// the world fades to black around the lit avatar: the lobby's first frame on
// the way back is that same avatar on black, in the same place on screen.
// See docs/games/departure.md.
import * as THREE from "three";

const AVATAR_LAYER = 1;
export const FADE_S = 0.4;

/** Smooth 0..1 over the fade, for a clock that started at 0. */
export function fadeAt(seconds, duration = FADE_S) {
    if (!(duration > 0)) return 1;
    const t = Math.max(0, Math.min(1, seconds / duration));
    return t * t * (3 - 2 * t);
}

/**
 * The shot on screen in the arrival state, in the club's coordinates. `yaw` uses
 * the lobby's convention, which is also this game's: 0 faces -z.
 */
export function arrivalShot({
    cameraPosition,
    cameraLook,
    fov,
    feet,
    faceYaw,
    height,
}) {
    const p = (v) => ({ x: v.x, y: v.y, z: v.z });
    return {
        camera: { position: p(cameraPosition), target: p(cameraLook), fov },
        avatar: { feet: { x: feet.x, y: 0, z: feet.z }, yaw: faceYaw, height },
    };
}

/**
 * Draws the scene, a black veil over it, then the avatar alone on top.
 * At full fade the frame is the avatar on black and nothing else.
 */
export function createBlackout(renderer, scene) {
    const veil = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            fog: false,
            toneMapped: false,
        })
    );
    veil.frustumCulled = false;
    const veilScene = new THREE.Scene();
    veilScene.add(veil);
    const veilCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    let marked = null;
    return {
        /** `avatar` is the root of everything that stays lit. */
        render(camera, avatar, fade) {
            if (marked !== avatar) {
                marked = avatar;
                avatar.traverse((o) => o.layers.enable(AVATAR_LAYER));
                // Lights only reach objects on a layer they share.
                scene.traverse(
                    (o) => o.isLight && o.layers.enable(AVATAR_LAYER)
                );
            }
            const { autoClear } = renderer;
            const { background } = scene;
            const shadows = renderer.shadowMap.autoUpdate;
            if (fade < 1) {
                renderer.render(scene, camera);
                renderer.autoClear = false;
                veil.material.opacity = fade;
                renderer.render(veilScene, veilCamera);
                renderer.clearDepth();
                // The shadow maps of the pass above still hold.
                renderer.shadowMap.autoUpdate = false;
            } else {
                // Fully black: the world is not drawn at all.
                renderer.setClearColor(0x000000, 1);
            }
            scene.background = null;
            camera.layers.set(AVATAR_LAYER);
            renderer.render(scene, camera);
            camera.layers.set(0);
            scene.background = background;
            renderer.autoClear = autoClear;
            renderer.shadowMap.autoUpdate = shadows;
        },
    };
}
