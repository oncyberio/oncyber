import * as THREE from "three";
import { createWorldCubeReveal } from "./worldCubeReveal";

test("clips a thin diagonal architectural surface by occupied cells rather than its large empty volume", () => {
    const scene = new THREE.Scene();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
            [-10, -10, -10, 10, 10, 10, 10, 10.2, 9.8],
            3
        )
    );
    geometry.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2)
    );
    geometry.computeVertexNormals();
    const source = new THREE.InstancedMesh(
        geometry,
        new THREE.MeshBasicMaterial(),
        1
    );
    source.name = "LongDiagonalColumn";
    scene.add(source);
    const onSkip = jest.fn();
    const effect = createWorldCubeReveal(THREE, [source], {
        scene,
        anchor: { x: 0, y: 0, z: 0 },
        cellSize: 0.5,
        radius: 18,
        maxCells: 500,
        maxTriangles: 2000,
        maxClipTests: 2000,
        onSkip,
    });
    expect(onSkip).not.toHaveBeenCalled();
    expect(effect.stats.instances).toBe(1);
    expect(effect.stats.cells).toBeGreaterThan(40);
    expect(effect.stats.cells).toBeLessThan(500);
    expect(effect.stats.triangles).toBeLessThan(2000);
    effect.setProgress(1);
    const triangle = new THREE.Triangle(
        ...([0, 1, 2].map((index) =>
            new THREE.Vector3().fromBufferAttribute(
                geometry.attributes.position,
                index
            )
        ) as [THREE.Vector3, THREE.Vector3, THREE.Vector3])
    );
    let area = 0;
    const barycentric = new THREE.Vector3();
    scene.traverse((object) => {
        if (!object.name.startsWith("world-batch:")) return;
        const buffer = (object as THREE.Mesh).geometry;
        const position = buffer.attributes.position;
        const uv = buffer.attributes.uv;
        const start = buffer.drawRange.start;
        const end = start + buffer.drawRange.count;
        for (let index = start; index < end; index += 3) {
            const points = [0, 1, 2].map((offset) =>
                new THREE.Vector3().fromBufferAttribute(
                    position,
                    index + offset
                )
            );
            area += new THREE.Triangle(
                ...(points as [THREE.Vector3, THREE.Vector3, THREE.Vector3])
            ).getArea();
            for (let offset = 0; offset < 3; offset++) {
                triangle.getBarycoord(points[offset], barycentric);
                expect(uv.getX(index + offset)).toBeCloseTo(barycentric.y, 4);
                expect(uv.getY(index + offset)).toBeCloseTo(barycentric.z, 4);
            }
        }
    });
    expect(area).toBeCloseTo(triangle.getArea(), 4);
    effect.dispose();
    expect(source.visible).toBe(true);
    expect(source.geometry).toBe(geometry);
    expect(scene.children).toEqual([source]);
});
