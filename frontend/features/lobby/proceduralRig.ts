import type * as THREE from "three";
import type {
    LobbyMotionInput,
    LobbyClipMetadata,
    LobbyLocomotionPose,
} from "./locomotion";
import { createLobbyPosture } from "./lobbyPosture";

type MathLibrary = Pick<typeof THREE, "Vector3" | "Quaternion">;
type BoneLookup = (name: string) => THREE.Object3D | null;

/** Small instance-transform offsets preserve the shared crowd atlas and draw calls. */
export function createCrowdPosture(math: MathLibrary, root: THREE.Object3D) {
    const posture = createLobbyPosture();
    const base = root.quaternion.clone();
    const rotation = new math.Quaternion();
    const x = new math.Vector3(1, 0, 0);
    const z = new math.Vector3(0, 0, 1);
    let adjusted = false;
    return (
        dt: number,
        motion?: LobbyMotionInput,
        sampled?: LobbyLocomotionPose
    ) => {
        const pose = posture.update(dt, motion);
        const moving = Math.abs(pose.pitch) + Math.abs(pose.roll) > 0.00001;
        if (!moving && !adjusted) return;
        adjusted = moving;
        root.quaternion.copy(base);
        if (!moving) return;
        // Full skeletons distribute these through hips/spine. Instances use a
        // smaller silhouette correction about their grounded origin instead.
        root.quaternion.multiply(
            rotation.setFromAxisAngle(x, pose.pitch * 0.3)
        );
        root.quaternion.multiply(
            rotation.setFromAxisAngle(
                z,
                pose.roll * 0.5 * (1 - (sampled?.turnWeight || 0))
            )
        );
    };
}

/**
 * Flat-floor, bounded two-bone IK on normalized VRM bones. Constructor injection
 * keeps legacy and modern Three isolated. All scratch objects are allocated once.
 * Call restore BEFORE animation sampling; update AFTER sampling, BEFORE vrm.update.
 */
