import {
    DoubleSide,
    Group,
    Mesh,
    MeshBasicMaterial,
    Object3D,
    PlaneGeometry,
    Raycaster,
    Vector3,
} from "three";
import { placeOnSurface } from "./surfacePlacement";

function wall(position = new Vector3(), rotationY = 0) {
    const mesh = new Mesh(
        new PlaneGeometry(20, 20),
        new MeshBasicMaterial({ side: DoubleSide })
    );
    mesh.position.copy(position);
    mesh.rotation.y = rotationY;
    mesh.updateMatrixWorld(true);
    return mesh;
}

function cast(mesh, point, outward) {
    const direction = outward.clone().negate();
    const ray = new Raycaster(
        point.clone().addScaledVector(outward, 3),
        direction
    );
    const hit = ray.intersectObject(mesh)[0];
    expect(hit).toBeDefined();
    return { hit, direction };
}

function expectVector(actual, expected) {
    expect(actual.x).toBeCloseTo(expected.x, 6);
    expect(actual.y).toBeCloseTo(expected.y, 6);
    expect(actual.z).toBeCloseTo(expected.z, 6);
}

function expectPlacement(object, grab, point, outward) {
    expectVector(object.localToWorld(grab.clone()), point);
    expectVector(object.getWorldDirection(new Vector3()), outward);
}

test("moves text onto a perpendicular wall and aligns its visible face", () => {
    const object = new Object3D();
    const outward = new Vector3(1, 0, 0);
    const surface = wall(new Vector3(4, 0, 0), Math.PI / 2);
    const { hit, direction } = cast(surface, new Vector3(4, 1, 0), outward);
    const grab = new Vector3();

    expect(placeOnSurface(object, hit, grab, direction)).toBe(true);
    expectPlacement(object, grab, hit.point, outward);
});

test("moves to the new depth even when the wall has the same normal", () => {
    const object = new Object3D();
    object.position.set(-1, 2, 12);
    const outward = new Vector3(0, 0, 1);
    const { hit, direction } = cast(wall(), new Vector3(2, 1, 0), outward);
    const grab = new Vector3();

    placeOnSurface(object, hit, grab, direction);
    expectPlacement(object, grab, hit.point, outward);
    expect(object.position.z).toBeCloseTo(0);
});

test("faces the pointer when hitting the back of a double-sided wall", () => {
    const object = new Object3D();
    const outward = new Vector3(0, 0, -1);
    const { hit, direction } = cast(wall(), new Vector3(0, 1, 0), outward);
    expect(hit.face.normal.z).toBe(1);

    placeOnSurface(object, hit, new Vector3(), direction);
    expectPlacement(object, new Vector3(), hit.point, outward);
});

test("anchors an offset grab on a rotated wall while retaining object scale", () => {
    const object = new Object3D();
    object.scale.set(2, 3, 0.5);
    const scale = object.scale.clone();
    const grab = new Vector3(0.6, -0.2, 0.1);
    const angle = Math.PI / 3;
    const outward = new Vector3(Math.sin(angle), 0, Math.cos(angle));
    const point = new Vector3(2, 1, -3);
    const { hit, direction } = cast(wall(point, angle), point, outward);

    placeOnSurface(object, hit, grab, direction);
    expectPlacement(object, grab, hit.point, outward);
    expect(object.scale.equals(scale)).toBe(true);
});

test("respects translated, rotated, uniformly scaled parents", () => {
    const parent = new Group();
    parent.position.set(-3, 2, 1);
    parent.rotation.set(0.2, 0.4, -0.3);
    parent.scale.setScalar(2.5);
    const object = new Object3D();
    object.scale.set(2, 0.5, 1);
    parent.add(object);
    const grab = new Vector3(0.4, -0.6, 0.15);
    const angle = -Math.PI / 4;
    const outward = new Vector3(Math.sin(angle), 0, Math.cos(angle));
    const point = new Vector3(1, 3, 2);
    const { hit, direction } = cast(wall(point, angle), point, outward);

    placeOnSurface(object, hit, grab, direction);
    expectPlacement(object, grab, hit.point, outward);
    expect(object.scale.toArray()).toEqual([2, 0.5, 1]);
});

test("the final placement is independent of intermediate surfaces", () => {
    const direct = new Object3D();
    direct.position.set(3, 2, 1);
    direct.rotation.set(0.2, 0.5, -0.3);
    direct.scale.set(2, 3, 1);
    const travelled = direct.clone();
    const grab = new Vector3(0.3, -0.2, 0.05);
    const interim = cast(
        wall(new Vector3(4, 0, 0), Math.PI / 2),
        new Vector3(4, 1, 0),
        new Vector3(1, 0, 0)
    );
    const final = cast(wall(), new Vector3(1, 2, 0), new Vector3(0, 0, 1));

    placeOnSurface(travelled, interim.hit, grab, interim.direction);
    placeOnSurface(travelled, final.hit, grab, final.direction);
    placeOnSurface(direct, final.hit, grab, final.direction);
    expectVector(travelled.position, direct.position);
    expect(Math.abs(travelled.quaternion.dot(direct.quaternion))).toBeCloseTo(
        1,
        8
    );
    expectPlacement(travelled, grab, final.hit.point, new Vector3(0, 0, 1));
});

test("saved position and Euler rotation restore the same placement", () => {
    const object = new Object3D();
    object.scale.set(1.5, 2, 1);
    const grab = new Vector3(0.3, 0.1, 0);
    const outward = new Vector3(1, 0, 0);
    const { hit, direction } = cast(
        wall(new Vector3(2, 0, 0), Math.PI / 2),
        new Vector3(2, 1, -2),
        outward
    );
    placeOnSurface(object, hit, grab, direction);
    const saved = JSON.parse(
        JSON.stringify({
            position: object.position.toArray(),
            rotation: object.rotation.toArray(),
            scale: object.scale.toArray(),
        })
    );
    const restored = new Object3D();
    restored.position.fromArray(saved.position);
    restored.rotation.fromArray(saved.rotation);
    restored.scale.fromArray(saved.scale);

    expectPlacement(restored, grab, hit.point, outward);
});

test("a hit without a face leaves the current object transform intact", () => {
    const object = new Object3D();
    object.position.set(1, 2, 3);
    object.rotation.set(0.1, 0.2, 0.3);
    object.updateMatrix();
    const original = object.matrix.clone();

    expect(
        placeOnSurface(object, { face: null }, new Vector3(), new Vector3())
    ).toBe(false);
    object.updateMatrix();
    expect(object.matrix.equals(original)).toBe(true);
});
