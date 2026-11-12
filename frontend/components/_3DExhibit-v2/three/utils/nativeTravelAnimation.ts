import {
    avatarLighting,
    isAvatarLighting,
} from "@features/lobby/webgpu/avatarLighting";
import { matchNativeTravelMaterials } from "./nativeTravelMaterials";
import type { LobbyAvatar } from "@features/lobby/webgpu/avatarAdapter";
import {
    TRAVEL_ANIMATION_DURATION_MS,
    TRAVEL_ANIMATION_PLAY_MS,
    TRAVEL_ANIMATION_SPEED,
} from "@features/lobby/travelAnimationPack";

export const NATIVE_TRAVEL_IDLE_BLEND_MS = 180;
/** Stand-up plus its blend into ready idle, unless motion is reduced. */
export const NATIVE_TRAVEL_STAND_UP_MS =
    TRAVEL_ANIMATION_PLAY_MS.TRAVEL_STAND_UP + NATIVE_TRAVEL_IDLE_BLEND_MS;

type Pose = {
    position: { x: number; y: number; z: number };
    rotation: number;
    height: number;
    visible: boolean;
    idleTime: number;
};
type AvatarFactory = (
    url: string,
    options: { signal: AbortSignal; profilePhoto?: string }
) => Promise<LobbyAvatar>;

/** Native baked atlases cannot gain clips at runtime. Use the same independent
 * travel rig as the lobby until the native ready-idle pose takes over. The
 * native player, physics body, network identity and camera stay in place. */
export function createNativeTravelAnimation(
    player: any,
    scene: { add(object: any): void; remove(object: any): void },
    createAvatar: AvatarFactory
) {
    const abort = new AbortController();
    let avatar: LobbyAvatar | undefined;
    let preparation: Promise<void> | undefined;
    let disposed = false;
    let started: number | undefined;
    let standingAt: number | undefined;
    let reduced = false;
    let sourceScale: any;
    let restoreMaterials: (() => void) | undefined;
    const hold = (pose: Pose, now = performance.now()) => {
        if (!avatar || disposed) return;
        started ??= now;
        avatar.root.position.copy(pose.position as any);
        avatar.root.rotation.y = pose.rotation;
        const ratio =
            Number.isFinite(pose.height) && pose.height > 0
                ? pose.height / avatar.height
                : 1;
        avatar.root.scale.copy(sourceScale).multiplyScalar(ratio);
        avatar.root.visible = pose.visible;
        const elapsed = Math.max(0, now - (standingAt ?? started));
        const duration = TRAVEL_ANIMATION_PLAY_MS.TRAVEL_STAND_UP;
        if (reduced) {
            avatar.sampleTravelPose({ name: "IDLE_CC0", time: pose.idleTime });
        } else if (standingAt === undefined) {
            avatar.sampleTravelPose({
                name: "TRAVEL_CROUCH_IDLE",
                time: elapsed / 1000,
            });
        } else if (elapsed < duration) {
            avatar.sampleTravelPose({
                name: "TRAVEL_STAND_UP",
                time: (elapsed * TRAVEL_ANIMATION_SPEED.TRAVEL_STAND_UP) / 1000,
                previous: {
                    name: "TRAVEL_CROUCH_IDLE",
                    time: (standingAt - started) / 1000,
                },
                blend: Math.min(1, elapsed / 100),
            });
        } else {
            avatar.sampleTravelPose({
                name: "IDLE_CC0",
                time: pose.idleTime,
                previous: {
                    name: "TRAVEL_STAND_UP",
                    time: TRAVEL_ANIMATION_DURATION_MS.TRAVEL_STAND_UP / 1000,
                },
                blend: Math.min(
                    1,
                    (elapsed - duration) / NATIVE_TRAVEL_IDLE_BLEND_MS
                ),
            });
        }
    };
    return {
        get active() {
            return !!avatar && !disposed;
        },
        prepare(reducedMotion: boolean) {
            reduced = reducedMotion;
            return (preparation ||= (async () => {
                const model = await createAvatar(
                    player.userData?.VRM || player.avatar3D?.vrmName,
                    {
                        signal: abort.signal,
                        // Native surfaces already own their PFP. A late photo
                        // replacement must never retire a borrowed native map.
                        profilePhoto: player.avatar3D?.highQualityMeshes
                            ? undefined
                            : player.userData?.avatar,
                    }
                );
                try {
                    await model.prepareTravel();
                    if (disposed) throw new Error("Arrival cancelled.");
                } catch (error) {
                    model.dispose();
                    throw error;
                }
                model.root.traverse((mesh: any) => {
                    for (const material of Array.isArray(mesh.material)
                        ? mesh.material
                        : [mesh.material])
                        if (material && isAvatarLighting(material.lightsNode))
                            material.lightsNode = avatarLighting(1);
                });
                restoreMaterials = matchNativeTravelMaterials(
                    model.root,
                    player.avatar3D?.highQualityMeshes
                );
                avatar = model;
                sourceScale = model.root.scale.clone();
                model.root.name = "native-travel-avatar";
                model.root.visible = false;
                scene.add(model.root);
            })());
        },
        hold,
        standUp(now: number, reducedMotion: boolean) {
            reduced ||= reducedMotion;
            standingAt ??= now;
            return reduced ? 0 : NATIVE_TRAVEL_STAND_UP_MS;
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            abort.abort();
            if (avatar) {
                scene.remove(avatar.root);
                restoreMaterials?.();
                avatar.dispose();
                avatar = undefined;
            }
        },
    };
}
