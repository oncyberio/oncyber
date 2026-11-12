import * as THREE from "three";
import { createWorldCubeReveal } from "./worldCubeReveal";

// Some published galleries use the reverse side of double-sided walls as their
// interior. The transition must match that authored surface from either room.
test.each([
    ["arrival", "reveal", 0.999999, 1],
    ["departure", "dissolve", 0.000001, 1],
    ["mirrored arrival", "reveal", 0.999999, -1],
    ["mirrored departure", "dissolve", 0.000001, -1],
] as const)(
    "%s keeps both authored wall faces textured before the original mesh returns",
    (_label, mode, progress, scale) => {
        const scene = new THREE.Scene();
        const map = new THREE.Texture();
        const source = new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2),
            new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide })
        );
        source.scale.x = scale;
        scene.add(source);
        const effect = createWorldCubeReveal(THREE, [source], {
            scene,
            anchor: { x: 0, y: 0, z: 0 },
            cellSize: 8,
            mode,
        });
        try {
            effect.setProgress(progress);
            scene.updateMatrixWorld(true);
            const tiles = scene.getObjectByName("native-world-cube-reveal");
            expect(tiles.visible).toBe(true);
            expect(source.visible).toBe(false);
            const surfaces = tiles.children.filter(
                (child) =>
                    child.name.startsWith("world-batch:") ||
                    child.name === "world-tile-back"
            );
            for (const side of [-1, 1]) {
                const ray = new THREE.Raycaster(
                    new THREE.Vector3(0.17, 0.23, side * 2),
                    new THREE.Vector3(0, 0, -side)
                );
                const hits = ray.intersectObjects(surfaces, false);
                expect(hits.length).toBeGreaterThan(0);
                // No synthetic black backing may cover an authored interior face.
                for (const hit of hits)
                    expect(
                        (hit.object as THREE.Mesh<any, THREE.MeshBasicMaterial>)
                            .material.map
                    ).toBe(map);
            }
            expect(tiles.getObjectByName("world-tile-back")).toBeUndefined();
        } finally {
            effect.dispose();
        }
        expect(source.visible).toBe(true);
        expect(source.material.side).toBe(THREE.DoubleSide);
    }
);
