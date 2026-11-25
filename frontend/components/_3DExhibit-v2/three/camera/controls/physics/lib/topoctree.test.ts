import * as THREE from "three";
import { TopOctree } from "./topoctree";
import { Capsule } from "./capsule";

jest.mock("@components/_3DExhibit-v2/three/utils/three", () => ({
    isMesh: (object) => object.isMesh,
}));
jest.mock("@3utils/three", () => ({ isMesh: (object) => object.isMesh }), {
    virtual: true,
});
jest.mock("@3scene", () => ({}), { virtual: true });

// A wall at z = -2, facing the origin, made the way the classic kit marks
// a destination's collision_invisible meshes.
function wall(cameraIgnores: boolean) {
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.MeshBasicMaterial(),
    );
    mesh.position.z = -2;
    mesh.visible = !cameraIgnores;
    if (cameraIgnores) mesh.userData.cameraIgnores = true;
    const octree = new TopOctree();
    octree.createStaticOcteee([mesh]);
    return octree;
}

const ray = () =>
    new THREE.Ray(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));

test("the camera sees through an invisible wall", () => {
    const octree = wall(true);
    expect(octree.rayIntersect(ray(), { camera: true })).toBeNull();
    // floor checks and other rays still find it
    expect(octree.rayIntersect(ray())?.distance).toBeCloseTo(2, 6);
});

test("the player still collides with an invisible wall", () => {
    const octree = wall(true);
    const capsule = new Capsule(
        new THREE.Vector3(0, -0.5, -1.8),
        new THREE.Vector3(0, 0.5, -1.8),
        0.35,
    );
    expect(octree.capsuleIntersect(capsule)).not.toBeNull();
});

test("the camera still stops at a visible wall", () => {
    const octree = wall(false);
    expect(octree.rayIntersect(ray(), { camera: true })?.distance).toBeCloseTo(
        2,
        6,
    );
});
