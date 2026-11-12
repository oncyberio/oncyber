/** Offline, locomotion-only pose polish. Keep runtime sampling and crowd shaders unchanged.
 * Per-bone additive composition follows Epic's layered animation approach:
 * https://dev.epicgames.com/documentation/en-us/unreal-engine/using-layered-animations-in-unreal-engine
 * Quaternius Idle_Loop is a reference for restrained chest/shoulder motion;
 * all idle curves below derive from our existing p_idle and original offsets.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
    Quaternion,
    QuaternionKeyframeTrack,
    VectorKeyframeTrack,
    Vector3,
} = require("three");
const radians = Math.PI / 180;
const forward = new Vector3(0, 0, 1);
const lateral = new Vector3(1, 0, 0);
const finger = /Hand(Thumb|Index|Middle|Ring|Pinky)[123]\.quaternion$/;
const upper =
    /^mixamorig(Spine[12]?|Neck|Head|LeftShoulder|RightShoulder|LeftArm|RightArm|LeftForeArm|RightForeArm|LeftHand|RightHand)\.quaternion$/;
const keep = (t) =>
    t.name.endsWith(".quaternion") || t.name === "mixamorigHips.position";

function uniqueTimes(track) {
    // The old WALK export has two left-thigh keys at 0.02 s. Three uses the
    // later key at that instant; collapse them before writing strict LCP times.
    const width = track.name.endsWith(".quaternion") ? 4 : 3;
    const keys = new Map(
        track.times.map((time, i) => [
            time,
            track.values.slice(i * width, (i + 1) * width),
        ])
    );
    return {
        ...track,
        times: [...keys.keys()],
        values: [...keys.values()].flat(),
    };
}

function widenArm(track, degrees) {
    if (!/^mixamorig(Left|Right)Arm\.quaternion$/.test(track.name))
        return track;
    const side = track.name.includes("Left") ? 1 : -1;
    // Normalized humanoid rotations: pre-multiply about the parent's forward
    // axis so both arms abduct, rather than twisting about their own length.
    const offset = new Quaternion().setFromAxisAngle(
        forward,
        side * degrees * radians
    );
    const values = Array.from(track.values);
    for (let i = 0; i < values.length; i += 4)
        new Quaternion()
            .fromArray(values, i)
            .premultiply(offset)
            .normalize()
            .toArray(values, i);
    return { ...track, values };
}

export function styleLocomotion(raw, name, oncyberWalk) {
    if (name === "WALK") {
        const hands = new Map(
            raw.tracks
                .filter((t) => finger.test(t.name))
                .map((t) => [t.name, t])
        );
        return {
            ...raw,
            duration: oncyberWalk.duration,
            tracks: oncyberWalk.tracks.filter(keep).map((t) => {
                const hand = hands.get(t.name);
                // Retain the relaxed fingers, phase-aligned to the new gait.
                if (hand)
                    return {
                        ...hand,
                        times: hand.times.map(
                            (time) =>
                                (time / raw.duration) * oncyberWalk.duration
                        ),
                    };
                return widenArm(uniqueTimes(t), 4);
            }),
        };
    }
    if (name !== "IDLE") return raw;

    const duration = 4;
    const frames = 120;
    const times = Array.from(
        { length: frames + 1 },
        (_, i) => (i / frames) * duration
    );
    const tracks = raw.tracks.filter(keep).map((track) => {
        const quaternion = track.name.endsWith(".quaternion");
        const Track = quaternion
            ? QuaternionKeyframeTrack
            : VectorKeyframeTrack;
        const source = new Track(track.name, track.times, track.values);
        if (quaternion)
            for (let i = 0; i < source.values.length; i += 4)
                new Quaternion()
                    .fromArray(source.values, i)
                    .normalize()
                    .toArray(source.values, i);
        const sampler = source.createInterpolant();
        const sample = (phase) =>
            Array.from(
                sampler.evaluate((((phase % 1) + 1) % 1) * raw.duration)
            );
        const soften = upper.test(track.name);
        const mean = new Quaternion();
        if (soften)
            for (let i = 0; i < 32; i++)
                mean.slerp(
                    new Quaternion().fromArray(sample(i / 32)),
                    1 / (i + 1)
                );
        const values = [];
        for (let i = 0; i <= frames; i++) {
            const phase = (i % frames) / frames;
            if (!quaternion) {
                values.push(...sample(phase));
                continue;
            }
            let pose = new Quaternion().fromArray(sample(phase));
            if (soften) {
                // Circular filtering softens rounded source keys on both sides
                // of the loop seam. Keep the original lower-body contact motion.
                const filtered = new Quaternion();
                let total = 0;
                for (let tap = -2; tap <= 2; tap++) {
                    const weight = 3 - Math.abs(tap);
                    total += weight;
                    filtered.slerp(
                        new Quaternion().fromArray(sample(phase + tap / 60)),
                        weight / total
                    );
                }
                pose = mean.clone().slerp(filtered, 0.55);
                const breath = Math.cos(phase * Math.PI * 2);
                const delayed = Math.cos((phase - 0.06) * Math.PI * 2);
                const pitch = {
                    "mixamorigSpine1.quaternion": -0.3 * breath,
                    "mixamorigSpine2.quaternion": -0.45 * breath,
                    "mixamorigNeck.quaternion": 0.35 * delayed,
                    "mixamorigHead.quaternion": 0.4 * delayed,
                }[track.name];
                if (pitch)
                    pose.premultiply(
                        new Quaternion().setFromAxisAngle(
                            lateral,
                            pitch * radians
                        )
                    );
            }
            values.push(...pose.normalize().toArray());
        }
        return widenArm({ ...track, times, values }, 6);
    });
    return { ...raw, duration, tracks };
}
