import * as THREE from "three";
import { genTriangles } from "./utils";

// Keep the actual geometry and native triangle implementation without importing
// unrelated renderer/material modules through the shared Three utility module.
jest.mock("@components/_3DExhibit-v2/three/utils/three", () => ({
    isMesh: (object) => object.isMesh,
}));

function bounds(triangles) {
    return new THREE.Box3().setFromPoints(
        triangles.flatMap((triangle) => [triangle.a, triangle.b, triangle.c])
    );
}

function expectVector(actual: THREE.Vector3, expected: number[]) {
    expect(actual.x).toBeCloseTo(expected[0], 8);
    expect(actual.y).toBeCloseTo(expected[1], 8);
    expect(actual.z).toBeCloseTo(expected[2], 8);
}

test.each(["indexed", "non-indexed"])(
    "%s reflector collision uses its floor transform before any renderer update",
    (kind) => {
        const plane = new THREE.PlaneGeometry(1, 1);
        const geometry = kind === "indexed" ? plane : plane.toNonIndexed();
        const reflector = new THREE.Mesh(
            geometry,
            new THREE.MeshBasicMaterial()
        );
        reflector.rotation.x = -Math.PI / 2;
        reflector.scale.set(1000, 1000, 1);
        reflector.position.y = 0.1;
        // The authored mirror starts as an upright unit plane. A collision
        // build must not snapshot that stale identity matrix as a spawn wall.
        expect(reflector.matrixWorld.equals(new THREE.Matrix4())).toBe(true);
        const triangles = genTriangles([reflector]);
        expect(triangles).toHaveLength(2);
        const box = bounds(triangles);
        expectVector(box.min, [-500, 0.1, -500]);
        expectVector(box.max, [500, 0.1, 500]);
        for (const triangle of triangles) {
            expectVector(triangle.getNormal(new THREE.Vector3()), [0, 1, 0]);
            expect(
                triangle.rayIntersect(
                    new THREE.Ray(
                        new THREE.Vector3(0, 0.3, 1),
                        new THREE.Vector3(0, 0, -1)
                    ),
                    new THREE.Vector3()
                )
            ).toBeNull();
        }
        const ray = new THREE.Ray(
            new THREE.Vector3(0.2, 2, 0.3),
            new THREE.Vector3(0, -1, 0)
        );
        const floor = triangles
            .map((triangle) => triangle.rayIntersect(ray, new THREE.Vector3()))
            .find(Boolean);
        expectVector(floor, [0.2, 0.1, 0.3]);
    }
);

test("a collider subtree refreshes both its stale parent and descendants before baking", () => {
    const parent = new THREE.Group();
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial()
    );
    parent.add(group);
    group.add(mesh);
    parent.updateMatrixWorld(true);
    parent.position.set(10, 5, -7);
    parent.rotation.y = Math.PI / 2;
    group.position.x = 1;
    mesh.position.set(2, 0.1, 3);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(4, 6, 1);
    mesh.visible = false; // Authored invisible colliders must remain collidable.
    const triangles = genTriangles([group]);
    const box = bounds(triangles);
    expectVector(box.min, [10, 5.1, -12]);
    expectVector(box.max, [16, 5.1, -8]);
    expect(mesh.visible).toBe(false);
    expect(triangles).toHaveLength(2);
});

test("manual local matrices remain authoritative when matrixAutoUpdate is false", () => {
    const parent = new THREE.Group();
    parent.matrixAutoUpdate = false;
    parent.matrix.makeTranslation(7, 3, -4);
    parent.matrixWorldNeedsUpdate = true;
    parent.position.set(999, 999, 999);
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial()
    );
    mesh.matrixAutoUpdate = false;
    mesh.matrix.compose(
        new THREE.Vector3(2, 0.1, 3),
        new THREE.Quaternion().setFromEuler(
            new THREE.Euler(-Math.PI / 2, 0, 0)
        ),
        new THREE.Vector3(4, 6, 1)
    );
    mesh.matrixWorldNeedsUpdate = true;
    mesh.position.set(-999, -999, -999);
    parent.add(mesh);
    const parentMatrix = parent.matrix.clone();
    const meshMatrix = mesh.matrix.clone();
    const positions = Array.from(mesh.geometry.attributes.position.array);
    const triangles = genTriangles([mesh]);
    const box = bounds(triangles);
    expectVector(box.min, [7, 3.1, -4]);
    expectVector(box.max, [11, 3.1, 2]);
    expect(parent.matrix.equals(parentMatrix)).toBe(true);
    expect(mesh.matrix.equals(meshMatrix)).toBe(true);
    expect(parent.matrixAutoUpdate).toBe(false);
    expect(mesh.matrixAutoUpdate).toBe(false);
    expect(Array.from(mesh.geometry.attributes.position.array)).toEqual(
        positions
    );
});
