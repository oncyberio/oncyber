import type * as Three from "three";
import { createWorldCubeReveal } from "../worldCubeReveal";

/** Actual destination geometry in the avatar's scene; no image or screen mask. */
export function createTravelPreviewWorld(
    THREE: typeof Three,
    scene: Three.Scene
) {
    const group = new THREE.Group();
    group.name = "lobby-reveal-preview-world";
    scene.add(group);
    group.visible = false;
    const geometries: Three.BufferGeometry[] = [];
    const materials: Three.Material[] = [];
    const stone = new THREE.MeshStandardMaterial({
        color: 0xc6cdc6,
        roughness: 0.82,
    });
    const dark = new THREE.MeshStandardMaterial({
        color: 0x263532,
        roughness: 0.6,
    });
    const jade = new THREE.MeshStandardMaterial({
        color: 0x72b497,
        roughness: 0.34,
        metalness: 0.3,
    });
    const light = new THREE.MeshBasicMaterial({ color: 0xb6f1d5 });
    materials.push(stone, dark, jade, light);
    function box(
        x: number,
        y: number,
        z: number,
        w: number,
        h: number,
        d: number,
        material: Three.Material = stone
    ) {
        const geometry = new THREE.BoxGeometry(w, h, d);
        geometries.push(geometry);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        group.add(mesh);
        return mesh;
    }
    // Solid architectural surfaces make the rotating fragments readable in depth.
    box(0, -0.3, -3, 26, 0.6, 26);
    box(-8, 3.5, -11, 10, 7, 0.6);
    box(8, 3.5, -11, 10, 7, 0.6);
    box(0, 6, -11, 6, 2, 0.6);
    box(-12, 2.1, -4, 0.6, 4.2, 14, dark);
    box(12, 2.1, -4, 0.6, 4.2, 14, dark);
    for (const x of [-7, 7]) {
        for (const z of [-7, -1, 5]) {
            box(x, 2.7, z, 0.7, 5.4, 0.7);
            box(x, 5.3, z, 1.4, 0.25, 1.4, jade);
        }
        box(x, 5.5, -1, 0.9, 0.4, 14, dark);
        box(x, 0.035, -1, 0.08, 0.035, 18, light);
    }
    // A real sculpture and plinth behind the avatar, assembled by the same effect.
    box(0, 0.45, -6.5, 3, 0.9, 3, dark);
    const sculpture = box(0, 2.5, -6.5, 2.1, 2.1, 2.1, jade);
    sculpture.rotation.set(0.35, Math.PI / 4, 0.2);
    let reveal: ReturnType<typeof createWorldCubeReveal>;
    return {
        group,
        show(progress: number, anchor: Three.Vector3, yaw: number) {
            if (!reveal) {
                group.position.copy(anchor);
                group.rotation.y = yaw;
                group.visible = true;
                group.updateMatrixWorld(true);
                reveal = createWorldCubeReveal(THREE, [group], {
                    scene,
                    anchor,
                    cellSize: 0.5,
                    radius: 18,
                    maxCells: 12000,
                    maxFragments: 20000,
                    maxClipTests: 1000000,
                    maxTriangles: 90000,
                });
            }
            reveal.setProgress(progress);
        },
        hide() {
            reveal?.dispose();
            reveal = undefined;
            group.visible = false;
        },
        dispose() {
            reveal?.dispose();
            scene.remove(group);
            geometries.forEach((geometry) => geometry.dispose());
            materials.forEach((material) => material.dispose());
        },
    };
}
