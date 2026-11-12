import * as THREE from "three";
import { createWorldCubeReveal } from "./worldCubeReveal";

const anchor = { x: 0, y: 0, z: 0 };
function batches(scene: THREE.Scene) {
    const result: THREE.Mesh[] = [];
    scene.traverse((object) => {
        if (object.name.startsWith("world-batch:"))
            result.push(object as THREE.Mesh);
    });
    return result;
}
function worldPositions(mesh: THREE.Mesh) {
    const position = mesh.geometry.getAttribute("position");
    return Array.from({ length: position.count }, (_, i) =>
        new THREE.Vector3()
            .fromBufferAttribute(position as THREE.BufferAttribute, i)
            .applyMatrix4(mesh.matrixWorld)
    );
}
function triangleArea(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) {
    return b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
}
function planarWorld() {
    const scene = new THREE.Scene();
    const geometry = new THREE.PlaneGeometry(2, 2);
    geometry.translate(1, 1, 0.25);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    mesh.name = "square-wall";
    scene.add(mesh);
    return { scene, mesh };
}

describe("small world tile batching independent audit", () => {
    it("replaces an aligned wall with half-metre physical tiles of equal total area", () => {
        const { scene, mesh } = planarWorld();
        const originalPositions = Array.from(
            mesh.geometry.attributes.position.array
        );
        const effect = createWorldCubeReveal(THREE, [mesh], {
            scene,
            anchor,
            cellSize: 0.5,
        });
        expect(mesh.visible).toBe(false);
        expect(effect.stats.cells).toBe(16);
        effect.setProgress(0.6);
        expect(mesh.visible).toBe(false);
        effect.setProgress(1);
        scene.updateMatrixWorld(true);
        const areas = new Map<string, number>();
        for (const batch of batches(scene)) {
            const vertices = worldPositions(batch);
            for (const range of batch.geometry.userData.worldRevealRanges) {
                const points = vertices.slice(
                    range.start,
                    range.start + range.count
                );
                const bounds = new THREE.Box3().setFromPoints(points);
                const size = bounds.getSize(new THREE.Vector3());
                expect(size.x).toBeLessThanOrEqual(0.50001);
                expect(size.y).toBeLessThanOrEqual(0.50001);
                expect(size.z).toBeLessThan(0.00001);
                let area = 0;
                for (let i = 0; i + 2 < points.length; i += 3)
                    area += triangleArea(
                        points[i],
                        points[i + 1],
                        points[i + 2]
                    );
                areas.set(
                    range.cellKey,
                    (areas.get(range.cellKey) || 0) + area
                );
            }
        }
        expect(areas.size).toBe(16);
        for (const area of areas.values()) expect(area).toBeCloseTo(0.25, 5);
        expect(Array.from(mesh.geometry.attributes.position.array)).toEqual(
            originalPositions
        );
        expect(mesh.visible).toBe(true);
        effect.dispose();
    });

    it("retains interpolated UV coordinates and restores final normal orientation", () => {
        const { scene, mesh } = planarWorld();
        mesh.rotation.set(0.3, 0.4, -0.2);
        mesh.scale.set(-1.4, 0.8, 1.2);
        mesh.position.set(1, -0.3, 0.8);
        scene.updateMatrixWorld(true);
        const inverse = mesh.matrixWorld.clone().invert();
        const expectedNormal = new THREE.Vector3(0, 0, 1).applyNormalMatrix(
            new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)
        );
        const effect = createWorldCubeReveal(THREE, [mesh], {
            scene,
            anchor,
            cellSize: 0.5,
        });
        effect.setProgress(0.53);
        effect.setProgress(1);
        scene.updateMatrixWorld(true);
        let area = 0;
        for (const batch of batches(scene)) {
            const positions = worldPositions(batch);
            const uv = batch.geometry.getAttribute("uv");
            const normal = batch.geometry.getAttribute("normal");
            const normalMatrix = new THREE.Matrix3().getNormalMatrix(
                batch.matrixWorld
            );
            positions.forEach((point, i) => {
                const local = point.clone().applyMatrix4(inverse);
                expect(uv.getX(i)).toBeCloseTo(local.x / 2, 5);
                expect(uv.getY(i)).toBeCloseTo(local.y / 2, 5);
                const n = new THREE.Vector3()
                    .fromBufferAttribute(normal as THREE.BufferAttribute, i)
                    .applyNormalMatrix(normalMatrix);
                expect(n.dot(expectedNormal)).toBeCloseTo(1, 5);
            });
            for (let i = 0; i + 2 < positions.length; i += 3)
                area += triangleArea(
                    positions[i],
                    positions[i + 1],
                    positions[i + 2]
                );
        }
        expect(area).toBeCloseTo(4 * 1.4 * 0.8, 4);
        effect.dispose();
    });

    it("batches many shared-material source meshes without one draw per cell", () => {
        const scene = new THREE.Scene();
        const material = new THREE.MeshStandardMaterial();
        const geometry = new THREE.PlaneGeometry(0.2, 0.2);
        const sources = Array.from({ length: 200 }, (_, i) => {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(
                (i % 20) * 0.5 + 0.25,
                Math.floor(i / 20) * 0.5 + 0.25,
                0.25
            );
            mesh.name = `source-${i}`;
            return mesh;
        });
        scene.add(...sources);
        const effect = createWorldCubeReveal(THREE, sources, {
            scene,
            anchor,
            cellSize: 0.5,
        });
        expect(effect.stats.cells).toBe(200);
        expect(effect.stats.batches).toBe(1);
        expect(effect.stats.drawCalls).toBeLessThanOrEqual(3);
        expect(batches(scene)).toHaveLength(1);
        expect(batches(scene)[0].material).toBe(material);
        expect(batches(scene)[0].userData.worldRevealSources).toHaveLength(200);
        expect(sources.every((source) => !source.visible)).toBe(true);
        effect.dispose();
        expect(sources.every((source) => source.visible)).toBe(true);
    });

    it("does not merge incompatible layer masks or render orders", () => {
        const scene = new THREE.Scene();
        const geometry = new THREE.PlaneGeometry(0.2, 0.2);
        const material = new THREE.MeshStandardMaterial();
        const sources = Array.from({ length: 3 }, (_, i) => {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(i + 0.25, 0.25, 0.25);
            return mesh;
        });
        sources[1].layers.set(2);
        sources[2].renderOrder = 4;
        scene.add(...sources);
        const effect = createWorldCubeReveal(THREE, sources, {
            scene,
            anchor,
            cellSize: 0.5,
        });
        expect(batches(scene)).toHaveLength(3);
        expect(
            batches(scene)
                .map((mesh) => `${mesh.layers.mask}:${mesh.renderOrder}`)
                .sort()
        ).toEqual(["1:0", "1:4", "4:0"]);
        effect.dispose();
    });

    it("preserves distinct world sort centres for transparent source batches", () => {
        const scene = new THREE.Scene();
        scene.position.set(3, 1, -2);
        scene.rotation.y = 0.3;
        const geometry = new THREE.PlaneGeometry(0.2, 0.2);
        geometry.translate(0.5, 0, 0);
        geometry.computeBoundingSphere();
        const material = new THREE.MeshStandardMaterial({
            transparent: true,
            opacity: 0.5,
        });
        const sources = [4, 9].map((z) => {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = `glass-${z}`;
            mesh.position.z = z;
            scene.add(mesh);
            return mesh;
        });
        scene.updateMatrixWorld(true);
        const expected = new Map(
            sources.map((source) => [
                source.name,
                geometry.boundingSphere.center
                    .clone()
                    .applyMatrix4(source.matrixWorld),
            ])
        );
        const effect = createWorldCubeReveal(THREE, sources, {
            scene,
            anchor,
            cellSize: 0.5,
        });
        scene.updateMatrixWorld(true);
        expect(batches(scene)).toHaveLength(2);
        for (const batch of batches(scene)) {
            expect(batch.geometry.boundingSphere).not.toBeNull();
            const actual = batch.geometry.boundingSphere.center
                .clone()
                .applyMatrix4(batch.matrixWorld);
            expect(
                actual.distanceTo(
                    expected.get(batch.userData.worldRevealSources[0])
                )
            ).toBeLessThan(0.00001);
        }
        effect.dispose();
    });

    it("rejects a source atomically when it exceeds the material batch budget", () => {
        const { scene, mesh } = planarWorld();
        const second = mesh.clone();
        second.material = new THREE.MeshStandardMaterial({ color: 0x123456 });
        second.name = "second-material";
        second.position.z = 1;
        scene.add(second);
        const effect = createWorldCubeReveal(THREE, [mesh, second], {
            scene,
            anchor,
            cellSize: 0.5,
            maxBatches: 1,
        });
        expect(effect.stats.batches).toBe(1);
        expect(effect.stats.skipped).toBe(1);
        expect(batches(scene)).toHaveLength(1);
        expect(batches(scene)[0].userData.worldRevealSources).not.toContain(
            second.name
        );
        expect(mesh.visible).toBe(false);
        expect(second.visible).toBe(false);
        effect.dispose();
        expect(mesh.visible).toBe(true);
        expect(second.visible).toBe(true);
    });

    it("keeps glow subject to depth occlusion and cleans transient resources on cancellation", () => {
        const { scene, mesh } = planarWorld();
        const sourceGeometryDispose = jest.spyOn(mesh.geometry, "dispose");
        const sourceMaterialDispose = jest.spyOn(mesh.material, "dispose");
        const effect = createWorldCubeReveal(THREE, [mesh], {
            scene,
            anchor,
            cellSize: 0.5,
        });
        const container = scene.getObjectByName("native-world-cube-reveal");
        const generatedGeometries = new Set<THREE.BufferGeometry>();
        const generatedMaterials = new Set<THREE.Material>();
        container.traverse((object) => {
            const piece = object as THREE.Mesh;
            if (!piece.isMesh) return;
            generatedGeometries.add(piece.geometry);
            const materials = Array.isArray(piece.material)
                ? piece.material
                : [piece.material];
            for (const material of materials)
                if (material !== mesh.material)
                    generatedMaterials.add(material);
        });
        const glow = [...generatedMaterials].filter(
            (material) => material.blending === THREE.AdditiveBlending
        );
        expect(glow.length).toBeGreaterThan(0);
        for (const material of glow) {
            expect(material.depthTest).toBe(true);
            expect(material.depthWrite).toBe(false);
        }
        const geometryDispose = [...generatedGeometries].map((geometry) =>
            jest.spyOn(geometry, "dispose")
        );
        const materialDispose = [...generatedMaterials].map((material) =>
            jest.spyOn(material, "dispose")
        );
        const textureDispose = glow.map((material) =>
            jest.spyOn((material as THREE.MeshBasicMaterial).map, "dispose")
        );
        const children = container.children.slice();
        effect.setProgress(0.4);
        const position = batches(scene)[0].geometry.getAttribute(
            "position"
        ) as THREE.BufferAttribute;
        const version = position.version;
        effect.setProgress(0.4);
        expect(position.version).toBe(version);
        effect.setProgress(0.7);
        expect(container.children).toEqual(children);
        effect.dispose();
        effect.dispose();
        effect.setProgress(0.8);
        expect(scene.children).toEqual([mesh]);
        expect(mesh.visible).toBe(true);
        for (const spy of [
            ...geometryDispose,
            ...materialDispose,
            ...textureDispose,
        ])
            expect(spy).toHaveBeenCalledTimes(1);
        expect(sourceGeometryDispose).not.toHaveBeenCalled();
        expect(sourceMaterialDispose).not.toHaveBeenCalled();
    });

    it("handles an 18-metre floor at half-metre resolution within bounded draws", () => {
        const scene = new THREE.Scene();
        const geometry = new THREE.PlaneGeometry(1000, 1000);
        geometry.rotateX(-Math.PI / 2);
        const floor = new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial()
        );
        floor.name = "large-floor";
        scene.add(floor);
        const started = performance.now();
        const effect = createWorldCubeReveal(THREE, [floor], {
            scene,
            anchor,
            radius: 18,
            cellSize: 0.5,
        });
        const buildMs = performance.now() - started;
        expect(effect.stats.skipped).toBe(0);
        expect(effect.stats.cells).toBeGreaterThan(4000);
        expect(effect.stats.cells).toBeLessThanOrEqual(12000);
        expect(effect.stats.triangles).toBeLessThanOrEqual(120000);
        expect(effect.stats.batches).toBe(1);
        expect(effect.stats.drawCalls).toBeLessThanOrEqual(3);
        const frameStarted = performance.now();
        for (let i = 0; i < 60; i++) effect.setProgress((i + 1) / 61);
        const updateMs = (performance.now() - frameStarted) / 60;
        // Informational CPU timings only: CI speed is not a rendering assertion.
        console.info("world-tile-audit", {
            ...effect.stats,
            buildMs: Math.round(buildMs),
            meanCpuUpdateMs: Number(updateMs.toFixed(2)),
        });
        effect.dispose();
    });
});
