import * as THREE from "three";
import { createWorldCubeReveal } from "./worldCubeReveal";

function build(
    geometry: THREE.BufferGeometry,
    material: any = new THREE.MeshBasicMaterial()
) {
    const scene = new THREE.Scene();
    const source = new THREE.Mesh(geometry, material);
    scene.add(source);
    const effect = createWorldCubeReveal(THREE, [source], {
        scene,
        anchor: { x: -1, y: -1, z: -1 },
        cellSize: 2,
        radius: 18,
        coverage: "all",
        refinement: { minCellSize: 0.5, maxCellSize: 8 },
    });
    const batches = scene
        .getObjectByName("native-world-cube-reveal")
        .children.filter((object) =>
            object.name.startsWith("world-batch:")
        ) as THREE.Mesh[];
    return { scene, source, effect, batches };
}

test("indexed architecture transforms shared vertices once while matching the uncached animated buffers", () => {
    const indexed = new THREE.PlaneGeometry(8, 8, 8, 8);
    const expanded = indexed.toNonIndexed();
    const normalReads = jest.spyOn(indexed.attributes.normal, "getX");
    const cached = build(indexed);
    const uncached = build(expanded);
    expect(normalReads).toHaveBeenCalledTimes(
        indexed.attributes.position.count
    );
    expect(cached.effect.stats.vertexTransforms).toBe(
        indexed.attributes.position.count
    );
    expect(cached.effect.stats.vertexCacheHits).toBe(
        indexed.index.count - indexed.attributes.position.count
    );
    expect(cached.effect.stats.clipSlabFastPaths).toBeGreaterThan(0);
    expect(cached.effect.stats.triangles).toBe(uncached.effect.stats.triangles);
    expect(cached.effect.stats.clipTests).toBe(uncached.effect.stats.clipTests);
    for (const progress of [0, 0.37, 1]) {
        cached.effect.setProgress(progress);
        uncached.effect.setProgress(progress);
        for (const name of Object.keys(cached.batches[0].geometry.attributes))
            expect(
                Array.from(cached.batches[0].geometry.attributes[name].array)
            ).toEqual(
                Array.from(uncached.batches[0].geometry.attributes[name].array)
            );
    }
    cached.effect.dispose();
    uncached.effect.dispose();
});

test("shared indices with generated face normals retain separate normals on adjoining faces", () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
            [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
            3
        )
    );
    geometry.setIndex([0, 1, 2, 0, 3, 1]);
    const { effect, batches } = build(geometry);
    expect(effect.stats.vertexCacheHits).toBe(0);
    expect(effect.stats.vertexTransforms).toBe(6);
    effect.setProgress(1);
    const normals = batches[0].geometry.attributes.normal;
    const seen = new Set<string>();
    for (let index = 0; index < normals.count; index++)
        seen.add(
            [
                normals.getX(index),
                normals.getY(index),
                normals.getZ(index),
            ].join(",")
        );
    expect(seen).toEqual(new Set(["0,0,1", "0,1,0"]));
    expect(geometry.attributes.normal).toBeUndefined();
    effect.dispose();
});

test("instance color is not reapplied to cached vertices shared by different material groups", () => {
    const scene = new THREE.Scene();
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(
            [0.2, 0.4, 0.6, 0.2, 0.4, 0.6, 0.2, 0.4, 0.6, 0.2, 0.4, 0.6],
            3
        )
    );
    geometry.clearGroups();
    geometry.addGroup(0, 3, 0);
    geometry.addGroup(3, 3, 1);
    const materials = [true, false].map(
        (vertexColors) => new THREE.MeshBasicMaterial({ vertexColors })
    );
    materials[0].name = "vertex-tinted";
    materials[1].name = "instance-only";
    const source = new THREE.InstancedMesh(geometry, materials, 1);
    source.setColorAt(0, new THREE.Color(0.5, 0.75, 1));
    scene.add(source);
    const effect = createWorldCubeReveal(THREE, [source], {
        scene,
        anchor: { x: -1, y: -1, z: -1 },
        cellSize: 2,
    });
    expect(effect.stats.vertexCacheHits).toBe(0);
    effect.setProgress(1);
    for (const mesh of scene.getObjectByName("native-world-cube-reveal")
        .children as THREE.Mesh[]) {
        if (!mesh.name.startsWith("world-batch:")) continue;
        const expected =
            (mesh.material as THREE.Material).name === "vertex-tinted"
                ? [0.1, 0.3, 0.6]
                : [0.5, 0.75, 1];
        const colors = mesh.geometry.attributes.color;
        for (
            let index = mesh.geometry.drawRange.start;
            index <
            mesh.geometry.drawRange.start + mesh.geometry.drawRange.count;
            index++
        ) {
            expect(colors.getX(index)).toBeCloseTo(expected[0]);
            expect(colors.getY(index)).toBeCloseTo(expected[1]);
            expect(colors.getZ(index)).toBeCloseTo(expected[2]);
        }
    }
    effect.dispose();
});
