import {
    DoubleSide,
    Euler,
    Group,
    InstancedMesh,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    PlaneGeometry,
    Quaternion,
    Raycaster,
    Vector3,
} from "three";
import { getSurfaceNormal } from "./surfaceNormal";

const material = () => new MeshBasicMaterial({ side: DoubleSide });

function expectVector(actual, expected) {
    expect(actual.x).toBeCloseTo(expected.x, 6);
    expect(actual.y).toBeCloseTo(expected.y, 6);
    expect(actual.z).toBeCloseTo(expected.z, 6);
}

// Derive the visible plane normal from its transformed triangle edges,
// independently of the inverse-transpose normal matrix used in production.
function castAtTriangle(mesh, transform) {
    const position = mesh.geometry.attributes.position;
    const indices = mesh.geometry.index;
    const points = [0, 1, 2].map((index) =>
        new Vector3()
            .fromBufferAttribute(position, indices.getX(index))
            .applyMatrix4(transform)
    );
    const normal = points[1]
        .clone()
        .sub(points[0])
        .cross(points[2].clone().sub(points[0]))
        .normalize();
    const center = points
        .reduce((sum, point) => sum.add(point), new Vector3())
        .multiplyScalar(1 / 3);
    const hit = new Raycaster(
        center.clone().addScaledVector(normal, 3),
        normal.clone().negate()
    ).intersectObject(mesh)[0];
    expect(hit).toBeDefined();
    return { hit, normal };
}

test("uses the rotation of instance zero instead of the container orientation", () => {
    const wall = new InstancedMesh(new PlaneGeometry(4, 4), material(), 1);
    wall.setMatrixAt(0, new Matrix4().makeRotationY(Math.PI / 2));
    wall.updateMatrixWorld(true);
    const hit = new Raycaster(
        new Vector3(3, 0, 0),
        new Vector3(-1, 0, 0)
    ).intersectObject(wall)[0];

    expect(hit.instanceId).toBe(0);
    expectVector(hit.face.normal, new Vector3(0, 0, 1));
    expectVector(getSurfaceNormal(hit, new Vector3()), new Vector3(1, 0, 0));
});

test("uses the specific instance hit when repeated walls face different directions", () => {
    const wall = new InstancedMesh(new PlaneGeometry(4, 4), material(), 2);
    wall.setMatrixAt(0, new Matrix4().makeTranslation(-10, 0, 0));
    wall.setMatrixAt(
        1,
        new Matrix4().makeRotationY(-Math.PI / 2).setPosition(10, 0, 0)
    );
    wall.updateMatrixWorld(true);
    const hit = new Raycaster(
        new Vector3(7, 0, 0),
        new Vector3(1, 0, 0)
    ).intersectObject(wall)[0];

    expect(hit.instanceId).toBe(1);
    expectVector(getSurfaceNormal(hit, new Vector3()), new Vector3(-1, 0, 0));
});

test("matches an ordinary mesh under rotated, nonuniformly scaled parents", () => {
    const parent = new Group();
    parent.rotation.set(0.2, 0.4, -0.3);
    parent.scale.set(2, 0.5, 3);
    const wall = new Mesh(new PlaneGeometry(4, 4), material());
    wall.rotation.set(0.3, -0.5, 0.1);
    wall.position.set(2, 1, -3);
    parent.add(wall);
    parent.updateMatrixWorld(true);
    const { hit, normal } = castAtTriangle(wall, wall.matrixWorld);

    expectVector(getSurfaceNormal(hit, new Vector3()), normal);
});

test("includes nonuniform instance scale and the container world transform", () => {
    const parent = new Group();
    parent.rotation.set(-0.1, 0.2, 0.3);
    parent.scale.set(1, 2, 0.75);
    const geometry = new PlaneGeometry(4, 4).rotateY(0.45);
    const wall = new InstancedMesh(geometry, material(), 1);
    wall.rotation.set(0.2, -0.3, 0.1);
    wall.scale.set(0.5, 2, 1);
    const instance = new Matrix4().compose(
        new Vector3(1, 2, -1),
        new Quaternion().setFromEuler(new Euler(0.4, 0.7, -0.2)),
        new Vector3(3, 0.5, 1.5)
    );
    wall.setMatrixAt(0, instance);
    parent.add(wall);
    parent.updateMatrixWorld(true);
    const transform = new Matrix4().multiplyMatrices(
        wall.matrixWorld,
        instance
    );
    const { hit, normal } = castAtTriangle(wall, transform);

    expect(hit.instanceId).toBe(0);
    const actual = getSurfaceNormal(hit, new Vector3());
    expectVector(actual, normal);
    expect(actual.length()).toBeCloseTo(1, 8);
});

test("writes into the supplied target without changing the raycast normal", () => {
    const wall = new Mesh(new PlaneGeometry(4, 4), material());
    wall.rotation.set(0.2, 0.4, -0.3);
    wall.updateMatrixWorld(true);
    const { hit, normal } = castAtTriangle(wall, wall.matrixWorld);
    const original = hit.face.normal.clone();
    const target = new Vector3();

    expect(getSurfaceNormal(hit, target)).toBe(target);
    expectVector(target, normal);
    expect(hit.face.normal.equals(original)).toBe(true);
});

test("returns null without changing the target for hits without a face", () => {
    const target = new Vector3(1, 2, 3);
    expect(getSurfaceNormal({ face: null }, target)).toBeNull();
    expect(getSurfaceNormal(null, target)).toBeNull();
    expect(target.toArray()).toEqual([1, 2, 3]);
});
