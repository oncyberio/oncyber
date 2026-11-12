import { LOBBY_STOP_CLIPS } from "./motionNames";
import { LOBBY_IDLE_CLIPS } from "./idleVariants";
import type * as THREE from "three";
import type { LobbyClipMetadata } from "./locomotion";

type Library = Pick<
    typeof THREE,
    | "AnimationClip"
    | "AnimationMixer"
    | "Quaternion"
    | "Vector3"
    | "QuaternionKeyframeTrack"
    | "VectorKeyframeTrack"
>;
type SampledTrack = THREE.KeyframeTrack & {
    createInterpolant(): { evaluate(time: number): Float32Array };
};
type Lookup = (name: string) => THREE.Object3D | null;
export const LOBBY_TRANSITIONS = [
    "START_L",
    "START_R",
    ...LOBBY_STOP_CLIPS,
    "PIVOT_L90",
    "PIVOT_R90",
    "PIVOT_L180",
    "PIVOT_R180",
] as const;

/** Author compact, non-looping transitions from our existing retargeted poses.
 * No external animation assets. Physics retains ownership of world translation/yaw.
 */
export function authorLobbyTransitions(
    math: Library,
    idle: THREE.AnimationClip,
    walk: THREE.AnimationClip,
    bone: Lookup
) {
    if (
        !idle ||
        !walk ||
        bone("leftFoot") === bone("rightFoot") ||
        !bone("leftFoot") ||
        !bone("rightFoot")
    )
        return [];
    const smooth = (t: number) => t * t * (3 - 2 * t);
    const qa = new math.Quaternion(),
        qb = new math.Quaternion(),
        offset = new math.Quaternion();
    const axis = new math.Vector3();
    const idleTracks = new Map(idle.tracks.map((t) => [t.name, t]));
    const hipsName = bone("hips")?.name;
    const chestName = (bone("chest") || bone("spine"))?.name;
    return LOBBY_TRANSITIONS.map((name) => {
        const start = name.startsWith("START"),
            stop = name.startsWith("STOP");
        const left = name.split("_")[1].startsWith("L"),
            sign = left ? 1 : -1;
        const pivot = !start && !stop;
        const duration = start
            ? 0.28
            : stop
            ? 0.36
            : name.endsWith("180")
            ? 0.72
            : 0.48;
        const phase = left ? 0 : 0.5;
        const frames = Math.ceil(duration * 30) + 1;
        const times = Array.from(
            { length: frames },
            (_, i) => (duration * i) / (frames - 1)
        );
        const tracks = walk.tracks.flatMap((track) => {
            const idleTrack = idleTracks.get(track.name);
            if (!idleTrack) return [];
            const rotation = track.name.endsWith(".quaternion");
            if (!rotation && !track.name.endsWith(".position")) return [];
            const size = rotation ? 4 : 3;
            const a = (idleTrack as SampledTrack).createInterpolant();
            const b = (track as SampledTrack).createInterpolant();
            const values: number[] = [];
            for (let i = 0; i < frames; i++) {
                const t = i / (frames - 1),
                    envelope = Math.sin(Math.PI * t) ** 2;
                // Starts lead into a swing; stops complete the supporting half-step.
                // Pivots take a short alternating step, with a counter-rotating pelvis.
                const p =
                    phase +
                    (start
                        ? 0.22 * t
                        : stop
                        ? (name.endsWith("_LATE") ? 0.48 : 0.23) +
                          0.1 * smooth(t)
                        : t * (name.endsWith("180") ? 1 : 0.5));
                const blend = start
                    ? smooth(t)
                    : stop
                    ? 1 - smooth(t)
                    : envelope * 0.65;
                const av = a.evaluate(0),
                    bv = b.evaluate((p % 1) * walk.duration);
                if (rotation) {
                    qa.fromArray(av);
                    qb.fromArray(bv);
                    qa.slerp(qb, blend);
                    if (track.name === `${hipsName}.quaternion`) {
                        qa.multiply(
                            offset.setFromAxisAngle(
                                axis.set(1, 0, 0),
                                envelope * (start ? -0.055 : stop ? 0.07 : 0)
                            )
                        );
                        if (pivot)
                            qa.multiply(
                                offset.setFromAxisAngle(
                                    axis.set(0, 1, 0),
                                    -sign * envelope * 0.16
                                )
                            );
                    }
                    if (pivot && track.name === `${chestName}.quaternion`)
                        qa.multiply(
                            offset.setFromAxisAngle(
                                axis.set(0, 1, 0),
                                sign * envelope * 0.24
                            )
                        );
                    qa.normalize().toArray(values, i * size);
                } else
                    for (let j = 0; j < size; j++)
                        values.push(av[j] + (bv[j] - av[j]) * blend);
            }
            return [
                rotation
                    ? new math.QuaternionKeyframeTrack(
                          track.name,
                          times,
                          values
                      )
                    : new math.VectorKeyframeTrack(track.name, times, values),
            ];
        });
        const clip = new math.AnimationClip(name, duration, tracks);
        const metadata: LobbyClipMetadata = {
            duration,
            loop: false,
            exitPhase: (phase + 0.22) % 1,
            // Remaining fraction of travel sampled at uniform clip times. Stop
            // travel finishes before the final settling pose (last 30 percent).
            distance: stop
                ? [1, 0.72, 0.46, 0.25, 0.11, 0.03, 0, 0, 0]
                : undefined,
        };
        return { clip, metadata };
    });
}

