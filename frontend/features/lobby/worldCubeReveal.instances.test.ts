import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { vec4 } from "three/tsl";
import { createWorldCubeReveal } from "./worldCubeReveal";

function triangle() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
            [0.2, 0.2, 0.5, 0.6, 0.2, 0.5, 0.2, 0.6, 0.5],
            3
        )
    );
    geometry.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2)
    );
    geometry.computeVertexNormals();
    return geometry;
}
function batches(scene: THREE.Scene) {
    const result: THREE.Mesh[] = [];
    scene.traverse((object) => {
        if (object.name.startsWith("world-batch:"))
            result.push(object as THREE.Mesh);
    });
    return result;
}
function matrices() {
    return [1, -1].map((sign, i) =>
        new THREE.Matrix4().compose(
            new THREE.Vector3(i * 2, i, i),
            new THREE.Quaternion().setFromEuler(
                new THREE.Euler(0.1, 0.2, 0.15)
            ),
            new THREE.Vector3(sign * 0.8, 0.5, 0.7)
        )
    );
}

describe("standard GPU instance world reveal", () => {
    test("bakes nested world and mirrored nonuniform instance transforms with original UVs/materials", () => {
        const scene = new THREE.Scene();
        scene.position.set(2, 0.5, -1);
        const source = new THREE.InstancedMesh(
            triangle(),
            new THREE.MeshStandardMaterial({ side: THREE.FrontSide }),
            2
        );
        source.name = "Architecture";
        source.position.set(0.5, 0.4, 0.3);
        source.scale.set(0.9, 1.1, 1);
        matrices().forEach((matrix, i) => source.setMatrixAt(i, matrix));
        scene.add(source);
        scene.updateMatrixWorld(true);
        const sourcePositions = Array.from(
            source.geometry.attributes.position.array
        );
        const sourceInstances = Array.from(source.instanceMatrix.array);
        const onInstance = jest.fn();
        const effect = createWorldCubeReveal(THREE, [source], {
            scene,
            anchor: { x: -2, y: -2, z: -2 },
            cellSize: 8,
            radius: 18,
            onInstance,
        });
        expect(effect.stats).toMatchObject({
            instances: 2,
            skipped: 0,
            batches: 1,
            triangles: 2,
        });
        expect(
            onInstance.mock.calls.map(([object, index]) => [
                object === source,
                index,
            ])
        ).toEqual([
            [true, 0],
            [true, 1],
        ]);
        effect.setProgress(1);
        scene.updateMatrixWorld(true);
        const batch = batches(scene)[0];
        expect(batch.material).toBe(source.material);
        for (const range of batch.geometry.userData.worldRevealRanges) {
            const index = Number(range.source.match(/\[(\d+)\]$/)[1]);
            const matrix = new THREE.Matrix4().multiplyMatrices(
                source.matrixWorld,
                matrices()[index]
            );
            const order = matrix.determinant() < 0 ? [0, 2, 1] : [0, 1, 2];
            const actual = order.map((vertex, i) => {
                const got = new THREE.Vector3()
                    .fromBufferAttribute(
                        batch.geometry.attributes.position,
                        range.start + i
                    )
                    .applyMatrix4(batch.matrixWorld);
                const expected = new THREE.Vector3()
                    .fromBufferAttribute(
                        source.geometry.attributes.position,
                        vertex
                    )
                    .applyMatrix4(matrix);
                expect(got.distanceTo(expected)).toBeLessThan(1e-5);
                expect(batch.geometry.attributes.uv.getX(range.start + i)).toBe(
                    source.geometry.attributes.uv.getX(vertex)
                );
                expect(batch.geometry.attributes.uv.getY(range.start + i)).toBe(
                    source.geometry.attributes.uv.getY(vertex)
                );
                return got;
            });
            const cross = actual[1]
                .clone()
                .sub(actual[0])
                .cross(actual[2].clone().sub(actual[0]))
                .normalize();
            const normal = new THREE.Vector3().fromBufferAttribute(
                batch.geometry.attributes.normal,
                range.start
            );
            expect(cross.dot(normal)).toBeCloseTo(1, 5);
        }
        expect(Array.from(source.geometry.attributes.position.array)).toEqual(
            sourcePositions
        );
        expect(Array.from(source.instanceMatrix.array)).toEqual(
            sourceInstances
        );
        effect.dispose();
        expect(source.visible).toBe(true);
        expect(scene.children).toEqual([source]);
    });

    test.each([true, false])(
        "preserves instance tint multiplied only by enabled vertex colors (%p)",
        (vertexColors) => {
            const scene = new THREE.Scene();
            const geometry = triangle();
            geometry.setAttribute(
                "color",
                new THREE.Float32BufferAttribute(
                    [0.2, 0.4, 0.8, 0.2, 0.4, 0.8, 0.2, 0.4, 0.8],
                    3
                )
            );
            const material = new THREE.MeshBasicMaterial({
                vertexColors,
                side: THREE.DoubleSide,
                map: new THREE.Texture(),
            });
            const source = new THREE.InstancedMesh(geometry, material, 2);
            source.name = "Tinted";
            const colors = [
                new THREE.Color(0.5, 1, 0.25),
                new THREE.Color(1, 0.5, 1),
            ];
            colors.forEach((color, i) => source.setColorAt(i, color));
            source.setMatrixAt(1, new THREE.Matrix4().makeTranslation(2, 0, 0));
            scene.add(source);
            const originalColor = Array.from(source.instanceColor.array);
            const materialDispose = jest.spyOn(material, "dispose");
            const geometryDispose = jest.spyOn(geometry, "dispose");
            const effect = createWorldCubeReveal(THREE, [source], {
                scene,
                anchor: { x: 0, y: 0, z: 0 },
                cellSize: 8,
            });
            effect.setProgress(1);
            const batch = batches(scene)[0];
            const cloned = batch.material as THREE.MeshBasicMaterial;
            expect(cloned).not.toBe(material);
            expect(cloned.map).toBe(material.map);
            expect(cloned.side).toBe(THREE.DoubleSide);
            expect(material.side).toBe(THREE.DoubleSide);
            expect(cloned.vertexColors).toBe(true);
            expect(material.vertexColors).toBe(vertexColors);
            for (const range of batch.geometry.userData.worldRevealRanges) {
                const index = Number(range.source.match(/\[(\d+)\]$/)[1]);
                const expected = colors[index]
                    .toArray()
                    .map(
                        (value, axis) =>
                            value * (vertexColors ? [0.2, 0.4, 0.8][axis] : 1)
                    );
                const actual = new THREE.Vector3()
                    .fromBufferAttribute(
                        batch.geometry.attributes.color,
                        range.start
                    )
                    .toArray();
                expected.forEach((value, axis) =>
                    expect(actual[axis]).toBeCloseTo(value, 6)
                );
            }
            const cloneDispose = jest.spyOn(cloned, "dispose");
            effect.dispose();
            effect.dispose();
            expect(cloneDispose).toHaveBeenCalledTimes(1);
            expect(materialDispose).not.toHaveBeenCalled();
            expect(geometryDispose).not.toHaveBeenCalled();
            expect(Array.from(source.instanceColor.array)).toEqual(
                originalColor
            );
            expect(source.visible).toBe(true);
        }
    );

    test("includes nearby floor and walls while ignoring distant instances before a small geometry budget", () => {
        const scene = new THREE.Scene();
        const source = new THREE.InstancedMesh(
            new THREE.PlaneGeometry(2, 2),
            new THREE.MeshBasicMaterial(),
            3
        );
        source.name = "Room";
        source.setMatrixAt(0, new THREE.Matrix4().makeTranslation(100, 0, 0));
        source.setMatrixAt(1, new THREE.Matrix4().makeRotationX(-Math.PI / 2));
        source.setMatrixAt(2, new THREE.Matrix4().makeTranslation(0, 1, -1));
        scene.add(source);
        const onInstance = jest.fn();
        const effect = createWorldCubeReveal(THREE, [source], {
            scene,
            anchor: { x: 0, y: 0, z: 0 },
            cellSize: 0.5,
            radius: 4,
            maxTriangles: 100,
            onInstance,
        });
        expect(effect.stats.instances).toBe(2);
        expect(effect.stats.cells).toBeGreaterThan(20);
        expect(onInstance.mock.calls.map(([, index]) => index).sort()).toEqual([
            1, 2,
        ]);
        effect.setProgress(0.5);
        expect(source.visible).toBe(false);
        effect.dispose();
        expect(source.visible).toBe(true);
        expect(source.count).toBe(3);
    });

    test.each(["count", "matrix", "budget"])(
        "bounds malformed or excessive instance %s before committing fragments",
        (reason) => {
            const scene = new THREE.Scene();
            const source = new THREE.InstancedMesh(
                triangle(),
                new THREE.MeshBasicMaterial(),
                2
            );
            if (reason === "count") source.count = 3;
            if (reason === "matrix") source.instanceMatrix.setX(1, NaN);
            const read = jest.spyOn(source, "getMatrixAt");
            scene.add(source);
            const onSkip = jest.fn();
            const effect = createWorldCubeReveal(THREE, [source], {
                scene,
                anchor: { x: 0, y: 0, z: 0 },
                maxInstances: reason === "budget" ? 1 : 10,
                onSkip,
            });
            expect(effect.stats).toMatchObject({
                instances: 0,
                cells: 0,
                triangles: 0,
                skipped: 1,
            });
            expect(onSkip).toHaveBeenCalledWith(
                source,
                reason === "count"
                    ? "invalid instance matrices"
                    : reason === "matrix"
                    ? "invalid instance matrix"
                    : "instance work bound"
            );
            if (reason !== "matrix") expect(read).not.toHaveBeenCalled();
            effect.dispose();
            expect(source.visible).toBe(true);
            expect(scene.children).toEqual([source]);
        }
    );

    test("keeps camera-facing native grass excluded without rejecting ordinary recoloured node materials", () => {
        class BillboardYMaterial extends THREE.MeshBasicMaterial {}
        const scene = new THREE.Scene();
        const grass = new THREE.InstancedMesh(
            triangle(),
            new BillboardYMaterial(),
            1
        );
        const recoloured = new MeshBasicNodeMaterial();
        recoloured.colorNode = vec4(0.5, 0.5, 0.5, 1);
        const architecture = new THREE.InstancedMesh(triangle(), recoloured, 1);
        scene.add(grass, architecture);
        const onSkip = jest.fn();
        const effect = createWorldCubeReveal(THREE, [grass, architecture], {
            scene,
            anchor: { x: 0, y: 0, z: 0 },
            cellSize: 8,
            onSkip,
        });
        expect(effect.stats.instances).toBe(1);
        expect(onSkip).toHaveBeenCalledWith(grass, "billboard-material");
        effect.dispose();
        expect(grass.visible).toBe(true);
        expect(architecture.visible).toBe(true);
    });
});
