import AVATARS from "../../../player/vrms.json";
import {
    AnimationClip,
    AnimationMixer,
    LoopOnce,
    QuaternionKeyframeTrack,
    VectorKeyframeTrack,
} from "three";
import loadMixamoAnimation from "../../../player/instanceavatarvrm/baker/loadmixamoanimation";

// Avatar actions a placed avatar artwork can play. `source` names a clip in
// the shared Mixamo animation set.
export const AVATAR_ANIMATIONS = [
    { name: "avatar:idle", label: "Idle", source: "idle" },
    { name: "avatar:walk", label: "Walk", source: "walk" },
    { name: "avatar:wave", label: "Wave", source: "waving" },
    { name: "avatar:dance", label: "Dance", source: "hiphop" },
    { name: "avatar:sit", label: "Sit on the ground", source: "floorsitting" },
    { name: "avatar:cheer", label: "Cheer", source: "hand_raising" },
    { name: "avatar:point", label: "Point", source: "pointing" },
];

export function isAvatarAsset(asset) {
    return String(asset?.token_id || "").startsWith("oncyber-avatar-");
}

const avatarSources = new Map(
    Object.values(AVATARS).map((avatar) => [
        `oncyber-avatar-${avatar.id}`,
        avatar.url,
    ])
);

export function getAvatarSource(asset) {
    return avatarSources.get(asset?.token_id);
}

let animationData;
const clips = new WeakMap();

function loadAnimationData() {
    if (!animationData) {
        // The same clips the avatar baker loads (the 228 KB binary, JSON only
        // as a fallback), so a world with both downloads them once.
        animationData = import(
            "../../../player/instanceavatarvrm/baker/animationData.js"
        )
            .then((module) => module.loadBakerAnimations())
            .catch((error) => {
                animationData = null;
                throw error;
            });
    }
    return animationData;
}

// Bake the normalized VRM motion onto its raw bones once. These tracks can then
// animate independent skeleton clones without sharing a live VRM controller.
export function bakeAvatarAnimation(vrm, data, name) {
    const humanoid = vrm.humanoid;
    const rawPose = humanoid.getRawPose();
    const normalizedPose = humanoid.getNormalizedPose();
    const mixer = new AnimationMixer(vrm.scene);
    const bones = Object.entries(humanoid.rawHumanBones).map(
        ([bone, value]) => ({
            bone,
            node: value.node,
            rotations: [],
            positions: [],
        })
    );
    const times = [];
    try {
        humanoid.resetNormalizedPose();
        humanoid.update();
        vrm.scene.updateMatrixWorld(true);
        const clip = loadMixamoAnimation(null, vrm, data);
        const action = mixer.clipAction(clip);
        action.setLoop(LoopOnce, 1);
        action.clampWhenFinished = true;
        action.play();
        const frames = Math.max(1, Math.ceil(clip.duration * 30));
        let hipsOrigin;
        for (let frame = 0; frame <= frames; frame++) {
            const time = (frame / frames) * clip.duration;
            times.push(time);
            mixer.setTime(time);
            humanoid.update();
            for (const entry of bones) {
                entry.node.quaternion.toArray(entry.rotations, frame * 4);
                if (entry.bone === "hips") {
                    hipsOrigin ||= entry.node.position.clone();
                    // Keep locomotion in place; retain vertical motion and poses.
                    entry.positions.push(
                        hipsOrigin.x,
                        entry.node.position.y,
                        hipsOrigin.z
                    );
                }
            }
        }
        const tracks = bones.flatMap((entry) => {
            const result = [
                new QuaternionKeyframeTrack(
                    `${entry.node.name}.quaternion`,
                    times,
                    entry.rotations
                ),
            ];
            if (entry.bone === "hips") {
                result.push(
                    new VectorKeyframeTrack(
                        `${entry.node.name}.position`,
                        times,
                        entry.positions
                    )
                );
            }
            return result;
        });
        return new AnimationClip(name, clip.duration, tracks);
    } finally {
        mixer.stopAllAction();
        mixer.uncacheRoot(vrm.scene);
        humanoid.setNormalizedPose(normalizedPose);
        humanoid.setRawPose(rawPose);
        vrm.scene.updateMatrixWorld(true);
    }
}

export async function getAvatarAnimation(gltf, name) {
    const option = AVATAR_ANIMATIONS.find((entry) => entry.name === name);
    const vrm = gltf.userData?.vrm;
    if (!vrm?.humanoid || !option) return null;
    let cached = clips.get(gltf);
    if (!cached) clips.set(gltf, (cached = new Map()));
    if (!cached.has(name)) {
        const promise = loadAnimationData()
            .then((data) => {
                const source = data.find((clip) => clip.name === option.source);
                return bakeAvatarAnimation(vrm, source, name);
            })
            .catch((error) => {
                cached.delete(name);
                throw error;
            });
        cached.set(name, promise);
    }
    return cached.get(name);
}
