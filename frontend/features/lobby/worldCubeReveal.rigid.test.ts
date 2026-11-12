import * as THREE from "three";
import { createWorldCubeReveal } from "./worldCubeReveal";

const rigidProps = {
    minTriangles: 100,
    maxExtent: 5,
    maxSources: 8,
    maxTriangles: 8000,
};
const settings = {
    anchor: { x: 0, y: 0, z: 0 },
    coverage: "all" as const,
    cellSize: 2,
    maxTriangles: 1000,
    rigidProps,
};
function denseProp() {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 32, 16),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
    );
    mesh.name = "statue";
    return mesh;
}
function proxies(scene: THREE.Scene) {
    return scene
        .getObjectByName("native-world-cube-reveal")
        .children.filter((object) =>
            object.name.startsWith("world-rigid:")
        ) as THREE.Mesh[];
}
function stepFor(scene: THREE.Scene, proxy: THREE.Mesh) {
    return scene
        .getObjectByName("native-world-cube-reveal")
        .userData.worldRevealSchedule.find(
            (step) => step.key === proxy.userData.worldRevealRigidKey
        );
}
function expectMatrix(actual: THREE.Matrix4, expected: THREE.Matrix4) {
    actual.elements.forEach((value, index) =>
        expect(value).toBeCloseTo(expected.elements[index], 10)
    );
}

test("dense compact props reuse source buffers without consuming architectural cut budgets", () => {
    const scene = new THREE.Scene();
    const prop = denseProp();
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 8),
        new THREE.MeshBasicMaterial()
    );
    floor.rotateX(-Math.PI / 2);
    scene.add(prop, floor);
    const effect = createWorldCubeReveal(THREE, [scene], {
        ...settings,
        scene,
        refinement: { minCellSize: 0.5, maxCellSize: 4, detailRadius: 8 },
    });
    expect(effect.stats).toMatchObject({
        rigidSources: 1,
        rigidTriangles: 960,
        sourceTriangles: 2,
        skipped: 0,
    });
    expect(effect.stats.cells).toBeGreaterThan(100);
    expect(effect.stats.triangles).toBeLessThanOrEqual(settings.maxTriangles);
    const [proxy] = proxies(scene);
    expect(proxy.geometry).toBe(prop.geometry);
    const container = proxy.parent;
    expect(container.userData.worldRevealSchedule).toHaveLength(
        effect.stats.cells + 1
    );
    expect(
        container.children
            .filter((mesh) => mesh.name.startsWith("world-batch:"))
            .every(
                (mesh: THREE.Mesh) =>
                    !mesh.userData.worldRevealSources.includes(prop.name)
            )
    ).toBe(true);
    effect.dispose();
});

