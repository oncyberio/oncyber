import * as THREE from "three";
import { createWorldCubeReveal } from "./worldCubeReveal";

function gallery(width = 200) {
    const scene = new THREE.Scene();
    const geometry = new THREE.PlaneGeometry(width, width);
    geometry.rotateX(-Math.PI / 2);
    const floor = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    floor.name = "floor";
    scene.add(floor);
    return { scene, floor };
}
const settings = {
    anchor: { x: 0, y: 0, z: 0 },
    coverage: "all" as const,
    radius: 18,
    cellSize: 2,
    maxCells: 12000,
    maxFragments: 20000,
    maxTriangles: 120000,
    maxClipTests: 1000000,
    refinement: { minCellSize: 0.5, maxCellSize: 8, detailRadius: 8 },
};
function inspect(scene: THREE.Scene, expectedWidth: number) {
    let area = 0;
    for (const mesh of scene.getObjectByName("native-world-cube-reveal")
        .children as THREE.Mesh[]) {
        if (!mesh.name.startsWith("world-batch:")) continue;
        const geometry = mesh.geometry;
        const position = geometry.attributes.position;
        const uv = geometry.attributes.uv;
        const end = geometry.drawRange.start + geometry.drawRange.count;
        for (let index = geometry.drawRange.start; index < end; index += 3) {
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
                expect(uv.getX(index + offset)).toBeCloseTo(
                    points[offset].x / expectedWidth + 0.5,
                    5
                );
                expect(uv.getY(index + offset)).toBeCloseTo(
                    -points[offset].z / expectedWidth + 0.5,
                    5
                );
            }
        }
    }
    return area;
}

test("bounded refinement gives wide architecture small nearby squares and smaller distant panels without holes or UV changes", () => {
    const { scene, floor } = gallery();
    const effect = createWorldCubeReveal(THREE, [floor], {
        ...settings,
        scene,
    });
    expect(effect.stats.skipped).toBe(0);
    expect(effect.stats.refinedCells).toBeGreaterThan(0);
    expect(effect.stats.minCellSize).toBe(0.5);
    expect(effect.stats.maxCellSize).toBeLessThanOrEqual(8);
    expect(effect.stats.triangles).toBeLessThanOrEqual(settings.maxTriangles);
    expect(effect.stats.cells).toBeLessThanOrEqual(settings.maxCells);
    effect.setProgress(1);
    expect(inspect(scene, 200)).toBeCloseTo(40000, 3);
    effect.dispose();
    expect(scene.children).toEqual([floor]);
    expect(floor.visible).toBe(true);
});

test.each(["maxTriangles", "maxCells", "maxFragments"] as const)(
    "exhausting %s retains every coarse source cell instead of dropping architecture",
    (budget) => {
        const { scene, floor } = gallery(40);
        const baseline = createWorldCubeReveal(THREE, [floor], {
            ...settings,
            scene,
            refinement: undefined,
        });
        const limits = {
            maxTriangles: baseline.stats.triangles,
            maxCells: baseline.stats.cells,
            maxFragments: baseline.stats.fragments,
        };
        baseline.dispose();
        const onSkip = jest.fn();
        const effect = createWorldCubeReveal(THREE, [floor], {
            ...settings,
            scene,
            [budget]: limits[budget],
            onSkip,
        });
        expect(onSkip).not.toHaveBeenCalled();
        expect(effect.stats.refinementLimited).toBe(1);
        const stat = {
            maxTriangles: "triangles",
            maxCells: "cells",
            maxFragments: "fragments",
        }[budget];
        expect(effect.stats[stat]).toBeLessThanOrEqual(limits[budget]);
        effect.setProgress(1);
        expect(inspect(scene, 40)).toBeCloseTo(1600, 4);
        effect.dispose();
    }
);

test("coplanar cell boundaries are not doubled and shared materials use identical tile keys", () => {
    const { scene, floor } = gallery(8);
    const other = floor.clone();
    other.material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    other.name = "second-material";
    scene.add(other);
    const effect = createWorldCubeReveal(THREE, [floor, other], {
        ...settings,
        scene,
    });
    effect.setProgress(1);
    expect(inspect(scene, 8)).toBeCloseTo(128, 5);
    const keys = scene
        .getObjectByName("native-world-cube-reveal")
        .children.filter((mesh) => mesh.name.startsWith("world-batch:"))
        .map(
            (mesh: THREE.Mesh) =>
                new Set(
                    mesh.geometry.userData.worldRevealRanges.map(
                        (range) => range.cellKey
                    )
                )
        );
    expect(keys).toHaveLength(2);
    expect(keys[0]).toEqual(keys[1]);
    expect(effect.stats.minCellSize).toBe(0.5);
    effect.dispose();
});

