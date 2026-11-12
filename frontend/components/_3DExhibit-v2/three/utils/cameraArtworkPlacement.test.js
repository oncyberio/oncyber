import {
    BoxGeometry,
    Group,
    Mesh,
    Object3D,
    PerspectiveCamera,
    PlaneGeometry,
    Quaternion,
    Vector3,
} from "three";
import { placeArtworkInFrontOfCamera } from "./cameraArtworkPlacement";

function artwork(width = 2, height = 2, depth = 0) {
    const object = new Group();
    object.raycastMesh = new Mesh(
        depth
            ? new BoxGeometry(width, height, depth)
            : new PlaneGeometry(width, height)
    );
    object.add(object.raycastMesh);
    return object;
}

function expectVector(actual, expected) {
    expect(actual.x).toBeCloseTo(expected.x, 6);
    expect(actual.y).toBeCloseTo(expected.y, 6);
    expect(actual.z).toBeCloseTo(expected.z, 6);
}

function visualCenter(object) {
    const mesh = object.raycastMesh || object.renderMesh || object;
    if (!mesh.geometry) return object.getWorldPosition(new Vector3());
    mesh.geometry.computeBoundingBox();
    return mesh.localToWorld(
        mesh.geometry.boundingBox.getCenter(new Vector3())
    );
}

function expectCentered(object, camera, distance) {
    const origin = camera.getWorldPosition(new Vector3());
    const expected = camera
        .getWorldDirection(new Vector3())
        .multiplyScalar(distance)
        .add(origin);
    expectVector(visualCenter(object), expected);
    expect(visualCenter(object).distanceTo(origin)).toBeCloseTo(distance, 6);
}

function projectedExtents(mesh, camera) {
    mesh.geometry.computeBoundingBox();
    const { min, max } = mesh.geometry.boundingBox;
    let horizontal = 0;
    let vertical = 0;
    for (const x of [min.x, max.x]) {
        for (const y of [min.y, max.y]) {
            for (const z of [min.z, max.z]) {
                const screen = mesh
                    .localToWorld(new Vector3(x, y, z))
                    .project(camera);
                horizontal = Math.max(horizontal, Math.abs(screen.x));
                vertical = Math.max(vertical, Math.abs(screen.y));
            }
        }
    }
    return { horizontal, vertical };
}

test.each([
    [18, 4, 16 / 9],
    [4, 18, 16 / 9],
    [18, 4, 9 / 16],
    [4, 18, 9 / 16],
])(
    "fits %sx%s artwork in a %s viewport without rescaling",
    (width, height, aspect) => {
        const camera = new PerspectiveCamera(60, aspect, 0.1, 1000);
        const object = artwork(width, height);
        const distance = placeArtworkInFrontOfCamera(object, camera);
        const visible = projectedExtents(object.raycastMesh, camera);

        expectCentered(object, camera, distance);
        expect(visible.horizontal).toBeLessThanOrEqual(0.5);
        expect(visible.vertical).toBeLessThanOrEqual(0.5);
        expect(Math.max(visible.horizontal, visible.vertical)).toBeGreaterThan(
            0.4
        );
        expect(object.scale.toArray()).toEqual([1, 1, 1]);
    }
);

test("adds 1.5 units of clearance to the legacy minimum for small objects", () => {
    const camera = new PerspectiveCamera(60, 16 / 9);
    const object = artwork(0.5, 0.5);
    const distance = placeArtworkInFrontOfCamera(object, camera);

    expect(distance).toBeCloseTo(6.1);
    expectCentered(object, camera, distance);
});

test("accounts for camera zoom and field of view", () => {
    const object = artwork(10, 10);
    const camera = new PerspectiveCamera(60, 1);
    const normal = placeArtworkInFrontOfCamera(object, camera);
    camera.zoom = 2;
    camera.updateProjectionMatrix();
    const zoomed = placeArtworkInFrontOfCamera(object, camera);

    expect(zoomed - 1.5).toBeCloseTo(2 * (normal - 1.5));
    expect(projectedExtents(object.raycastMesh, camera).vertical).toBeLessThan(
        0.5
    );
    camera.zoom = 1;
    camera.fov = 90;
    camera.updateProjectionMatrix();
    const wide = placeArtworkInFrontOfCamera(object, camera);
    expect(wide).toBeLessThan(normal);
    expectCentered(object, camera, wide);
});

