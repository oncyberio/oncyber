import * as THREE from "three";
import { createWorldCubeReveal } from "./worldCubeReveal";

const anchor = { x: 0, y: 0, z: 0 };
function mesh() {
    return new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial()
    );
}
describe("world reveal skip diagnostics", () => {
    test("reports specific unsupported reasons without replacing the skipped mesh", () => {
        const scene = new THREE.Scene();
        const shader = new THREE.Mesh(
            new THREE.PlaneGeometry(),
            new THREE.ShaderMaterial()
        );
        const instanced = new THREE.Mesh(
            new THREE.InstancedBufferGeometry(),
            new THREE.MeshBasicMaterial()
        );
        const oversized = mesh();
        scene.add(shader, instanced, oversized);
        const onSkip = jest.fn();
        const effect = createWorldCubeReveal(
            THREE,
            [shader, instanced, oversized],
            {
                scene,
                anchor,
                maxTriangles: 1,
                onSkip,
            }
        );
        expect(onSkip.mock.calls).toEqual([
            [shader, "shader-material"],
            [instanced, "instanced"],
            [oversized, "source-triangle-budget"],
        ]);
        expect(effect.stats.skipped).toBe(3);
        expect(
            [shader, instanced, oversized].every((object) => !object.visible)
        ).toBe(true);
        effect.dispose();
        expect(
            [shader, instanced, oversized].every((object) => object.visible)
        ).toBe(true);
    });

    test("reports the precise clipping budget and ignores failing observers", () => {
        const scene = new THREE.Scene();
        const source = mesh();
        scene.add(source);
        const onSkip = jest.fn(() => {
            throw new Error("observer failed");
        });
        const effect = createWorldCubeReveal(THREE, [source], {
            scene,
            anchor,
            maxClipTests: 0,
            onSkip,
        });
        expect(onSkip).toHaveBeenCalledWith(source, "clipping work bound");
        expect(effect.stats).toMatchObject({
            cells: 0,
            triangles: 0,
            skipped: 1,
        });
        effect.setProgress(1);
        expect(source.visible).toBe(true);
        effect.dispose();
        expect(scene.children).toEqual([source]);
    });
});

describe("world reveal refinement diagnostics", () => {
    function fixture() {
        const scene = new THREE.Scene();
        const source = new THREE.Mesh(
            new THREE.PlaneGeometry(4, 4),
            new THREE.MeshBasicMaterial()
        );
        scene.add(source);
        const options = {
            scene,
            anchor,
            cellSize: 2,
            coverage: "all" as const,
            radius: 18,
            refinement: { minCellSize: 0.5, maxCellSize: 8 },
        };
        return { scene, source, options };
    }
    test("separates source complexity, coarse cuts and refinement clipping work", () => {
        const { source, options } = fixture();
        const effect = createWorldCubeReveal(THREE, [source], options);
        expect(effect.stats.sourceTriangles).toBe(2);
        expect(effect.stats.baseTriangles).toBeGreaterThan(
            effect.stats.sourceTriangles
        );
        expect(effect.stats.triangles).toBeGreaterThan(
            effect.stats.baseTriangles
        );
        expect(effect.stats.baseClipTests).toBeGreaterThan(0);
        expect(effect.stats.refinementClipTests).toBeGreaterThan(0);
        expect(effect.stats.clipTests).toBe(
            effect.stats.baseClipTests + effect.stats.refinementClipTests
        );
        expect(effect.stats.refinementLimit).toBe("none");
        effect.dispose();
    });
    test.each([
        ["maxTriangles", "triangles", "triangles"],
        ["maxCells", "cells", "cells"],
        ["maxFragments", "fragments", "fragments"],
        ["maxClipTests", "clipTests", "clipping"],
    ])(
        "reports the limiting resource for %s without treating preserved sources as skipped",
        (setting, statistic, reason) => {
            const { source, options } = fixture();
            const baseline = createWorldCubeReveal(THREE, [source], {
                ...options,
                refinement: undefined,
            });
            const bound = baseline.stats[statistic];
            baseline.dispose();
            const effect = createWorldCubeReveal(THREE, [source], {
                ...options,
                [setting]: bound,
            });
            expect(effect.stats.refinementLimit).toBe(reason);
            expect(effect.stats.refinementLimited).toBe(1);
            expect(effect.stats.sourceTriangles).toBe(2);
            expect(effect.stats.skipped).toBe(0);
            expect(effect.stats.baseTriangles).toBe(effect.stats.triangles);
            effect.dispose();
            expect(source.visible).toBe(true);
        }
    );
});