test("one multi-material source counts each new source-cell fragment even when its material piece count stays constant", () => {
    const scene = new THREE.Scene();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
            [
                0.1, 0.1, 0.1, 0.3, 0.1, 0.1, 0.1, 0.3, 0.1, 1.1, 0.1, 0.1, 1.3,
                0.1, 0.1, 1.1, 0.3, 0.1,
            ],
            3
        )
    );
    geometry.addGroup(0, 3, 0);
    geometry.addGroup(3, 3, 1);
    const source = new THREE.Mesh(geometry, [
        new THREE.MeshBasicMaterial(),
        new THREE.MeshBasicMaterial(),
    ]);
    scene.add(source);
    const effect = createWorldCubeReveal(THREE, [source], {
        ...settings,
        scene,
        maxFragments: 1,
    });
    expect(effect.stats).toMatchObject({
        skipped: 0,
        triangles: 2,
        cells: 1,
        fragments: 1,
        refinedCells: 0,
        refinementLimited: 1,
    });
    effect.setProgress(1);
    expect(source.visible).toBe(true);
    effect.dispose();
});

test.each([0, 6])(
    "stops refinement immediately when the triangle ceiling is reached (+%s triangles)",
    (spareTriangles) => {
        const { scene, floor } = gallery(40);
        const baseline = createWorldCubeReveal(THREE, [floor], {
            ...settings,
            scene,
            refinement: undefined,
        });
        const coarseCells = baseline.stats.cells;
        const maxTriangles = baseline.stats.triangles + spareTriangles;
        baseline.dispose();
        const effect = createWorldCubeReveal(THREE, [floor], {
            ...settings,
            scene,
            maxTriangles,
        });
        expect(effect.stats.triangles).toBe(maxTriangles);
        expect(effect.stats.refinementAttempts).toBe(spareTriangles ? 1 : 0);
        expect(effect.stats.refinementAttempts).toBeLessThan(coarseCells);
        expect(effect.stats.refinedCells).toBe(spareTriangles ? 1 : 0);
        expect(effect.stats.refinementLimited).toBe(1);
        expect(effect.stats.skipped).toBe(0);
        effect.setProgress(1);
        expect(inspect(scene, 40)).toBeCloseTo(1600, 4);
        effect.dispose();
    }
);

function focusedRoom(denseBack = true) {
    const scene = new THREE.Scene();
    const front = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 4),
        new THREE.MeshBasicMaterial()
    );
    front.name = "visible-wall";
    front.position.set(0, 1, -3);
    const back = new THREE.Mesh(
        denseBack
            ? new THREE.PlaneGeometry(8, 8, 60, 60)
            : new THREE.PlaneGeometry(4, 4),
        new THREE.MeshBasicMaterial()
    );
    back.name = "back-wall";
    back.position.set(0, 1, denseBack ? 4 : 3);
    scene.add(front, back);
    return { scene, roots: [front, back] };
}
function sourceCells(scene: THREE.Scene) {
    const result: Record<string, Set<string>> = {};
    for (const mesh of scene.getObjectByName("native-world-cube-reveal")
        .children as THREE.Mesh[]) {
        if (!mesh.name.startsWith("world-batch:")) continue;
        for (const range of mesh.geometry.userData.worldRevealRanges)
            (result[range.source] ??= new Set()).add(range.cellKey);
    }
    return result;
}
function surfaceArea(scene: THREE.Scene) {
    let area = 0;
    const points = [
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
    ] as const;
    const triangle = new THREE.Triangle(...points);
    for (const mesh of scene.getObjectByName("native-world-cube-reveal")
        .children as THREE.Mesh[]) {
        if (!mesh.name.startsWith("world-batch:")) continue;
        const positions = mesh.geometry.attributes.position;
        for (
            let index = mesh.geometry.drawRange.start;
            index <
            mesh.geometry.drawRange.start + mesh.geometry.drawRange.count;
            index += 3
        ) {
            points.forEach((point, offset) =>
                point.fromBufferAttribute(positions, index + offset)
            );
            area += triangle.getArea();
        }
    }
    return area;
}

