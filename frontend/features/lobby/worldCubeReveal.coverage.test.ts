import * as THREE from "three";
import { createWorldCubeReveal } from "./worldCubeReveal";
import { buildRadialCellSchedule } from "./worldRadialReveal";

function surfaceArea(
    geometry: THREE.BufferGeometry,
    start = 0,
    count?: number
) {
    const position = geometry.attributes.position;
    const indexAt = (index: number) => geometry.index?.getX(index) ?? index;
    const end = start + (count ?? geometry.index?.count ?? position.count);
    let area = 0;
    for (let index = start; index < end; index += 3) {
        const vertices = [0, 1, 2].map((offset) =>
            new THREE.Vector3().fromBufferAttribute(
                position,
                indexAt(index + offset)
            )
        );
        area += new THREE.Triangle(
            vertices[0],
            vertices[1],
            vertices[2]
        ).getArea();
    }
    return area;
}
function batches(scene: THREE.Scene) {
    return scene
        .getObjectByName("native-world-cube-reveal")
        .children.filter((object) =>
            object.name.startsWith("world-batch:")
        ) as THREE.Mesh[];
}

test("complete coverage cuts distant floors and upper architecture without dropping their surface area or UVs", () => {
    const scene = new THREE.Scene();
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(2000, 2000),
        new THREE.MeshBasicMaterial()
    );
    floor.geometry.rotateX(-Math.PI / 2);
    floor.name = "floor";
    const ceiling = new THREE.Mesh(
        new THREE.PlaneGeometry(600, 200),
        floor.material
    );
    ceiling.geometry.rotateX(Math.PI / 2);
    ceiling.position.set(0, 120, -200);
    ceiling.name = "ceiling";
    scene.add(floor, ceiling);
    const onSkip = jest.fn();
    const effect = createWorldCubeReveal(THREE, [floor, ceiling], {
        scene,
        anchor: { x: 0, y: 0, z: 0 },
        coverage: "all",
        radius: 12,
        cellSize: 1,
        maxCells: 10000,
        maxTriangles: 90000,
        maxClipTests: 300000,
        onSkip,
    });
    expect(onSkip).not.toHaveBeenCalled();
    expect(effect.stats.cells).toBeGreaterThan(1000);
    expect(effect.stats.cells).toBeLessThan(10000);
    expect(effect.stats.maxDistance).toBeGreaterThan(1000);
    expect(effect.stats.maxCellSize).toBeGreaterThan(16);
    expect(effect.stats.levels).toBeGreaterThan(4);
    const ranges = batches(scene).flatMap(
        (mesh) => mesh.geometry.userData.worldRevealRanges
    );
    expect(ranges.some((range) => range.source === "ceiling")).toBe(true);
    expect(
        new Set(ranges.map((range) => range.cellKey.split(":")[0])).size
    ).toBeGreaterThan(4);
    effect.setProgress(1);
    let area = 0;
    for (const mesh of batches(scene)) {
        const geometry = mesh.geometry;
        area += surfaceArea(
            geometry,
            geometry.drawRange.start,
            geometry.drawRange.count
        );
        for (const range of geometry.userData.worldRevealRanges) {
            const position = geometry.attributes.position;
            const uv = geometry.attributes.uv;
            for (
                let index = range.start;
                index < range.start + range.count;
                index++
            ) {
                expect(uv.getX(index)).toBeCloseTo(
                    position.getX(index) /
                        (range.source === "floor" ? 2000 : 600) +
                        0.5,
                    5
                );
                if (range.source === "floor")
                    expect(uv.getY(index)).toBeCloseTo(
                        -position.getZ(index) / 2000 + 0.5,
                        5
                    );
                else {
                    expect(position.getY(index)).toBeCloseTo(120, 5);
                    expect(uv.getY(index)).toBeCloseTo(
                        (position.getZ(index) + 200) / 200 + 0.5,
                        5
                    );
                }
            }
        }
    }
    expect(area).toBeCloseTo(4120000, 1);
    effect.dispose();
    expect(scene.children).toEqual([floor, ceiling]);
    expect(floor.visible).toBe(true);
    expect(ceiling.visible).toBe(true);
});

test.each([-1, 1])(
    "a surface exactly on an adaptive shell boundary is retained once (side %s)",
    (side) => {
        const scene = new THREE.Scene();
        const geometry = new THREE.PlaneGeometry(40, 40);
        geometry.rotateY(Math.PI / 2);
        const wall = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
        wall.position.x = side * 4;
        scene.add(wall);
        const effect = createWorldCubeReveal(THREE, [wall], {
            scene,
            anchor: { x: 0, y: 0, z: 0 },
            coverage: "all",
            radius: 4,
            cellSize: 1,
        });
        expect(effect.stats.skipped).toBe(0);
        effect.setProgress(1);
        const area = batches(scene).reduce(
            (sum, mesh) =>
                sum +
                surfaceArea(
                    mesh.geometry,
                    mesh.geometry.drawRange.start,
                    mesh.geometry.drawRange.count
                ),
            0
        );
        expect(area).toBeCloseTo(1600, 4);
        effect.dispose();
    }
);

test("complete coverage keeps cell and clipping limits enforced and restores skipped sources", () => {
    const scene = new THREE.Scene();
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(2000, 2000),
        new THREE.MeshBasicMaterial()
    );
    scene.add(floor);
    const onSkip = jest.fn();
    const effect = createWorldCubeReveal(THREE, [floor], {
        scene,
        anchor: { x: 0, y: 0, z: 0 },
        coverage: "all",
        radius: 18,
        cellSize: 0.5,
        maxCells: 20,
        maxClipTests: 100,
        onSkip,
    });
    expect(effect.stats.cells).toBeLessThanOrEqual(20);
    expect(onSkip).toHaveBeenCalledWith(floor, expect.stringMatching(/bound/));
    effect.dispose();
    expect(floor.visible).toBe(true);
});

test("upper and distant tiles keep progressing through the whole schedule", () => {
    const cells = [0, 12, 24, 60, 120, 240, 500].map((distance) => ({
        key: String(distance),
        center: { x: 0, y: distance, z: 0 },
    }));
    const schedule = buildRadialCellSchedule(
        cells,
        { x: 0, y: 0, z: 0 },
        { radius: 18, fullRange: true }
    );
    const fractions = cells.map(
        ({ key }) => schedule.find((step) => step.key === key).fraction
    );
    expect(fractions[0]).toBe(0);
    expect(fractions[fractions.length - 1]).toBe(1);
    for (let index = 1; index < fractions.length; index++)
        expect(fractions[index]).toBeGreaterThan(fractions[index - 1]);
    expect(fractions[1]).toBeGreaterThan(0.1);
    expect(fractions[4]).toBeLessThan(0.7);
});
