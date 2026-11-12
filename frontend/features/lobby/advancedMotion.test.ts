import { benchmarkMotionPose, benchmarkMovementPose } from "./crowdBenchmark";
import { decodeCC0LocomotionPack } from "./cc0LocomotionPack";
import * as THREE from "three";
import fs from "fs";
import path from "path";
import {
    authorLobbyTransitions,
    calibrateLobbyContacts,
    LOBBY_TRANSITIONS,
} from "./advancedMotion";
import { createMotionInertia } from "./motionInertia";
import {
    createLobbyLocomotion,
    sanitizeLobbyAnimation,
    LobbyClipMetadata,
} from "./locomotion";
import { distanceMatchTime } from "./motionTransitions";

const source = JSON.parse(
    fs.readFileSync(
        path.join(process.cwd(), "public/lobby/native-avatar-motion.json"),
        "utf8"
    )
);
const rigJSON = JSON.parse(
    fs.readFileSync(
        path.join(
            process.cwd(),
            "components/_3DExhibit-v2/three/factory/player/instanceavatarvrm/baker/baserig.json"
        ),
        "utf8"
    )
);
function library(rawSource = source) {
    const root = new THREE.ObjectLoader().parse(rigJSON);
    root.scale.setScalar(0.01);
    const names = {
        hips: "Hips",
        chest: "Spine2",
        spine: "Spine",
        leftFoot: "LeftFoot",
        rightFoot: "RightFoot",
        leftUpperLeg: "LeftUpLeg",
        rightUpperLeg: "RightUpLeg",
        leftLowerLeg: "LeftLeg",
        rightLowerLeg: "RightLeg",
    };
    const bone = (name: string) =>
        root.getObjectByName(`mixamorig${names[name]}`);
    const clips = ["IDLE", "WALK", "RUN"].map((name) => {
        const clip = THREE.AnimationClip.parse(
            sanitizeLobbyAnimation(rawSource[name], name)
        );
        clip.name = name;
        return clip;
    });
    const metadata: Record<string, LobbyClipMetadata> = Object.fromEntries(
        clips.map((c) => [c.name, { duration: c.duration }])
    );
    const authored = authorLobbyTransitions(THREE, clips[0], clips[1], bone);
    authored.forEach(({ clip, metadata: m }) => {
        clips.push(clip);
        metadata[clip.name] = m;
    });
    return { root, bone, clips, metadata };
}
test("authored transitions are bounded non-looping clips with continuous rest/start/stop endpoints", () => {
    const { clips, metadata } = library();
    expect(clips.length).toBe(3 + LOBBY_TRANSITIONS.length);
    for (const name of LOBBY_TRANSITIONS) {
        const clip = clips.find((c) => c.name === name);
        expect(metadata[name].loop).toBe(false);
        expect(clip.duration).toBeLessThanOrEqual(0.72);
        for (const track of clip.tracks) {
            expect(Array.from(track.values).every(Number.isFinite)).toBe(true);
            if (track.name.endsWith(".quaternion"))
                for (let i = 0; i < track.values.length; i += 4)
                    expect(
                        new THREE.Quaternion()
                            .fromArray(track.values, i)
                            .length()
                    ).toBeCloseTo(1, 5);
        }
    }
    const idle = clips[0].tracks.find(
        (t) => t.name === "mixamorigHips.position"
    );
    for (const name of ["STOP_L", "STOP_R", "PIVOT_L90", "PIVOT_R180"]) {
        const hips = clips
            .find((c) => c.name === name)
            .tracks.find((t) => t.name === idle.name);
        expect(Array.from(hips.values.slice(-3))).toEqual(
            Array.from(idle.values.slice(0, 3))
        );
    }
});
test("contact baking restores the rig and measures different support timing for each foot", async () => {
    const { root, bone, clips, metadata } = library();
    const original = bone("hips").position.clone();
    await calibrateLobbyContacts(THREE, root, clips, metadata, bone);
    expect(bone("hips").position.toArray()).toEqual(original.toArray());
    const { left, right } = metadata.WALK.contacts;
    expect(left.length).toBeGreaterThan(20);
    expect(
        Array.from(left).every((n) => Number.isFinite(n) && n >= 0 && n <= 1)
    ).toBe(true);
    expect(Math.max(...left)).toBeGreaterThan(0.8);
    expect(Math.min(...left)).toBeLessThan(0.2);
    expect(Array.from(left).some((n, i) => Math.abs(n - right[i]) > 0.5)).toBe(
        true
    );
    expect(metadata.WALK.speed).toBeGreaterThan(0.8);
    expect(metadata.RUN.speed).toBeGreaterThan(metadata.WALK.speed);
});
test("remaining distance selects monotonically advancing stop frames", () => {
    const curve = [1, 0.7, 0.3, 0, 0];
    let previous = 0;
    for (let remaining = 1; remaining >= 0; remaining -= 0.01) {
        const t = distanceMatchTime(curve, remaining, 0.4);
        expect(t).toBeGreaterThanOrEqual(previous);
        previous = t;
    }
    expect(distanceMatchTime(curve, 0, 0.4)).toBeCloseTo(0.3);
});
test("starts, distance-matched foot-specific stops, pivots and interruptions preserve two samples", () => {
    const { metadata } = library();
    const c = createLobbyLocomotion(metadata);
    const step = (speed: number, extras = {}) =>
        c.update(1 / 60, { speed, grounded: true, quality: "full", ...extras });
    for (let i = 0; i < 20; i++) step(0);
    const start = step(0.2);
    expect(start.secondary.name).toMatch(/^START_/);
    for (let i = 0; i < 50; i++) step(1.6);
    let stopSeen = false,
        lastStop = 0;
    for (let i = 0; i < 12; i++) {
        const speed = 1.6 * Math.exp(-i * 0.3);
        const p = step(speed, { stopDistance: speed / 18 });
        const sample = p.primary.name.startsWith("STOP")
            ? p.primary
            : p.secondary.name.startsWith("STOP")
            ? p.secondary
            : undefined;
        if (sample) {
            stopSeen = true;
            expect(sample.time).toBeGreaterThanOrEqual(lastStop);
            lastStop = sample.time;
        }
        expect(p.blend).toBeGreaterThanOrEqual(0);
        expect(p.blend).toBeLessThanOrEqual(1);
    }
    expect(stopSeen).toBe(true);
    const resume = step(3);
    expect(`${resume.primary.name}:${resume.secondary.name}`).not.toContain(
        "STOP"
    );
    for (let i = 0; i < 90; i++) step(0);
    expect(step(0, { turnRate: 1 }).secondary.name).toBe("PIVOT_L90");
    const jump = step(0, { grounded: false, height: 0.3, verticalVelocity: 3 });
    expect(`${jump.primary.name}:${jump.secondary.name}`).not.toContain(
        "PIVOT"
    );
    expect(jump.secondary.name).toBe("JUMP");
});
test("coarse quality and reduced motion skip the authored transition layer", () => {
    const { metadata } = library();
    for (const extra of [
        { quality: "crowd" as const },
        { procedural: false },
    ]) {
        const c = createLobbyLocomotion(metadata);
        c.update(1 / 60, { speed: 0, grounded: true, ...extra });
        const p = c.update(1 / 60, { speed: 1, grounded: true, ...extra });
        expect(`${p.primary.name}:${p.secondary.name}`).not.toContain("START");
    }
});
test("inertialization preserves outgoing velocity, converges and restores unmodified samples", () => {
    const bone = new THREE.Bone(),
        inertia = createMotionInertia(THREE, [bone]);
    for (let i = 0; i < 20; i++) {
        inertia.restore();
        bone.rotation.y = i / 120;
        inertia.update(1 / 60, "walk");
    }
    const before = bone.rotation.y;
    inertia.restore();
    bone.rotation.y = before + 0.4;
    inertia.update(1 / 60, "stop");
    expect(Math.abs(bone.rotation.y - before)).toBeLessThan(0.025);
    for (let i = 0; i < 40; i++) {
        inertia.restore();
        bone.rotation.y = 0.6;
        inertia.update(1 / 60, "stop");
    }
    expect(bone.rotation.y).toBeCloseTo(0.6, 5);
    inertia.restore();
    expect(bone.rotation.y).toBeCloseTo(0.6, 5);
    inertia.reset();
    bone.rotation.y = 1;
    inertia.update(1 / 60, "idle");
    expect(bone.rotation.y).toBeCloseTo(1, 5);
});

