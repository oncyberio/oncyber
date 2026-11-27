/** @jest-environment node */
import * as THREE from "three/webgpu";
import { CHARACTERS } from "./characters";
import { generateAvatar } from "./generate";
import { assembleAvatar } from "./index";
import { asVrm } from "./vrmAdapter";

const data = generateAvatar(CHARACTERS.runner, { detail: 0.3 });

test("an assembled avatar offers what Oncyber reads from a VRM", () => {
    const avatar = assembleAvatar(data);
    const vrm = asVrm(avatar);
    expect(vrm.meta.metaVersion).toBe("1");
    const hips = vrm.humanoid.getNormalizedBoneNode("hips");
    expect(hips).toBe(avatar.bones.hips);
    expect(vrm.humanoid.getNormalizedBoneNode("tail")).toBeNull();
    // Normalized rig: every bone rests unrotated, so clips apply directly.
    for (const bone of Object.values(avatar.bones)) {
        expect(bone.quaternion.equals(new THREE.Quaternion())).toBe(true);
        expect(bone.scale.equals(new THREE.Vector3(1, 1, 1))).toBe(true);
    }
    // Meshes are plain skinned Lambert parts, which the crowd can instance.
    const meshes: THREE.SkinnedMesh[] = [];
    vrm.scene.traverse((object) => {
        if ((object as THREE.SkinnedMesh).isSkinnedMesh)
            meshes.push(object as THREE.SkinnedMesh);
    });
    expect(meshes.length).toBe(data.parts.length);
    for (const mesh of meshes) {
        expect(mesh.material).toBeInstanceOf(THREE.MeshLambertMaterial);
        expect(mesh.geometry.getAttribute("skinIndex")).toBeTruthy();
        expect(mesh.geometry.getAttribute("skinWeight")).toBeTruthy();
        expect(mesh.skeleton.bones.length).toBe(
            mesh.skeleton.boneInverses.length
        );
        expect(Object.keys(mesh.geometry.morphAttributes)).toHaveLength(0);
    }
    avatar.dispose();
});

test("a pose can be saved, cleared and put back", () => {
    const avatar = assembleAvatar(data);
    const vrm = asVrm(avatar);
    avatar.bones.leftUpperArm.rotation.z = -1;
    avatar.bones.hips.position.y += 0.2;
    const pose = vrm.humanoid.getNormalizedPose();
    vrm.humanoid.resetNormalizedPose();
    expect(
        avatar.bones.leftUpperArm.quaternion.equals(new THREE.Quaternion())
    ).toBe(true);
    expect(avatar.bones.hips.position.y).toBeCloseTo(data.bones[0].position[1]);
    vrm.humanoid.setNormalizedPose(pose);
    expect(avatar.bones.leftUpperArm.rotation.z).toBeCloseTo(-1);
    expect(avatar.bones.hips.position.y).toBeCloseTo(
        data.bones[0].position[1] + 0.2
    );
    avatar.dispose();
});

test("posing into the design pose lowers the arms the surfaces were sculpted on", () => {
    const avatar = assembleAvatar(data);
    avatar.applyDesignPose();
    avatar.scene.updateMatrixWorld(true);
    const hand = new THREE.Vector3().setFromMatrixPosition(
        avatar.bones.leftHand.matrixWorld
    );
    const shoulder = new THREE.Vector3().setFromMatrixPosition(
        avatar.bones.leftUpperArm.matrixWorld
    );
    expect(hand.y).toBeLessThan(shoulder.y - 0.3);
    expect(hand.x).toBeGreaterThan(shoulder.x + 0.2);
    avatar.dispose();
});

test("the ponytail swings behind a moving head and settles again", () => {
    const avatar = assembleAvatar(data);
    const tail = avatar.bones.hairTail2;
    expect(tail).toBeTruthy();
    avatar.scene.updateMatrixWorld(true);
    avatar.update(1 / 60);
    for (let i = 0; i < 20; i++) {
        avatar.scene.position.x += 0.05;
        avatar.scene.updateMatrixWorld(true);
        avatar.update(1 / 60);
    }
    const swung = avatar.bones.hairTail1.quaternion.angleTo(
        new THREE.Quaternion()
    );
    expect(swung).toBeGreaterThan(0.05);
    for (let i = 0; i < 400; i++) {
        avatar.scene.updateMatrixWorld(true);
        avatar.update(1 / 60);
    }
    const rested = avatar.bones.hairTail1.quaternion.angleTo(
        new THREE.Quaternion()
    );
    expect(rested).toBeLessThan(swung);
    expect(Number.isFinite(rested)).toBe(true);
    avatar.dispose();
});
