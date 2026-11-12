import type * as THREE from "three";
import type { LobbyClipMetadata } from "./locomotion";

type MathLibrary = Pick<
    typeof THREE,
    | "Vector3"
    | "Quaternion"
    | "AnimationClip"
    | "QuaternionKeyframeTrack"
    | "VectorKeyframeTrack"
>;
type Lookup = (name: string) => THREE.Object3D | null;
type SampledTrack = THREE.KeyframeTrack & {
    createInterpolant(): { evaluate(time: number): Float32Array };
};
const wrap = (v: number) => ((v % 1) + 1) % 1;

/** Derive a small turn vocabulary from the selected, retargeted gaits. This is
 * authored procedural motion, not imported mocap. Runs once while preparing a
 * model; the resulting ordinary clips use the existing mixer / crowd atlas.
 */
export async function authorMovingTurns(
    math: MathLibrary,
    root: THREE.Object3D,
    clips: THREE.AnimationClip[],
    metadata: Record<string, LobbyClipMetadata>,
    bone: Lookup
) {
    const hips = bone("hips"),
        chest = bone("chest") || bone("spine");
    const legs = ["left", "right"].map((side) => ({
        upper: bone(`${side}UpperLeg`),
        lower: bone(`${side}LowerLeg`),
        foot: bone(`${side}Foot`),
        toes: bone(`${side}Toes`),
    }));
    if (
        !hips ||
        !chest ||
        legs.some(
            (l) =>
                !l.upper ||
                !l.lower ||
                !l.foot ||
                !l.upper.children.includes(l.lower) ||
                !l.lower.children.includes(l.foot)
        )
    )
        return [];
    const v = () => new math.Vector3(),
        q = () => new math.Quaternion();
    const saved: {
        node: THREE.Object3D;
        p: THREE.Vector3;
        q: THREE.Quaternion;
        s: THREE.Vector3;
    }[] = [];
    root.traverse((node) =>
        saved.push({
            node,
            p: node.position.clone(),
            q: node.quaternion.clone(),
            s: node.scale.clone(),
        })
    );
    const restore = () => {
        for (const s of saved) {
            s.node.position.copy(s.p);
            s.node.quaternion.copy(s.q);
            s.node.scale.copy(s.s);
        }
        root.updateMatrixWorld(true);
    };
    root.updateMatrixWorld(true);
    const rootQ = root.getWorldQuaternion(q()),
        up = v().set(0, 1, 0).applyQuaternion(rootQ);
    const forward = v();
    for (const leg of legs)
        if (leg.toes)
            forward.add(
                leg.toes
                    .getWorldPosition(v())
                    .sub(leg.foot.getWorldPosition(v()))
            );
    forward.addScaledVector(up, -forward.dot(up));
    if (forward.lengthSq() < 1e-8) forward.set(0, 0, -1).applyQuaternion(rootQ);
    forward.normalize();
    const left = v().crossVectors(up, forward).normalize();
    const origin = v(),
        h = v(),
        k = v(),
        f = v(),
        direction = v(),
        pole = v(),
        desiredKnee = v(),
        from = v(),
        to = v();
    const delta = q(),
        world = q(),
        parent = q();
    const length =
        legs.reduce(
            (sum, leg) =>
                sum +
                leg.upper
                    .getWorldPosition(h)
                    .distanceTo(leg.lower.getWorldPosition(k)) +
                k.distanceTo(leg.foot.getWorldPosition(f)),
            0
        ) / 2;
    if (!Number.isFinite(length) || length < 1e-5) return [];
    const worldRotate = (node: THREE.Object3D, rotation: THREE.Quaternion) => {
        node.getWorldQuaternion(world).premultiply(rotation);
        if (node.parent)
            world.premultiply(node.parent.getWorldQuaternion(parent).invert());
        node.quaternion.copy(world).normalize();
        node.updateWorldMatrix(false, true);
    };
    const point = (
        node: THREE.Object3D,
        a: THREE.Vector3,
        b: THREE.Vector3
    ) => {
        if (a.lengthSq() > 1e-10 && b.lengthSq() > 1e-10)
            worldRotate(
                node,
                delta.setFromUnitVectors(a.normalize(), b.normalize())
            );
    };
    const solve = (
        leg: (typeof legs)[number],
        target: THREE.Vector3,
        rotation: THREE.Quaternion
    ) => {
        leg.upper.getWorldPosition(h);
        leg.lower.getWorldPosition(k);
        leg.foot.getWorldPosition(f);
        const a = h.distanceTo(k),
            b = k.distanceTo(f);
        direction.subVectors(target, h);
        const d = Math.max(
            Math.abs(a - b) + 1e-5,
            Math.min(a + b - 1e-5, direction.length())
        );
        if (Math.min(a, b) < 1e-5 || direction.lengthSq() < 1e-10) return;
        direction.normalize();
        target.copy(h).addScaledVector(direction, d);
        to.subVectors(f, h).normalize();
        pole.subVectors(k, h).addScaledVector(to, -pole.dot(to));
        if (pole.length() < (a + b) * 0.05) pole.copy(forward);
        pole.addScaledVector(direction, -pole.dot(direction)).normalize();
        const along = (a * a - b * b + d * d) / (2 * d);
        desiredKnee
            .copy(h)
            .addScaledVector(direction, along)
            .addScaledVector(
                pole,
                Math.sqrt(Math.max(0, a * a - along * along))
            );
        point(leg.upper, from.subVectors(k, h), to.subVectors(desiredKnee, h));
        leg.lower.getWorldPosition(k);
        leg.foot.getWorldPosition(f);
        point(leg.lower, from.subVectors(f, k), to.subVectors(target, k));
        leg.foot.quaternion
            .copy(leg.foot.parent.getWorldQuaternion(parent).invert())
            .multiply(rotation)
            .normalize();
        leg.foot.updateWorldMatrix(false, true);
    };
    const result: { clip: THREE.AnimationClip; metadata: LobbyClipMetadata }[] =
        [];
    const targets = [v(), v()],
        rotations = [q(), q()];
    try {
        for (const source of clips.filter(
            (c) =>
                ["WALK", "RUN", "SPRINT"].includes(c.name) &&
                Number.isFinite(c.duration) &&
                c.duration > 0 &&
                c.duration <= 4
        )) {
            const specs = [-1, 1].flatMap((sign) => {
                const side = sign > 0 ? "L" : "R";
                const base = [
                    {
                        name: `TURN_${source.name}_${side}`,
                        sign,
                        angle: 0,
                        entry: 0,
                    },
                ];
                if (source.name === "RUN")
                    for (const angle of [90, 180])
                        for (const foot of [0, 1]) {
                            // Pick strong support for the selected entry foot.
                            const own =
                                metadata.RUN?.contacts?.[
                                    foot ? "right" : "left"
                                ];
                            const other =
                                metadata.RUN?.contacts?.[
                                    foot ? "left" : "right"
                                ];
                            let entry = foot * 0.5,
                                best = -Infinity;
                            if (own?.length)
                                for (let i = 0; i < own.length - 1; i++) {
                                    const score =
                                        own[i] - (other?.[i] || 0) * 0.7;
                                    if (score > best) {
                                        best = score;
                                        entry = i / (own.length - 1);
                                    }
                                }
                            base.push({
                                name: `CUT_${side}${angle}_${foot ? "R" : "L"}`,
                                sign,
                                angle,
                                entry,
                            });
                        }
                return base;
            });
            const bindings = source.tracks.flatMap((track) => {
                const split = track.name.lastIndexOf("."),
                    name = track.name.slice(0, split),
                    property = track.name.slice(split + 1);
                const node =
                    root.getObjectByName(name) ||
                    root.getObjectByProperty("uuid", name);
                if (!node || !["quaternion", "position"].includes(property))
                    return [];
                return [
                    {
                        track,
                        node,
                        property,
                        sample: (track as SampledTrack).createInterpolant(),
                    },
                ];
            });
            for (const spec of specs) {
                const cut = spec.angle > 0,
                    duration = cut
                        ? spec.angle === 180
                            ? 0.58
                            : 0.42
                        : source.duration;
                const phaseSpan = cut
                    ? (3.2 * duration) /
                      ((metadata[source.name]?.speed || 3.2) * source.duration)
                    : 1;
                const frames = Math.ceil(duration * 30) + 1;
                const times = Array.from(
                    { length: frames },
                    (_, i) => (duration * i) / (frames - 1)
                );
                const values = bindings.map(() => [] as number[]);
                for (let frame = 0; frame < frames; frame++) {
                    restore();
                    const t = frame / (frames - 1),
                        phase = wrap(spec.entry + t * phaseSpan);
                    for (const b of bindings)
                        b.node[b.property].fromArray(
                            b.sample.evaluate(phase * source.duration)
                        );
                    root.updateMatrixWorld(true);
                    hips.getWorldPosition(origin);
                    const envelope = cut ? Math.sin(Math.PI * t) ** 2 : 1;
                    // Bend the straight footprint along a circular path. The
                    // inside leg travels a shorter arc than the outside leg.
                    const radius =
                        length *
                        (cut
                            ? spec.angle === 180
                                ? 1.2
                                : 1.8
                            : source.name === "WALK"
                            ? 3.8
                            : 5.5);
                    legs.forEach((leg, index) => {
                        leg.foot.getWorldPosition(targets[index]);
                        leg.foot.getWorldQuaternion(rotations[index]);
                        from.subVectors(targets[index], origin);
                        const x = from.dot(left),
                            z = from.dot(forward),
                            theta = (spec.sign * z) / radius;
                        const r = spec.sign * radius;
                        const dx =
                            (r - (r - x) * Math.cos(theta) - x) * envelope;
                        const dz = ((r - x) * Math.sin(theta) - z) * envelope;
                        const limit = length * 0.16,
                            scale = Math.min(
                                1,
                                limit / Math.max(1e-8, Math.hypot(dx, dz))
                            );
                        targets[index]
                            .addScaledVector(left, dx * scale)
                            .addScaledVector(forward, dz * scale);
                        // Preserve original ankle height and orientation; live
                        // contact IK supplies the remaining world-space lock.
                    });
                    const lean =
                        spec.sign *
                        envelope *
                        (cut
                            ? 0.22
                            : source.name === "WALK"
                            ? 0.07
                            : source.name === "RUN"
                            ? 0.13
                            : 0.18);
                    worldRotate(
                        hips,
                        delta.setFromAxisAngle(forward, -lean * 0.6)
                    );
                    worldRotate(
                        chest,
                        delta.setFromAxisAngle(forward, -lean * 0.4)
                    );
                    if (cut) {
                        worldRotate(
                            hips,
                            delta.setFromAxisAngle(
                                up,
                                -spec.sign * envelope * 0.14
                            )
                        );
                        worldRotate(
                            chest,
                            delta.setFromAxisAngle(
                                up,
                                spec.sign *
                                    envelope *
                                    (spec.angle === 180 ? 0.34 : 0.23)
                            )
                        );
                        // Compress into the planted push, then recover exactly
                        // to the source gait at the matched exit phase.
                        hips.getWorldPosition(h).addScaledVector(
                            up,
                            -length * 0.025 * envelope
                        );
                        hips.position.copy(hips.parent.worldToLocal(h));
                        hips.updateWorldMatrix(false, true);
                    }
                    if (envelope > 1e-8)
                        legs.forEach((leg, index) =>
                            solve(leg, targets[index], rotations[index])
                        );
                    bindings.forEach((b, index) =>
                        b.node[b.property].toArray(
                            values[index],
                            frame * (b.property === "quaternion" ? 4 : 3)
                        )
                    );
                }
                // Near a straight knee, tiny target changes can cause a large
                // IK angle change. Bound and smooth only the added correction,
                // preserving the source gait's velocity and all finger motion.
                const corrected = new Set([
                    hips,
                    chest,
                    ...legs.flatMap((l) => [l.upper, l.lower, l.foot]),
                ]);
                bindings.forEach((binding, index) => {
                    if (
                        binding.property !== "quaternion" ||
                        !corrected.has(binding.node)
                    )
                        return;
                    const originals = times.map((time) =>
                        q()
                            .fromArray(
                                binding.sample.evaluate(
                                    wrap(
                                        spec.entry +
                                            (time / duration) * phaseSpan
                                    ) * source.duration
                                )
                            )
                            .normalize()
                    );
                    let corrections = originals.map((original, i) => {
                        const value = q()
                            .fromArray(values[index], i * 4)
                            .multiply(original.clone().invert())
                            .normalize();
                        const angle = value.angleTo(q());
                        return angle > 0.35
                            ? q().slerp(value, 0.35 / angle)
                            : value;
                    });
                    const count = cut ? frames : frames - 1;
                    for (let pass = 0; pass < 2; pass++) {
                        const previous = corrections;
                        corrections = previous.map((value, i) => {
                            if (cut && (i === 0 || i === frames - 1))
                                return q();
                            const at = i % count,
                                lo = cut
                                    ? Math.max(0, at - 1)
                                    : (at + count - 1) % count,
                                hi = cut
                                    ? Math.min(count - 1, at + 1)
                                    : (at + 1) % count;
                            return value
                                .clone()
                                .slerp(
                                    previous[lo]
                                        .clone()
                                        .slerp(previous[hi], 0.5),
                                    0.5
                                )
                                .normalize();
                        });
                    }
                    corrections.forEach((value, i) =>
                        value
                            .multiply(originals[i])
                            .normalize()
                            .toArray(values[index], i * 4)
                    );
                });
                const tracks = bindings.map((b, index) =>
                    b.property === "quaternion"
                        ? new math.QuaternionKeyframeTrack(
                              b.track.name,
                              times,
                              values[index]
                          )
                        : new math.VectorKeyframeTrack(
                              b.track.name,
                              times,
                              values[index]
                          )
                );
                const clip = new math.AnimationClip(
                    spec.name,
                    duration,
                    tracks
                );
                result.push({
                    clip,
                    metadata: {
                        duration,
                        loop: !cut,
                        speed: metadata[source.name]?.speed,
                        turn: {
                            kind: cut ? "cut" : "arc",
                            gait: source.name,
                            direction: spec.sign,
                            angle: spec.angle,
                            entryPhase: spec.entry,
                            phaseSpan,
                        },
                    },
                });
                restore();
                await new Promise<void>((resolve) => setTimeout(resolve, 0));
            }
        }
    } finally {
        restore();
    }
    return result;
}