/** Bake support confidence on the retargeted avatar once, outside the frame loop.
 * Height and velocity gates scale with each leg, so short/stylized rigs do not
 * inherit human-sized thresholds. Preserves the caller's pose and live mixer.
 */
export async function calibrateLobbyContacts(
    math: Library,
    root: THREE.Object3D,
    clips: THREE.AnimationClip[],
    metadata: Record<string, LobbyClipMetadata>,
    bone: Lookup
) {
    const feet = [bone("leftFoot"), bone("rightFoot")];
    if (!feet[0] || !feet[1] || feet[0] === feet[1]) return;
    const poses: {
        node: THREE.Object3D;
        p: THREE.Vector3;
        q: THREE.Quaternion;
        s: THREE.Vector3;
    }[] = [];
    root.traverse((node) =>
        poses.push({
            node,
            p: node.position.clone(),
            q: node.quaternion.clone(),
            s: node.scale.clone(),
        })
    );
    const point = new math.Vector3(),
        knee = new math.Vector3(),
        hip = new math.Vector3();
    const lengths = ["left", "right"].map((side, i) => {
        const upper = bone(`${side}UpperLeg`),
            lower = bone(`${side}LowerLeg`);
        if (!upper || !lower) return 1;
        upper.getWorldPosition(hip);
        lower.getWorldPosition(knee);
        feet[i].getWorldPosition(point);
        return Math.max(0.001, hip.distanceTo(knee) + knee.distanceTo(point));
    });
    const mixer = new math.AnimationMixer(root);
    try {
        for (const clip of clips) {
            if (
                (!metadata[clip.name]?.turn &&
                    !clip.name.startsWith("DROP_") &&
                    ![
                        ...LOBBY_IDLE_CLIPS,
                        "WALK",
                        "RUN",
                        "SPRINT",
                        ...LOBBY_TRANSITIONS,
                    ].includes(clip.name)) ||
                !metadata[clip.name] ||
                clip.duration > 4 ||
                !Number.isFinite(clip.duration)
            )
                continue;
            const count = Math.ceil(clip.duration * 30) + 1;
            const positions = [
                new Float32Array(count * 3),
                new Float32Array(count * 3),
            ];
            const stance = new Float32Array(count * 6);
            const pelvis = bone("hips");
            mixer.stopAllAction();
            const action = mixer.clipAction(clip);
            // LoopOnce's stable numeric constant is shared by both Three builds.
            action.setLoop(2200, 1);
            action.clampWhenFinished = true;
            action.play();
            for (let frame = 0; frame < count; frame++) {
                mixer.setTime((clip.duration * frame) / (count - 1));
                root.updateMatrixWorld(true);
                if (pelvis) pelvis.getWorldPosition(hip);
                feet.forEach((foot, i) => {
                    foot.getWorldPosition(point).toArray(
                        positions[i],
                        frame * 3
                    );
                    if (pelvis)
                        point
                            .sub(hip)
                            .divideScalar(lengths[i])
                            .toArray(stance, frame * 6 + i * 3);
                });
            }
            const contacts = positions.map((samples, side) => {
                let floor = Infinity;
                for (let i = 1; i < samples.length; i += 3)
                    floor = Math.min(floor, samples[i]);
                const result = new Float32Array(count);
                for (let i = 0; i < count; i++) {
                    const lo = Math.max(0, i - 1),
                        hi = Math.min(count - 1, i + 1);
                    const vy =
                        (samples[hi * 3 + 1] - samples[lo * 3 + 1]) /
                        Math.max(
                            0.001,
                            ((hi - lo) * clip.duration) / (count - 1)
                        );
                    const clearance =
                        (samples[i * 3 + 1] - floor) / lengths[side];
                    result[i] =
                        Math.max(0, Math.min(1, (0.075 - clearance) / 0.05)) *
                        Math.max(
                            0,
                            Math.min(1, (0.6 - vy / lengths[side]) / 0.4)
                        );
                }
                return result;
            });
            if (pelvis) metadata[clip.name].stance = stance;
            // Landing poses participate in idle matching, while retaining their
            // existing authored contact/IK behavior.
            if (clip.name.startsWith("DROP_")) continue;
            metadata[clip.name].contacts = {
                left: contacts[0],
                right: contacts[1],
            };
            if (["WALK", "RUN", "SPRINT"].includes(clip.name)) {
                const speeds: number[] = [];
                positions.forEach((samples, side) => {
                    for (let i = 1; i < count - 1; i++)
                        if (contacts[side][i] > 0.6) {
                            const speed =
                                (Math.hypot(
                                    samples[(i + 1) * 3] - samples[(i - 1) * 3],
                                    samples[(i + 1) * 3 + 2] -
                                        samples[(i - 1) * 3 + 2]
                                ) *
                                    (count - 1)) /
                                (2 * clip.duration);
                            if (speed > 0.1) speeds.push(speed);
                        }
                });
                speeds.sort((a, b) => a - b);
                if (speeds.length)
                    metadata[clip.name].speed = Math.max(
                        clip.name === "WALK" ? 0.8 : 2.5,
                        Math.min(
                            clip.name === "WALK"
                                ? 2.4
                                : clip.name === "SPRINT"
                                ? 10
                                : 6,
                            speeds[speeds.length >> 1]
                        )
                    );
            }
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
    } finally {
        mixer.stopAllAction();
        mixer.uncacheRoot(root);
        for (const { node, p, q, s } of poses) {
            node.position.copy(p);
            node.quaternion.copy(q);
            node.scale.copy(s);
        }
        root.updateMatrixWorld(true);
    }
}