export function createProceduralRig(
    math: MathLibrary,
    root: THREE.Object3D,
    bone: BoneLookup,
    clips: Record<string, LobbyClipMetadata> = {}
) {
    const posture = createLobbyPosture();
    const hips = bone("hips");
    const chestCandidate = bone("chest") || bone("spine");
    const chest = chestCandidate !== hips ? chestCandidate : null;
    const v = () => new math.Vector3();
    const q = () => new math.Quaternion();
    const origin = v(),
        oldOrigin = v(),
        scale = v(),
        rootRotation = q();
    const hip = v(),
        knee = v(),
        foot = v(),
        target = v(),
        direction = v();
    const pole = v(),
        desiredKnee = v(),
        from = v(),
        to = v();
    const axis = v(),
        delta = q(),
        world = q(),
        parent = q(),
        footRotation = q();
    const legs = ["left", "right"].flatMap((side) => {
        const upper = bone(`${side}UpperLeg`);
        const lower = bone(`${side}LowerLeg`);
        const ankle = bone(`${side}Foot`);
        if (
            !upper ||
            !lower ||
            !ankle ||
            upper === lower ||
            lower === ankle ||
            upper === ankle
        )
            return [];
        // A malformed/custom rig degrades to posture rather than distorting limbs.
        if (!upper.children.includes(lower) || !lower.children.includes(ankle))
            return [];
        const ankleLocal = root.worldToLocal(ankle.getWorldPosition(v()));
        const sole = ankleLocal.y;
        const toes = bone(`${side}Toes`);
        const forward =
            toes && toes !== ankle
                ? root.worldToLocal(toes.getWorldPosition(v())).sub(ankleLocal)
                : v().set(0, 0, -1);
        forward.y = 0;
        if (forward.lengthSq() < 1e-8) forward.set(0, 0, -1);
        forward.normalize();
        return [
            {
                side,
                upper,
                lower,
                ankle,
                sole,
                forward,
                anchor: v(),
                target: v(),
                orientation: q(),
                animated: v(),
                previous: v(),
                weight: 0,
                locked: false,
                initialized: false,
                releaseTime: 0,
            },
        ];
    });
    const nodes = new Set<THREE.Object3D>();
    if (hips) nodes.add(hips);
    if (chest) nodes.add(chest);
    for (const leg of legs) {
        nodes.add(leg.upper);
        nodes.add(leg.lower);
        nodes.add(leg.ankle);
    }
    const bases = Array.from(nodes, (node) => ({ node, rotation: q() }));
    let applied = false;
    let tracked = false;
    let oldScale = 0;

    function restore() {
        if (!applied) return;
        for (const base of bases) base.node.quaternion.copy(base.rotation);
        applied = false;
    }
    function release() {
        tracked = false;
        for (const leg of legs) {
            leg.locked = leg.initialized = false;
            leg.weight = leg.releaseTime = 0;
        }
    }
    function worldRotate(node: THREE.Object3D, rotation: THREE.Quaternion) {
        node.getWorldQuaternion(world);
        world.premultiply(rotation);
        if (node.parent) {
            node.parent.getWorldQuaternion(parent).invert();
            world.premultiply(parent);
        }
        node.quaternion.copy(world).normalize();
        node.updateWorldMatrix(false, true);
    }
    function rotate(
        node: THREE.Object3D,
        x: number,
        y: number,
        z: number,
        angle: number
    ) {
        if (Math.abs(angle) < 0.00001) return;
        axis.set(x, y, z).applyQuaternion(rootRotation);
        worldRotate(node, delta.setFromAxisAngle(axis, angle));
    }
    function pointBone(
        node: THREE.Object3D,
        oldDirection: THREE.Vector3,
        newDirection: THREE.Vector3
    ) {
        if (oldDirection.lengthSq() < 1e-10 || newDirection.lengthSq() < 1e-10)
            return;
        delta.setFromUnitVectors(
            oldDirection.normalize(),
            newDirection.normalize()
        );
        worldRotate(node, delta);
    }
    function solve(leg: (typeof legs)[number]) {
        leg.upper.getWorldPosition(hip);
        leg.lower.getWorldPosition(knee);
        leg.ankle.getWorldPosition(foot);
        leg.ankle
            .getWorldQuaternion(footRotation)
            .slerp(leg.orientation, leg.weight);
        const upperLength = hip.distanceTo(knee);
        const lowerLength = knee.distanceTo(foot);
        if (Math.min(upperLength, lowerLength) < 1e-5) return;
        target.copy(leg.target);
        direction.subVectors(target, hip);
        const distance = Math.max(
            Math.abs(upperLength - lowerLength) + 1e-5,
            Math.min(upperLength + lowerLength - 1e-5, direction.length())
        );
        if (direction.lengthSq() < 1e-10) return;
        direction.normalize();
        target.copy(hip).addScaledVector(direction, distance);
        // Infer bend from the AUTHORED hip-to-foot axis. Using the target axis
        // makes a straight leg bend sideways as soon as a contact moves laterally.
        to.subVectors(foot, hip).normalize();
        pole.subVectors(knee, hip).addScaledVector(to, -pole.dot(to));
        if (pole.length() < (upperLength + lowerLength) * 0.05)
            pole.copy(leg.forward).applyQuaternion(rootRotation);
        pole.addScaledVector(direction, -pole.dot(direction));
        if (pole.lengthSq() < 1e-8) return;
        pole.normalize();
        const along =
            (upperLength ** 2 - lowerLength ** 2 + distance ** 2) /
            (2 * distance);
        const bend = Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2));
        desiredKnee
            .copy(hip)
            .addScaledVector(direction, along)
            .addScaledVector(pole, bend);
        pointBone(
            leg.upper,
            from.subVectors(knee, hip),
            to.subVectors(desiredKnee, hip)
        );
        leg.lower.getWorldPosition(knee);
        leg.ankle.getWorldPosition(foot);
        pointBone(
            leg.lower,
            from.subVectors(foot, knee),
            to.subVectors(target, knee)
        );
        // The contact foot keeps its world orientation while hips turn over it.
        leg.ankle.parent.getWorldQuaternion(parent).invert();
        leg.ankle.quaternion.copy(parent).multiply(footRotation).normalize();
        leg.ankle.updateWorldMatrix(false, true);
    }
    return {
        restore,
        reset: release,
        update(
            dt: number,
            motion?: LobbyMotionInput,
            sampled?: LobbyLocomotionPose
        ) {
            const step = Math.max(
                0,
                Math.min(Number.isFinite(dt) ? dt : 0, 0.1)
            );
            const pose = posture.update(step, motion);
            const rolling =
                sampled &&
                ((sampled.primary.name.endsWith("_ROLL") &&
                    sampled.blend < 1) ||
                    (sampled.secondary.name.endsWith("_ROLL") &&
                        sampled.blend > 0));
            const enabled =
                !rolling &&
                motion &&
                motion.procedural !== false &&
                motion.quality !== "crowd" &&
                motion.grounded;
            if (!enabled || step === 0) {
                release();
                return;
            }
            root.updateWorldMatrix(true, true);
            root.getWorldPosition(origin);
            root.getWorldScale(scale);
            root.getWorldQuaternion(rootRotation);
            const unit = Math.abs(scale.y);
            if (!Number.isFinite(unit) || unit < 1e-6) {
                release();
                return;
            }
            if (
                tracked &&
                (origin.distanceTo(oldOrigin) > unit * 0.5 ||
                    Math.abs(unit / oldScale - 1) > 0.05)
            )
                release();
            oldOrigin.copy(origin);
            oldScale = unit;
            tracked = true;
            for (const base of bases) base.rotation.copy(base.node.quaternion);
            applied = true;
            // Detect contact in the authored pose, before adding torso movement.
            for (const leg of legs) {
                leg.ankle.getWorldPosition(leg.animated);
                leg.upper.getWorldPosition(hip);
                leg.lower.getWorldPosition(knee);
                const length =
                    hip.distanceTo(knee) + knee.distanceTo(leg.animated);
                const floor = origin.y + leg.sole * unit;
                const clearance = leg.animated.y - floor;
                const rising = leg.initialized
                    ? (leg.animated.y - leg.previous.y) / step
                    : 0;
                const drift = leg.locked
                    ? leg.animated.distanceTo(leg.anchor)
                    : 0;
                const turning = Math.abs(motion.turnRate || 0);
                const moving = motion.speed > 0.04 || turning > 0.25;
                const contact = (name: string, time: number) => {
                    const clip = clips[name],
                        samples = clip?.contacts?.[leg.side];
                    if (!samples?.length) return undefined;
                    const phase =
                        clip.loop === false
                            ? Math.max(0, Math.min(1, time / clip.duration))
                            : (((time / clip.duration) % 1) + 1) % 1;
                    const index = phase * (samples.length - 1),
                        lo = Math.floor(index);
                    return (
                        samples[lo] +
                        (samples[Math.min(samples.length - 1, lo + 1)] -
                            samples[lo]) *
                            (index - lo)
                    );
                };
                const first =
                    sampled &&
                    contact(sampled.primary.name, sampled.primary.time);
                const second =
                    sampled &&
                    contact(sampled.secondary.name, sampled.secondary.time);
                const confidence =
                    first === undefined || second === undefined
                        ? undefined
                        : first * (1 - sampled.blend) + second * sampled.blend;
                const eligible =
                    Number.isFinite(motion.speed) &&
                    (confidence === undefined
                        ? motion.speed < 1.8
                        : motion.speed < 6.5) &&
                    turning <= 3.5;
                leg.ankle.getWorldQuaternion(footRotation);
                const leaving =
                    !eligible ||
                    (confidence !== undefined && confidence < 0.25) ||
                    clearance > length * 0.085 ||
                    drift > length * 0.24 ||
                    (leg.locked &&
                        footRotation.angleTo(leg.orientation) > 0.55);
                if (leg.locked && leaving) {
                    leg.locked = false;
                    leg.releaseTime = 0.12;
                }
                leg.releaseTime = Math.max(0, leg.releaseTime - step);
                if (
                    !leg.locked &&
                    leg.releaseTime === 0 &&
                    eligible &&
                    moving &&
                    (confidence === undefined || confidence > 0.65) &&
                    clearance < length * 0.045 &&
                    rising < length * 0.5
                ) {
                    leg.locked = true;
                    leg.anchor.copy(leg.animated);
                    leg.anchor.y = Math.max(floor, leg.anchor.y);
                    leg.ankle.getWorldQuaternion(leg.orientation);
                }
                leg.weight = Math.max(
                    0,
                    Math.min(
                        1,
                        leg.weight + (leg.locked ? step / 0.045 : -step / 0.07)
                    )
                );
                leg.target.copy(leg.animated);
                if (motion.warping && sampled && motion.speed > 0.04) {
                    // Warp the swing target about its own hip in avatar space.
                    // The controller divides cadence by this same stride scale.
                    from.subVectors(leg.animated, hip).applyQuaternion(
                        parent.copy(rootRotation).invert()
                    );
                    const stride = sampled.strideScale || 1;
                    from.addScaledVector(
                        leg.forward,
                        from.dot(leg.forward) * (stride - 1)
                    );
                    const heading = Number.isFinite(motion.headingError)
                        ? Math.max(
                              -0.5,
                              Math.min(
                                  0.5,
                                  motion.headingError *
                                      0.65 *
                                      (1 - (sampled?.turnWeight || 0) * 0.6)
                              )
                          )
                        : 0;
                    from.applyQuaternion(
                        delta.setFromAxisAngle(axis.set(0, 1, 0), heading)
                    );
                    leg.target
                        .copy(hip)
                        .add(from.applyQuaternion(rootRotation));
                }
                leg.target.lerp(leg.anchor, leg.weight);
                leg.previous.copy(leg.animated);
                leg.initialized = true;
            }
            const residualTurn = 1 - (sampled?.turnWeight || 0);
            if (hips) {
                rotate(hips, 1, 0, 0, pose.pitch * 0.3);
                rotate(hips, 0, 0, 1, pose.roll * 0.4 * residualTurn);
                rotate(hips, 0, 1, 0, -pose.twist * 0.3 * residualTurn);
            }
            if (chest) {
                rotate(chest, 1, 0, 0, pose.pitch * 0.7);
                rotate(chest, 0, 0, 1, pose.roll * 0.6 * residualTurn);
                rotate(chest, 0, 1, 0, pose.twist * 1.3 * residualTurn);
            }
            for (const leg of legs)
                if (
                    leg.weight > 0 ||
                    (motion.warping && sampled && motion.speed > 0.04)
                )
                    solve(leg);
        },
    };
}