test("gradual acceleration starts a transition and a short input release cancels it", () => {
    const { metadata } = library(),
        c = createLobbyLocomotion(metadata);
    let seen = false;
    for (const speed of [0, 0.025, 0.05, 0.075, 0.1]) {
        const p = c.update(1 / 60, { speed, grounded: true });
        seen ||=
            p.primary.name.startsWith("START") ||
            p.secondary.name.startsWith("START");
    }
    expect(seen).toBe(true);
    const stopped = c.update(1 / 60, { speed: 0, grounded: true });
    expect(`${stopped.primary.name}:${stopped.secondary.name}`).not.toContain(
        "START"
    );
});

test.each([30, 60, 120])(
    "movement-course stops and pivots settle directly into idle at %i Hz for either library",
    (fps) => {
        const cc0 = decodeCC0LocomotionPack(
            new Uint8Array(
                fs.readFileSync(
                    path.join(
                        process.cwd(),
                        "public/lobby/cc0/quaternius-core.c66c3d2a7450.lcp"
                    )
                )
            )
        ).clips;
        for (const raw of [source, { ...cc0, RUN: cc0.JOG }]) {
            const { metadata } = library(raw);
            for (const seed of [0, 0.23, 0.51, 0.87]) {
                const controller = createLobbyLocomotion(metadata, seed);
                let previous = benchmarkMovementPose(0);
                for (let frame = 0; frame < 12 * fps; frame++) {
                    const t = frame / fps,
                        sample = benchmarkMovementPose(t);
                    const pose = controller.update(1 / fps, {
                        speed: sample.speed,
                        grounded: true,
                        quality: "full",
                        turnRate: (sample.rotation - previous.rotation) * fps,
                    });
                    previous = sample;
                    if (
                        (t >= 3.3 && t < 4) ||
                        (t >= 7.3 && t < 8) ||
                        (t >= 9 && t < 12)
                    ) {
                        const gaitWeight =
                            (pose.primary.name === "WALK" ||
                            pose.primary.name === "RUN"
                                ? 1 - pose.blend
                                : 0) +
                            (pose.secondary.name === "WALK" ||
                            pose.secondary.name === "RUN"
                                ? pose.blend
                                : 0);
                        expect({ time: t, gaitWeight }).toEqual({
                            time: t,
                            gaitWeight: 0,
                        });
                    }
                }
            }
        }
    }
);

