import {
    AnimationClip,
    AnimationMixer,
    Bone,
    Group,
    Quaternion,
    QuaternionKeyframeTrack,
    Vector3,
    VectorKeyframeTrack,
} from "three";
import { VRMHumanoid } from "@pixiv/three-vrm-core";
import { bakeAvatarAnimation, getAvatarSource } from "./avatarAnimations";

function makeAvatar(height) {
    const scene = new Group();
    const hips = new Bone();
    hips.name = "TestHips";
    hips.position.y = height;
    const arm = new Bone();
    arm.name = "TestArm";
    arm.position.set(0.3, 0.4, 0);
    hips.add(arm);
    scene.add(hips);
    scene.updateMatrixWorld(true);
    const humanoid = new VRMHumanoid({
        hips: { node: hips },
        leftUpperArm: { node: arm },
    });
    scene.add(humanoid.normalizedHumanBonesRoot);
    return { scene, humanoid, meta: { metaVersion: "1" } };
}

test("retargeted clips animate independent clones, preserve rest pose and stay in place", () => {
    const rotation = new Quaternion().setFromAxisAngle(
        new Vector3(0, 0, 1),
        0.7
    );
    const source = AnimationClip.toJSON(
        new AnimationClip("motion", 1, [
            new QuaternionKeyframeTrack(
                "mixamorigLeftArm.quaternion",
                [0, 1],
                [0, 0, 0, 1, ...rotation.toArray()]
            ),
            new VectorKeyframeTrack(
                "mixamorigHips.position",
                [0, 1],
                [0, 100, 0, 30, 110, 40]
            ),
        ])
    );
    const avatar = makeAvatar(1);
    const before = avatar.humanoid.getRawPose();
    const clip = bakeAvatarAnimation(avatar, source, "avatar:walk");
    expect(avatar.humanoid.getRawPose()).toEqual(before);
    const a = avatar.scene.clone(true);
    const b = avatar.scene.clone(true);
    const mixer = new AnimationMixer(a);
    mixer.clipAction(clip).play();
    mixer.update(0.5);
    expect(
        a
            .getObjectByName("TestArm")
            .quaternion.angleTo(b.getObjectByName("TestArm").quaternion)
    ).toBeGreaterThan(0.1);
    const positions = clip.tracks.find(
        (track) => track.name === "TestHips.position"
    ).values;
    for (let index = 0; index < positions.length; index += 3) {
        expect(positions[index]).toBe(positions[0]);
        expect(positions[index + 2]).toBe(positions[2]);
    }
    const tall = bakeAvatarAnimation(makeAvatar(2), source, "avatar:walk");
    expect(
        tall.tracks.find((track) => track.name === "TestHips.position")
            .values[1]
    ).toBeCloseTo(positions[1] * 2);
});

test("saved library avatars retain their rigged source after generic optimization", () => {
    const source = getAvatarSource({
        token_id: "oncyber-avatar-square",
        d_optimized_files: { high: "unrigged.glb" },
    });
    expect(source).toContain("filename=square.glb");
    expect(getAvatarSource({ token_id: "custom-upload" })).toBeUndefined();
});
