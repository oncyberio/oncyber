import {
    AnimationClip,
    AnimationMixer,
    QuaternionKeyframeTrack,
    Vector3,
} from "three";
import { TOON_AVATAR_PRESETS } from "../presets";
import { randomRecipe } from "../random";
import { defaultRecipe, setRecipeField } from "../recipe";
import { TOON_BONES } from "../skeleton";
import { ToonAvatar } from "./avatar";
import { TOON_MOTIONS, ToonAnimator, ToonSecondaryMotion } from "./motion";
import { createToonVrm } from "./vrm";

const world = (avatar: ToonAvatar, bone: keyof ToonAvatar["bones"]) => {
    avatar.root.updateMatrixWorld(true);
    return avatar.bones[bone].getWorldPosition(new Vector3());
};

describe("ToonAvatar", () => {
    it("builds a bound, T-posed humanoid with unrotated rest bones", () => {
        const avatar = new ToonAvatar(defaultRecipe());
        expect(avatar.skeleton.bones.map((bone) => bone.name)).toEqual([
            ...TOON_BONES,
        ]);
        expect(avatar.skeleton.boneInverses).toHaveLength(TOON_BONES.length);
        for (const bone of avatar.skeleton.bones)
            expect(bone.quaternion.toArray()).toEqual([0, 0, 0, 1]);
        expect(avatar.mesh.skeleton).toBe(avatar.outline.skeleton);
        expect(avatar.mesh.geometry).toBe(avatar.outline.geometry);
        // Facing +Z with the left arm along +X, feet near the floor.
        const hand = world(avatar, "leftHand");
        const shoulder = world(avatar, "leftUpperArm");
        expect(hand.x).toBeGreaterThan(shoulder.x + 0.3);
        expect(hand.y).toBeCloseTo(shoulder.y, 5);
        expect(world(avatar, "leftToes").z).toBeGreaterThan(
            world(avatar, "leftFoot").z
        );
        expect(world(avatar, "leftFoot").y).toBeLessThan(0.1);
        avatar.dispose();
    });

    it("rebuilds in place when the recipe changes", () => {
        const avatar = new ToonAvatar(defaultRecipe());
        const { root, skeleton } = avatar;
        const before = avatar.mesh.geometry;
        const dispose = jest.spyOn(before, "dispose");
        const short = world(avatar, "head").y;
        avatar.bones.spine.rotation.x = 1;
        avatar.setRecipe(setRecipeField(defaultRecipe(), "body", "height", 1));
        expect(avatar.root).toBe(root);
        expect(avatar.skeleton).toBe(skeleton);
        expect(avatar.mesh.geometry).not.toBe(before);
        expect(dispose).toHaveBeenCalled();
        expect(avatar.bones.spine.quaternion.toArray()).toEqual([0, 0, 0, 1]);
        expect(world(avatar, "head").y).toBeGreaterThan(short + 0.2);
        avatar.dispose();
    });

    it("builds every preset", () => {
        for (const preset of TOON_AVATAR_PRESETS)
            new ToonAvatar(preset.recipe).dispose();
    });
});

