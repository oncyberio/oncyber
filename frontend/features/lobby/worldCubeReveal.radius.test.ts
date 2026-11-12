import * as THREE from "three";
import { createWorldCubeReveal } from "./worldCubeReveal";

const anchor = { x: 0, y: 0, z: 0 };
function pieces(scene: THREE.Scene, name: string) {
    const matches: THREE.Mesh[] = [];
    scene.traverse((object) => {
        if (
            object.name.startsWith("world-batch:") &&
            object.userData.worldRevealSources.includes(name)
        )
            matches.push(object as THREE.Mesh);
    });
    return matches;
}

test("a kilometre-wide floor produces bounded nearby physical fragments", () => {
    const scene = new THREE.Scene();
    const geometry = new THREE.BoxGeometry(1000, 0.2, 1000);
    const originalPositions = Array.from(geometry.attributes.position.array);
    const floor = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    floor.name = "floor";
    floor.position.y = -0.1;
    scene.add(floor);
    const reveal = createWorldCubeReveal(THREE, [floor], {
        scene,
        anchor,
        cellSize: 0.5,
        radius: 18,
        maxCells: 12000,
        maxTriangles: 90000,
        maxClipTests: 1000000,
    });
    expect(reveal.stats.skipped).toBe(0);
    expect(reveal.stats.cells).toBeGreaterThan(4000);
    expect(reveal.stats.cells).toBeLessThanOrEqual(12000);
    expect(pieces(scene, "floor")).toHaveLength(1);
    expect(reveal.stats.drawCalls).toBe(3);
    expect(floor.visible).toBe(false);
    reveal.setProgress(0.8);
    const midPositions = Array.from(
        pieces(scene, "floor")[0].geometry.attributes.position.array
    );
    reveal.setProgress(1);
    expect(
        Array.from(pieces(scene, "floor")[0].geometry.attributes.position.array)
    ).not.toEqual(midPositions);
    scene.updateMatrixWorld(true);
    for (const mesh of pieces(scene, "floor")) {
        const p = mesh.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const world = new THREE.Vector3()
                .fromBufferAttribute(p as THREE.BufferAttribute, i)
                .applyMatrix4(mesh.matrixWorld);
            expect(Math.abs(world.x)).toBeLessThanOrEqual(19.6);
            expect(Math.abs(world.z)).toBeLessThanOrEqual(19.6);
        }
    }
    expect(floor.visible).toBe(true);
    expect(Array.from(geometry.attributes.position.array)).toEqual(
        originalPositions
    );
    reveal.dispose();
});

test("near floor receives the budget before earlier-loaded elevated decorations", () => {
    const scene = new THREE.Scene();
    const decor = new THREE.Group();
    for (let x = -2; x < 2; x++)
        for (let z = -2; z < 2; z++) {
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(0.4, 0.4, 0.4),
                new THREE.MeshBasicMaterial()
            );
            mesh.position.set(x + 0.5, 1.5, z + 0.5);
            decor.add(mesh);
        }
    const geometry = new THREE.PlaneGeometry(1000, 1000);
    geometry.rotateX(-Math.PI / 2);
    const floor = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    floor.name = "priority-floor";
    scene.add(decor, floor);
    const reveal = createWorldCubeReveal(THREE, [decor, floor], {
        scene,
        anchor,
        cellSize: 1,
        radius: 3,
        maxCells: 40,
    });
    expect(pieces(scene, "priority-floor")).toHaveLength(1);
    expect(
        pieces(
            scene,
            "priority-floor"
        )[0].geometry.userData.worldRevealRanges.filter(
            (range) => range.source === "priority-floor"
        ).length
    ).toBeGreaterThan(20);
    expect(reveal.stats.cells).toBeLessThanOrEqual(40);
    reveal.dispose();
    expect(floor.visible).toBe(true);
});