test("keeps full distance when the camera points steeply down under a transformed parent", () => {
    const cameraParent = new Group();
    cameraParent.position.set(3, 7, -2);
    cameraParent.rotation.set(0.1, 0.6, 0.2);
    cameraParent.scale.setScalar(3);
    const camera = new PerspectiveCamera(60, 16 / 9);
    camera.position.set(2, 3, 1);
    camera.rotation.set(-Math.PI / 2 + 0.01, 0.1, 0);
    cameraParent.add(camera);
    const object = artwork(1, 1);
    const distance = placeArtworkInFrontOfCamera(object, camera);

    expect(distance).toBeGreaterThanOrEqual(6.1);
    expectCentered(object, camera, distance);
});

test("centers offset content under a transformed artwork parent and preserves scale and rotation", () => {
    const parent = new Group();
    parent.position.set(-3, 2, 7);
    parent.rotation.set(0.2, 0.4, -0.1);
    parent.scale.setScalar(2);
    const object = artwork(3, 5, 2);
    object.position.set(2, 1, -4);
    object.rotation.set(0.1, -0.2, 0.3);
    object.scale.set(2, 0.7, 1.2);
    object.raycastMesh.position.set(2, 3, 0.7);
    object.raycastMesh.rotation.set(0.2, 0.4, 0);
    parent.add(object);
    const scale = object.scale.clone();
    const rotation = object.quaternion.clone();
    const camera = new PerspectiveCamera(65, 16 / 9);
    camera.position.set(5, 2, 3);
    camera.rotation.set(-0.2, 0.5, 0);
    const distance = placeArtworkInFrontOfCamera(object, camera);
    const visible = projectedExtents(object.raycastMesh, camera);

    expectCentered(object, camera, distance);
    expectVector(object.scale, scale);
    expect(Math.abs(object.quaternion.dot(rotation))).toBeCloseTo(1, 10);
    expect(visible.horizontal).toBeLessThanOrEqual(0.5);
    expect(visible.vertical).toBeLessThanOrEqual(0.5);
});

test("keeps deep geometry fully in front with room around its nearest face", () => {
    const object = artwork(10, 6, 12);
    const camera = new PerspectiveCamera(60, 1);
    const distance = placeArtworkInFrontOfCamera(object, camera);
    expect(distance).toBeCloseTo(10 / Math.tan(Math.PI / 6) + 1.5 + 6);
    const visible = projectedExtents(object.raycastMesh, camera);
    expect(visible.horizontal).toBeLessThan(0.5);
    expect(visible.vertical).toBeLessThan(0.5);
});

test("ignores editor handles on the artwork and raycast mesh", () => {
    const object = artwork(2, 2);
    const camera = new PerspectiveCamera(60, 1);
    object.add(new Mesh(new BoxGeometry(500, 500, 500)));
    object.raycastMesh.add(new Mesh(new BoxGeometry(800, 800, 800)));

    expect(placeArtworkInFrontOfCamera(object, camera)).toBeCloseTo(6.1);
    expectCentered(object, camera, 6.1);
});

test("uses render content or a geometric artwork when no raycast mesh exists", () => {
    const camera = new PerspectiveCamera(60, 1);
    const object = artwork(10, 4);
    object.renderMesh = object.raycastMesh;
    delete object.raycastMesh;
    const expected = 10 / Math.tan(Math.PI / 6) + 1.5;
    expect(placeArtworkInFrontOfCamera(object, camera)).toBeCloseTo(expected);
    expectCentered(object, camera, expected);
    const mesh = new Mesh(new PlaneGeometry(10, 4));
    expect(placeArtworkInFrontOfCamera(mesh, camera)).toBeCloseTo(expected);
    expectCentered(mesh, camera, expected);
});

test("uses a finite minimum distance when an artwork has no geometry", () => {
    const object = new Object3D();
    object.position.set(4, 8, 2);
    object.rotation.set(0.3, 0.4, 0.5);
    const rotation = object.getWorldQuaternion(new Quaternion());
    const camera = new PerspectiveCamera(60, 1);
    camera.position.set(-2, 4, 3);
    camera.rotation.set(-0.8, 0.6, 0);
    const distance = placeArtworkInFrontOfCamera(object, camera);

    expect(distance).toBeCloseTo(6.1);
    expectCentered(object, camera, distance);
    expect(Math.abs(object.quaternion.dot(rotation))).toBeCloseTo(1, 10);
});