test("camera priority reaches quarter-metre visible squares before dense offscreen cells consume the same triangle ceiling", () => {
    const coarse = focusedRoom();
    const baseline = createWorldCubeReveal(THREE, coarse.roots, {
        ...settings,
        scene: coarse.scene,
        refinement: undefined,
    });
    const ceiling = baseline.stats.triangles + 600;
    baseline.dispose();
    const build = (focused: boolean) => {
        const fixture = focusedRoom();
        const effect = createWorldCubeReveal(THREE, fixture.roots, {
            ...settings,
            scene: fixture.scene,
            maxTriangles: ceiling,
            refinement: {
                minCellSize: 0.25,
                maxCellSize: 8,
                detailRadius: 8,
                ...(focused
                    ? {
                          focus: { x: 0, y: 1, z: 0 },
                          forward: { x: 0, y: 0, z: -1 },
                      }
                    : {}),
            },
        });
        return { ...fixture, effect, counts: sourceCells(fixture.scene) };
    };
    const broad = build(false),
        focused = build(true);
    expect(focused.counts["visible-wall"].size).toBeGreaterThan(
        broad.counts["visible-wall"].size * 4
    );
    expect(focused.counts["back-wall"].size).toBeLessThan(
        broad.counts["back-wall"].size
    );
    expect(focused.effect.stats.minCellSize).toBe(0.25);
    expect(focused.effect.stats.viewCellSizeCounts["0.25"]).toBeGreaterThan(
        100
    );
    expect(focused.effect.stats.viewCells).toBe(
        focused.counts["visible-wall"].size
    );
    expect(focused.effect.stats.drawCalls).toBe(broad.effect.stats.drawCalls);
    for (const { scene, roots, effect } of [broad, focused]) {
        expect(effect.stats.triangles).toBeLessThanOrEqual(ceiling);
        expect(effect.stats.cells).toBeLessThanOrEqual(settings.maxCells);
        expect(effect.stats.fragments).toBeLessThanOrEqual(
            settings.maxFragments
        );
        expect(effect.stats.clipTests).toBeLessThanOrEqual(
            settings.maxClipTests
        );
        expect(effect.stats.skipped).toBe(0);
        effect.setProgress(1);
        expect(surfaceArea(scene)).toBeCloseTo(80, 4);
        effect.dispose();
        expect(scene.children).toEqual(roots);
        expect(roots.every((root) => root.visible)).toBe(true);
    }
});

test.each([-1, 1])(
    "view direction %s gives its facing wall detail while preserving the complete reverse surface",
    (z) => {
        const fixture = focusedRoom(false);
        const baseline = createWorldCubeReveal(THREE, fixture.roots, {
            ...settings,
            scene: fixture.scene,
            refinement: undefined,
        });
        const ceiling = baseline.stats.triangles + 300;
        baseline.dispose();
        const effect = createWorldCubeReveal(THREE, fixture.roots, {
            ...settings,
            scene: fixture.scene,
            maxTriangles: ceiling,
            refinement: {
                minCellSize: 0.25,
                maxCellSize: 8,
                focus: { x: 0, y: 1, z: 0 },
                forward: { x: 0, y: 0, z },
            },
        });
        const counts = sourceCells(fixture.scene);
        const facing = z < 0 ? "visible-wall" : "back-wall";
        const reverse = z < 0 ? "back-wall" : "visible-wall";
        expect(counts[facing].size).toBeGreaterThan(counts[reverse].size * 4);
        expect(effect.stats.viewCellSizeCounts["0.25"]).toBeGreaterThan(0);
        expect(effect.stats.triangles).toBeLessThanOrEqual(ceiling);
        effect.setProgress(1);
        expect(surfaceArea(fixture.scene)).toBeCloseTo(32, 4);
        effect.dispose();
    }
);

test("non-finite view hints fall back to the established distance refinement", () => {
    const build = (focus?: { x: number; y: number; z: number }) => {
        const fixture = focusedRoom(false);
        const effect = createWorldCubeReveal(THREE, fixture.roots, {
            ...settings,
            scene: fixture.scene,
            refinement: {
                ...settings.refinement,
                focus,
                forward: { x: 0, y: 0, z: -1 },
            },
        });
        const result = {
            stats: { ...effect.stats },
            cells: sourceCells(fixture.scene),
        };
        effect.dispose();
        return result;
    };
    expect(build({ x: NaN, y: 1, z: 0 })).toEqual(build());
});