test.each(["reveal", "dissolve"] as const)(
    "%s restores nested mirrored transforms and visibility without owning original resources",
    (mode) => {
        const scene = new THREE.Scene();
        scene.position.set(2, 1, -1);
        scene.rotation.set(0.15, -0.2, 0.05);
        const parent = new THREE.Group();
        parent.position.set(1, 2, -3);
        parent.rotation.set(-0.1, 0.2, -0.3);
        parent.scale.set(-1.2, 0.75, 1.1);
        const prop = denseProp();
        prop.position.set(0.1, -0.2, 0.3);
        prop.rotation.set(0.3, 0.1, -0.2);
        prop.layers.set(2);
        prop.renderOrder = 7;
        prop.receiveShadow = true;
        parent.add(prop);
        scene.add(parent);
        scene.updateMatrixWorld(true);
        const originalWorld = prop.matrixWorld.clone();
        const originalLocal = prop.matrix.clone();
        const originalPositions = Array.from(
            prop.geometry.attributes.position.array
        );
        const geometryDispose = jest.spyOn(prop.geometry, "dispose");
        const materialDispose = jest.spyOn(prop.material, "dispose");
        const effect = createWorldCubeReveal(THREE, [parent], {
            ...settings,
            scene,
            mode,
        });
        const [proxy] = proxies(scene);
        const cloneDispose = jest.spyOn(
            proxy.material as THREE.Material,
            "dispose"
        );
        const step = stepFor(scene, proxy);
        expect(proxy.geometry).toBe(prop.geometry);
        expect(proxy.layers.mask).toBe(prop.layers.mask);
        expect(proxy.renderOrder).toBe(7);
        expect(proxy.receiveShadow).toBe(true);
        expect(proxy.material).not.toBe(prop.material);
        expect((proxy.material as THREE.Material).side).toBe(THREE.DoubleSide);
        expect(prop.material.side).toBe(THREE.DoubleSide);
        expect(prop.visible).toBe(mode === "dissolve");
        expect(proxy.parent.visible).toBe(mode === "reveal");
        if (mode === "reveal") expect(proxy.visible).toBe(false);
        else expectMatrix(proxy.matrix, originalWorld);
        effect.setProgress(step.delay + step.span * 0.5);
        expect(prop.visible).toBe(false);
        expect(proxy.visible).toBe(true);
        expect(proxy.matrix.equals(originalWorld)).toBe(false);
        expect(proxy.matrix.elements.every(Number.isFinite)).toBe(true);
        if (mode === "dissolve") {
            effect.setProgress(step.delay + step.span * 0.99);
            expect(
                Math.abs(
                    proxy.matrix.determinant() / originalWorld.determinant()
                )
            ).toBeLessThan(1e-6);
        }
        effect.setProgress(1);
        expect(proxy.parent.visible).toBe(false);
        expect(prop.visible).toBe(mode === "reveal");
        if (mode === "reveal") {
            scene.updateMatrixWorld(true);
            expectMatrix(proxy.matrixWorld, originalWorld);
        } else expect(proxy.visible).toBe(false);
        // Cancellation from an active frame also restores ownership immediately.
        effect.setProgress(step.delay + step.span * 0.5);
        effect.dispose();
        effect.dispose();
        expect(prop.visible).toBe(true);
        expectMatrix(prop.matrix, originalLocal);
        expectMatrix(prop.matrixWorld, originalWorld);
        expect(Array.from(prop.geometry.attributes.position.array)).toEqual(
            originalPositions
        );
        expect(geometryDispose).not.toHaveBeenCalled();
        expect(materialDispose).not.toHaveBeenCalled();
        expect(cloneDispose).toHaveBeenCalledTimes(1);
        expect(scene.children).toEqual([parent]);
    }
);

test("rigid materials preserve group draws and draw range with no extra glow or backside passes", () => {
    const scene = new THREE.Scene();
    const geometry = new THREE.BoxGeometry(1, 1, 1, 8, 8, 8);
    const sourceMaterials = Array.from(
        { length: 6 },
        (_, index) =>
            new THREE.MeshBasicMaterial({
                side: index === 0 ? THREE.DoubleSide : THREE.FrontSide,
                visible: index !== 2,
                map: new THREE.Texture(),
            })
    );
    geometry.setDrawRange(96, 864);
    const originalGroups = JSON.stringify(geometry.groups);
    const prop = new THREE.Mesh(geometry, sourceMaterials);
    scene.add(prop);
    const effect = createWorldCubeReveal(THREE, [prop], {
        ...settings,
        scene,
    });
    const [proxy] = proxies(scene);
    expect(effect.stats).toMatchObject({
        rigidSources: 1,
        rigidTriangles: 224,
        drawCalls: 2,
        backDrawCalls: 0,
        triangles: 0,
        vertices: 0,
    });
    expect(proxy.parent.children).toEqual([proxy]);
    expect(proxy.geometry).toBe(geometry);
    expect(proxy.geometry.drawRange).toEqual({ start: 96, count: 864 });
    expect(JSON.stringify(geometry.groups)).toBe(originalGroups);
    const material = proxy.material as THREE.MeshBasicMaterial[];
    expect(material[0].side).toBe(THREE.DoubleSide);
    expect(material[0].map).toBe(sourceMaterials[0].map);
    expect(material[1]).toBe(sourceMaterials[1]);
    expect(material[2].visible).toBe(false);
    const textureDispose = jest.spyOn(sourceMaterials[0].map, "dispose");
    effect.dispose();
    expect(textureDispose).not.toHaveBeenCalled();
});