test("a settled stop immediately accepts a new start, turn or jump", () => {
    const { metadata } = library();
    for (const intent of [
        { speed: 0.5, turnRate: 0, grounded: true },
        { speed: 0, turnRate: 1, grounded: true },
        { speed: 0, turnRate: 0, grounded: false },
    ]) {
        const c = createLobbyLocomotion(metadata);
        for (let frame = 0; frame < 240; frame++) {
            const motion = benchmarkMovementPose(frame / 60);
            c.update(1 / 60, {
                speed: motion.speed,
                grounded: true,
                quality: "full",
            });
        }
        const pose = c.update(1 / 60, { ...intent, quality: "full" });
        const expected = !intent.grounded
            ? "JUMP"
            : intent.speed > 0
            ? "START_"
            : "PIVOT_";
        expect(pose.secondary.name.startsWith(expected)).toBe(true);
        expect(pose.blend).toBeGreaterThan(0);
    }
});

test("fallback pivot amplitude never increases when rotation ends", () => {
    const c = createLobbyLocomotion({});
    for (let frame = 0; frame < 60; frame++)
        c.update(1 / 60, { speed: 0, grounded: true, turnRate: 1 });
    let previous = 0.4;
    for (let frame = 0; frame < 12; frame++) {
        const p = c.update(1 / 60, { speed: 0, grounded: true, turnRate: 0 });
        const weight =
            (p.primary.name === "WALK" ? 1 - p.blend : 0) +
            (p.secondary.name === "WALK" ? p.blend : 0);
        expect(weight).toBeLessThanOrEqual(previous);
        previous = weight;
    }
    expect(previous).toBe(0);
});

