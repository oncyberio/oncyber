import type { Object3D } from "three";
import { TOON_BONES, type ToonBone } from "../skeleton";
import { ToonAvatar } from "./avatar";
import { ToonFaceAnimator, ToonSecondaryMotion } from "./motion";

const HUMANOID = new Set<string>(
    TOON_BONES.filter((name) => name !== "hairTail" && name !== "coatTail")
);

type BonePose = { position: number[]; rotation: number[] };

/**
 * A toon avatar dressed as the object the VRM loader returns, for code that
 * was written for VRM files: a scene, a humanoid that hands out normalized
 * bones by name, and an `update` for per-frame extras. Clips retargeted for
 * a normalized VRM humanoid play on it as they are.
 */
export function createToonVrm(recipe: unknown) {
    const avatar = new ToonAvatar(recipe);
    const bone = (name: string): Object3D | null =>
        HUMANOID.has(name) ? avatar.bones[name as ToonBone] : null;
    const face = new ToonFaceAnimator();
    const secondary = new ToonSecondaryMotion(
        avatar.root,
        (name) => avatar.bones[name as ToonBone]
    );
    const rest = new Map<string, BonePose>();
    for (const name of HUMANOID) {
        const node = avatar.bones[name as ToonBone];
        rest.set(name, {
            position: node.position.toArray(),
            rotation: node.quaternion.toArray(),
        });
    }
    const apply = (pose: Record<string, Partial<BonePose> | undefined>) => {
        for (const [name, value] of Object.entries(pose)) {
            const node = bone(name);
            if (!node || !value) continue;
            if (value.position) node.position.fromArray(value.position);
            if (value.rotation) node.quaternion.fromArray(value.rotation);
        }
    };
    return {
        avatar,
        scene: avatar.root,
        meta: { metaVersion: "1" },
        /** Metres. Toon avatars keep their own height instead of a standard one. */
        displayHeight: Math.min(2.1, Math.max(1.25, avatar.height * 1.08)),
        humanoid: {
            getNormalizedBoneNode: bone,
            getNormalizedPose() {
                const pose: Record<string, BonePose> = {};
                for (const name of HUMANOID) {
                    const node = avatar.bones[name as ToonBone];
                    pose[name] = {
                        position: node.position.toArray(),
                        rotation: node.quaternion.toArray(),
                    };
                }
                return pose;
            },
            resetNormalizedPose() {
                apply(Object.fromEntries(rest));
            },
            setNormalizedPose(pose: unknown) {
                if (pose && typeof pose === "object")
                    apply(pose as Record<string, Partial<BonePose>>);
            },
        },
        /** Set 0..1 from a voice level to move the mouth. */
        setTalk(level: number) {
            face.talk = Math.min(1, Math.max(0, level));
        },
        update(delta: number) {
            avatar.setExpression(face.update(Math.max(0, delta)));
            secondary.update(delta);
        },
    };
}

export type ToonVrm = ReturnType<typeof createToonVrm>;