test.each([true, false])(
    "rigid GPU instance proxies retain tint, enabled vertex colors (%s) and shared geometry",
    (vertexColors) => {
        const scene = new THREE.Scene();
        const geometry = denseProp().geometry;
        const colors = new Float32Array(
            geometry.attributes.position.count * 3
        ).fill(0.25);
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(0.8, 0.6, 0.4),
            vertexColors,
            side: THREE.DoubleSide,
            map: new THREE.Texture(),
        });
        const prop = new THREE.InstancedMesh(geometry, material, 2);
        const tints = [
            new THREE.Color(0.5, 1, 0.25),
            new THREE.Color(1, 0.5, 1),
        ];
        tints.forEach((tint, index) => {
            prop.setColorAt(index, tint);
            prop.setMatrixAt(
                index,
                new THREE.Matrix4().makeTranslation(index * 2, 0, 0)
            );
        });
        scene.add(prop);
        const instanceMatrices = Array.from(prop.instanceMatrix.array);
        const onInstance = jest.fn();
        const dispose = jest.spyOn(geometry, "dispose");
        const effect = createWorldCubeReveal(THREE, [prop], {
            ...settings,
            scene,
            onInstance,
        });
        expect(effect.stats).toMatchObject({
            rigidSources: 2,
            rigidTriangles: 1920,
            instances: 2,
            vertices: 0,
            vertexTransforms: 0,
            drawCalls: 2,
            skipped: 0,
        });
        expect(onInstance.mock.calls.map(([, index]) => index)).toEqual([0, 1]);
        expect(prop.visible).toBe(false);
        effect.setProgress(1);
        proxies(scene).forEach((proxy, index) => {
            expect(proxy.geometry).toBe(geometry);
            const actual = proxy.material as THREE.MeshBasicMaterial;
            expect(actual.color).toEqual(
                material.color.clone().multiply(tints[index])
            );
            expect(actual.vertexColors).toBe(vertexColors);
            expect(actual.map).toBe(material.map);
            expect(actual.side).toBe(THREE.DoubleSide);
            expect(proxy.matrix.elements[12]).toBe(index * 2);
        });
        effect.dispose();
        expect(prop.visible).toBe(true);
        expect(material.vertexColors).toBe(vertexColors);
        expect(material.side).toBe(THREE.DoubleSide);
        expect(Array.from(prop.instanceMatrix.array)).toEqual(instanceMatrices);
        expect(dispose).not.toHaveBeenCalled();
    }
);

test.each([{ maxSources: 1 }, { maxTriangles: 960 }])(
    "reused geometry stays bounded by %p while further sources retain the normal cut path",
    (limit) => {
        const scene = new THREE.Scene();
        const first = denseProp();
        const second = denseProp();
        second.position.x = 2;
        scene.add(first, second);
        const effect = createWorldCubeReveal(THREE, [scene], {
            ...settings,
            scene,
            cellSize: 8,
            maxTriangles: 10000,
            rigidProps: { ...rigidProps, ...limit },
        });
        expect(effect.stats).toMatchObject({
            rigidSources: 1,
            rigidTriangles: 960,
            sourceTriangles: 960,
            skipped: 0,
        });
        expect(proxies(scene)).toHaveLength(1);
        expect(effect.stats.triangles).toBeGreaterThanOrEqual(960);
        effect.dispose();
        expect(first.visible && second.visible).toBe(true);
    }
);

test("unsupported deformation paths never enter rigid proxies, and a large dense wall remains cut", () => {
    const scene = new THREE.Scene();
    const skinned = new THREE.SkinnedMesh(
        denseProp().geometry,
        new THREE.MeshBasicMaterial()
    );
    const shader = new THREE.Mesh(
        denseProp().geometry,
        new THREE.ShaderMaterial()
    );
    const morph = denseProp();
    morph.geometry.morphAttributes.position = [
        morph.geometry.attributes.position.clone(),
    ];
    const custom = new THREE.Mesh(
        new THREE.InstancedBufferGeometry().copy(denseProp().geometry),
        new THREE.MeshBasicMaterial()
    );
    const wall = new THREE.Mesh(
        new THREE.PlaneGeometry(6, 2, 16, 16),
        new THREE.MeshBasicMaterial()
    );
    scene.add(skinned, shader, morph, custom, wall);
    const effect = createWorldCubeReveal(THREE, [scene], {
        ...settings,
        scene,
        maxTriangles: 10000,
    });
    expect(effect.stats).toMatchObject({
        rigidSources: 0,
        skipped: 4,
        sourceTriangles: 512,
    });
    expect(effect.stats.cells).toBeGreaterThan(0);
    effect.dispose();
    expect(scene.children.every((object) => object.visible)).toBe(true);
});