test.each([30, 60, 120])(
    "locomotion-cycle deceleration stays in gait until one final stop at %i Hz",
    (fps) => {
        const cc0 = decodeCC0LocomotionPack(
            new Uint8Array(
                fs.readFileSync(
                    path.join(
                        process.cwd(),
                        "public/lobby/cc0/quaternius-core.c66c3d2a7450.lcp"
                    )
                )
            )
        ).clips;
        for (const raw of [source, { ...cc0, RUN: cc0.JOG }]) {
            const { metadata } = library(raw);
            for (const seed of [0, 0.23, 0.51, 0.87]) {
                const controller = createLobbyLocomotion(metadata, seed);
                let stops = 0,
                    wasStopping = false,
                    finishedStop = false;
                for (let frame = 0; frame < 12 * fps; frame++) {
                    const t = frame / fps,
                        sample = benchmarkMotionPose(t);
                    const pose = controller.update(1 / fps, {
                        speed: sample.speed,
                        grounded: true,
                        quality: "full",
                        procedural: true,
                    });
                    const stop = [pose.primary, pose.secondary].find((s) =>
                        s.name.startsWith("STOP_")
                    );
                    if (stop && !wasStopping) stops++;
                    if (wasStopping && !stop) finishedStop = true;
                    wasStopping = !!stop;
                    // The cycle brakes over two seconds. A 360 ms stop clip
                    // must not replace the run/walk blend at the start of that ramp.
                    if (stop)
                        expect(sample.speed / 2.7).toBeLessThanOrEqual(
                            metadata[stop.name].duration + 1e-6
                        );
                    if (finishedStop) {
                        expect(pose.primary.name).toBe("IDLE");
                        expect(pose.secondary.name).toBe("IDLE");
                    }
                }
                expect(stops).toBe(1);
            }
        }
    }
);

test("slowing from run to a sustained walk does not play a stop", () => {
    const { metadata } = library(),
        c = createLobbyLocomotion(metadata);
    for (let frame = 0; frame < 360; frame++) {
        const t = frame / 60;
        const speed = t < 2 ? 5.4 : Math.max(1.6, 5.4 - (t - 2) * 2.7);
        const p = c.update(1 / 60, { speed, grounded: true, procedural: true });
        expect(`${p.primary.name}:${p.secondary.name}`).not.toContain("STOP");
    }
});

test("a stale braking distance finishes a stop without skipping frames or replaying it", () => {
    const { metadata } = library(),
        c = createLobbyLocomotion(metadata);
    c.update(1 / 60, { speed: 10, grounded: true });
    let previousTime = 0,
        stops = 0,
        wasStopping = false;
    for (let frame = 1; frame <= 120; frame++) {
        const pose = c.update(1 / 60, {
            speed: 10 - frame / 20,
            grounded: true,
            stopDistance: 0.1,
        });
        const stop = [pose.primary, pose.secondary].find((s) =>
            s.name.startsWith("STOP_")
        );
        if (stop) {
            if (!wasStopping) stops++;
            expect(stop.time - previousTime).toBeLessThanOrEqual(1 / 60 + 1e-6);
            previousTime = stop.time;
        }
        wasStopping = !!stop;
    }
    expect(stops).toBe(1);
    expect(wasStopping).toBe(false);
});