describe("toon motion", () => {
    it("plays every move without breaking the skeleton", () => {
        for (const seed of [1, 2, 3]) {
            const avatar = new ToonAvatar(randomRecipe(seed));
            const bone = (name: string) =>
                avatar.bones[name as keyof ToonAvatar["bones"]];
            const animator = new ToonAnimator(bone, avatar.layout, () => 0.5);
            const secondary = new ToonSecondaryMotion(avatar.root, bone);
            for (const motion of TOON_MOTIONS) {
                animator.play(motion);
                for (let frame = 0; frame < 90; frame++) {
                    animator.update(1 / 30);
                    avatar.root.updateMatrixWorld(true);
                    secondary.update(1 / 30);
                    avatar.setExpression(animator.expression);
                }
                for (const part of avatar.skeleton.bones) {
                    const all = [
                        ...part.quaternion.toArray(),
                        ...part.position.toArray(),
                    ];
                    expect(all.every(Number.isFinite)).toBe(true);
                    expect(part.quaternion.length()).toBeCloseTo(1, 4);
                }
                // Nobody sinks through the floor or leaves the room.
                const hips = world(avatar, "hips");
                expect(hips.y).toBeGreaterThan(
                    avatar.layout.joints.hips[1] * 0.5
                );
                expect(hips.y).toBeLessThan(avatar.layout.height * 1.4);
            }
            avatar.dispose();
        }
    });

    it("lowers the arms when standing and swings opposite limbs when walking", () => {
        const avatar = new ToonAvatar(defaultRecipe());
        const animator = new ToonAnimator(
            (name) => avatar.bones[name as keyof ToonAvatar["bones"]],
            avatar.layout,
            () => 0.5
        );
        animator.update(0.016);
        expect(world(avatar, "leftHand").y).toBeLessThan(
            world(avatar, "leftUpperArm").y - 0.3
        );
        expect(world(avatar, "rightHand").y).toBeLessThan(
            world(avatar, "rightUpperArm").y - 0.3
        );
        animator.play("walk", 0.001);
        let opposed = 0;
        for (let frame = 0; frame < 60; frame++) {
            animator.update(1 / 30);
            const leftFoot = world(avatar, "leftFoot").z;
            const rightFoot = world(avatar, "rightFoot").z;
            const leftHand = world(avatar, "leftHand").z;
            const rightHand = world(avatar, "rightHand").z;
            if (
                Math.abs(leftFoot - rightFoot) > 0.1 &&
                leftFoot > rightFoot === rightHand > leftHand
            )
                opposed++;
        }
        expect(opposed).toBeGreaterThan(20);
        avatar.dispose();
    });

    it("blinks", () => {
        const avatar = new ToonAvatar(defaultRecipe());
        const animator = new ToonAnimator(
            () => null,
            avatar.layout,
            () => 0
        );
        let closed = 0;
        for (let frame = 0; frame < 300; frame++) {
            animator.update(1 / 60);
            closed = Math.max(closed, animator.expression.blinkLeft);
        }
        expect(closed).toBeGreaterThan(0.9);
        avatar.dispose();
    });
});

describe("createToonVrm", () => {
    it("offers the humanoid surface VRM code expects", () => {
        const vrm = createToonVrm(defaultRecipe());
        expect(vrm.meta.metaVersion).toBe("1");
        expect(vrm.humanoid.getNormalizedBoneNode("hips")).toBe(
            vrm.avatar.bones.hips
        );
        expect(
            vrm.humanoid.getNormalizedBoneNode("leftIndexProximal")
        ).toBeNull();
        // Helper bones are not humanoid bones.
        expect(vrm.humanoid.getNormalizedBoneNode("hairTail")).toBeNull();
        expect(vrm.displayHeight).toBeGreaterThan(1.2);
        expect(vrm.displayHeight).toBeLessThanOrEqual(2.1);

        const rest = vrm.humanoid.getNormalizedPose();
        vrm.avatar.bones.head.rotation.y = 1;
        const turned = vrm.humanoid.getNormalizedPose();
        vrm.humanoid.resetNormalizedPose();
        expect(vrm.humanoid.getNormalizedPose()).toEqual(rest);
        vrm.humanoid.setNormalizedPose(turned);
        expect(vrm.humanoid.getNormalizedPose()).toEqual(turned);
        expect(() => vrm.update(0)).not.toThrow();
        expect(() => vrm.update(1 / 60)).not.toThrow();
        vrm.avatar.dispose();
    });

    it("is driven by clips that name normalized humanoid bones", () => {
        const vrm = createToonVrm(defaultRecipe());
        const node = vrm.humanoid.getNormalizedBoneNode("leftUpperArm");
        const clip = new AnimationClip("lower-arm", 1, [
            new QuaternionKeyframeTrack(
                `${node.name}.quaternion`,
                [0, 1],
                [0, 0, 0, 1, 0, 0, -Math.SQRT1_2, Math.SQRT1_2]
            ),
        ]);
        const mixer = new AnimationMixer(vrm.scene);
        mixer.clipAction(clip).play();
        mixer.update(0.999);
        vrm.scene.updateMatrixWorld(true);
        const hand = vrm.avatar.bones.leftHand.getWorldPosition(new Vector3());
        const shoulder = vrm.avatar.bones.leftUpperArm.getWorldPosition(
            new Vector3()
        );
        // A quarter turn about Z brings the T-posed arm straight down.
        expect(hand.x).toBeCloseTo(shoulder.x, 1);
        expect(hand.y).toBeLessThan(shoulder.y - 0.3);
        vrm.avatar.dispose();
    });
});
