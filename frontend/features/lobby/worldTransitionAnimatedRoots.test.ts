import * as THREE from "three";
import { createWorldCubeReveal } from "./worldCubeReveal";
import { getWorldTransitionAnimatedRoots } from "./worldTransitionAnimatedRoots";
import {
    clearWorldTransitionCache,
    rememberWorldTransition,
    takeWorldTransition,
} from "./worldTransitionCache";

function positionClip(name: string) {
    return new THREE.AnimationClip("move", 1, [
        new THREE.VectorKeyframeTrack(name, [0, 1], [0, 0, 0, 1, 0, 0]),
    ]);
}

afterEach(() => clearWorldTransitionCache());

test("parent tracks route their complete subtree once, including meshes with no direct tracks", () => {
    const scene = new THREE.Scene();
    const authored = new THREE.Group();
    const moving = new THREE.Group();
    moving.name = "Object001";
    const descendant = new THREE.Mesh();
    descendant.name = "datda004_pbr";
    const other = new THREE.Mesh();
    other.name = "Object002";
    const still = new THREE.Mesh();
    authored.add(moving, other, still);
    moving.add(descendant);
    scene.add(authored);
    authored.animations = [
        positionClip("Object001.position"),
        positionClip("datda004_pbr.position"),
        positionClip("Object002.position"),
    ];
    expect(getWorldTransitionAnimatedRoots(THREE, scene)).toEqual([
        moving,
        other,
    ]);
});

test("clip owners resolve duplicate names locally and support UUID and root bindings", () => {
    const scene = new THREE.Scene();
    const first = new THREE.Group();
    const second = new THREE.Group();
    const firstTarget = new THREE.Mesh();
    const secondTarget = new THREE.Mesh();
    firstTarget.name = secondTarget.name = "moving";
    first.add(firstTarget);
    second.add(secondTarget);
    scene.add(first, second);
    first.animations = [positionClip("moving.position")];
    second.animations = [positionClip(`${secondTarget.uuid}.position`)];
    expect(getWorldTransitionAnimatedRoots(THREE, scene)).toEqual([
        firstTarget,
        secondTarget,
    ]);
    second.animations.push(positionClip(".position"));
    expect(getWorldTransitionAnimatedRoots(THREE, scene)).toEqual([
        firstTarget,
        second,
    ]);
});

test("missing targets and malformed optional tracks do not classify the whole room as animated", () => {
    const scene = new THREE.Scene();
    const stable = new THREE.Mesh();
    scene.add(stable);
    expect(getWorldTransitionAnimatedRoots(THREE, scene)).toEqual([]);
    scene.animations = [
        positionClip("missing.position"),
        { tracks: [{ name: "invalid" }] } as THREE.AnimationClip,
    ];
    expect(getWorldTransitionAnimatedRoots(THREE, scene)).toEqual([]);
    expect(getWorldTransitionAnimatedRoots(THREE, undefined)).toEqual([]);
});

test("a real mixer moving an untracked descendant does not invalidate cached static room tiles", () => {
    const scene = new THREE.Scene();
    const room = new THREE.Group();
    const animated = new THREE.Group();
    animated.name = "Object001";
    const child = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.MeshBasicMaterial()
    );
    child.name = "datda004_pbr";
    child.position.set(3, 1, -4);
    const staticWall = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 4),
        new THREE.MeshBasicMaterial()
    );
    staticWall.position.set(0, 2, -8);
    animated.add(child);
    room.add(animated, staticWall);
    scene.add(room);
    const rotation = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        0.8
    );
    const clip = new THREE.AnimationClip("authored rotation", 1, [
        new THREE.QuaternionKeyframeTrack(
            "Object001.quaternion",
            [0, 1],
            [0, 0, 0, 1, ...rotation.toArray()]
        ),
    ]);
    room.animations = [clip];
    const mixer = new THREE.AnimationMixer(room);
    mixer.clipAction(clip).play();
    const dynamicRoots = new Set(getWorldTransitionAnimatedRoots(THREE, scene));
    expect(dynamicRoots.has(animated)).toBe(true);
    const effect = createWorldCubeReveal(THREE, [room], {
        scene,
        anchor: { x: 0, y: 0, z: 0 },
        cellSize: 1,
        coverage: "all",
        exclude: (object) => dynamicRoots.has(object),
    });
    try {
        effect.setProgress(1);
        expect(effect.stats.sourceTriangles).toBe(2);
        expect(
            rememberWorldTransition(room, effect, {
                cellSize: 1,
                triangleBudget: 120000,
                refinement: undefined,
            })
        ).toBe(true);
        const oldMatrix = child.matrixWorld.clone();
        mixer.update(0.5);
        scene.updateMatrixWorld(true);
        expect(child.matrixWorld.equals(oldMatrix)).toBe(false);
        expect(takeWorldTransition(room)?.effect).toBe(effect);
        expect(
            effect.restart({ mode: "dissolve", anchor: { x: 1, y: 0, z: 2 } })
        ).toBe(true);
        expect(child.visible).toBe(true);
    } finally {
        effect.dispose();
        mixer.stopAllAction();
        mixer.uncacheRoot(room);
    }
});
