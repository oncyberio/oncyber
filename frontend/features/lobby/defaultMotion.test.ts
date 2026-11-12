import { isLobbyIdle } from "./idleVariants";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import * as THREE from "three";
import { decodeCC0LocomotionPack, CC0AnimationClip } from "./cc0LocomotionPack";
import { loadDefaultMotion, loadCC0MotionPreview } from "./optionalMotionPack";
import {
    createLobbyLocomotion,
    LobbyClipMetadata,
    sanitizeLobbyAnimation,
} from "./locomotion";
import {
    authorLobbyTransitions,
    calibrateLobbyContacts,
} from "./advancedMotion";
import { authorMovingTurns } from "./authorMovingTurns";
import { isMotionOneShot } from "./motionNames";
import {
    benchmarkJumpPose,
    benchmarkMotionPose,
    benchmarkTurningPose,
} from "./crowdBenchmark";
import {
    state,
    step,
    advanceVelocity,
    input,
    validState,
} from "../../../multiplayer/protocol/movement";

// These tests bake and simulate whole locomotion courses; on a shared CI
// runner one can take longer than Jest's 5 s default.
jest.setTimeout(30_000);

const directory = path.join(process.cwd(), "public/lobby/locomotion");
const manifest = JSON.parse(
    fs.readFileSync(path.join(directory, "manifest.json"), "utf8")
);
const fetchAsset = async (url: string) =>
    Uint8Array.from(fs.readFileSync(path.join(process.cwd(), "public", url)))
        .buffer;
async function library(cc0 = false) {
    const raw: Record<string, CC0AnimationClip> = cc0
        ? await loadCC0MotionPreview(fetchAsset)
        : await loadDefaultMotion(fetchAsset);
    const root = new THREE.ObjectLoader().parse(
        JSON.parse(
            fs.readFileSync(
                path.join(
                    process.cwd(),
                    "components/_3DExhibit-v2/three/factory/player/instanceavatarvrm/baker/baserig.json"
                ),
                "utf8"
            )
        )
    );
    root.scale.setScalar(0.01);
    const names = {
        hips: "Hips",
        chest: "Spine2",
        spine: "Spine",
        leftFoot: "LeftFoot",
        rightFoot: "RightFoot",
        leftToes: "LeftToeBase",
        rightToes: "RightToeBase",
        leftUpperLeg: "LeftUpLeg",
        rightUpperLeg: "RightUpLeg",
        leftLowerLeg: "LeftLeg",
        rightLowerLeg: "RightLeg",
    };
    const bone = (name: string) =>
        root.getObjectByName(`mixamorig${names[name]}`);
    const clips = Object.entries(raw).map(([name, clip]) => {
        const parsed = THREE.AnimationClip.parse(
            sanitizeLobbyAnimation(clip, name)
        );
        parsed.name = name;
        return parsed;
    });
    const metadata: Record<string, LobbyClipMetadata> = Object.fromEntries(
        clips.map((c) => [
            c.name,
            { duration: c.duration, loop: !isMotionOneShot(c.name) },
        ])
    );
    for (const { clip, metadata: m } of authorLobbyTransitions(
        THREE,
        clips.find((c) => c.name === "IDLE"),
        clips.find((c) => c.name === "WALK"),
        bone
    )) {
        clips.push(clip);
        metadata[clip.name] = m;
    }
    await calibrateLobbyContacts(THREE, root, clips, metadata, bone);
    const turns = await authorMovingTurns(THREE, root, clips, metadata, bone);
    for (const { clip, metadata: m } of turns) {
        clips.push(clip);
        metadata[clip.name] = m;
    }
    await calibrateLobbyContacts(
        THREE,
        root,
        turns.map((t) => t.clip),
        metadata,
        bone
    );
    return { raw, clips, metadata, root, bone };
}

test("the shipped locomotion pack contains the original advanced clips with authored hands in under 170 KB", async () => {
    let bytes = 0;
    for (const pack of manifest.packs) {
        const data = fs.readFileSync(path.join(directory, pack.file));
        bytes += data.length;
        expect(
            createHash("sha256").update(new Uint8Array(data)).digest("hex")
        ).toBe(pack.sha256);
        const decoded = decodeCC0LocomotionPack(new Uint8Array(data));
        expect(Object.keys(decoded.clips)).toEqual(Object.keys(pack.clips));
        for (const clip of Object.values(decoded.clips)) {
            expect(clip.tracks).toHaveLength(53);
            expect(
                clip.tracks.every((t) => t.values.every(Number.isFinite))
            ).toBe(true);
        }
    }
    expect(bytes).toBeLessThan(170000);
    const { raw } = await library();
    expect(Object.keys(raw)).toHaveLength(19);
    expect(raw.RUN.duration).toBeCloseTo(0.533333);
    expect(raw.SPRINT.duration).toBeCloseTo(0.4);
    expect(raw.JUMP_DOUBLE.duration).toBeCloseTo(0.633333);
    expect(raw.RUN.tracks).not.toEqual(raw.SPRINT.tracks);
});

/** Source clips are rotations for normalized humanoid bones. Copy rest-world
 * offsets into identity-rotation parents, as a VRM normalized rig does. Applying
 * them directly to the FBX rest rotations would rotate the limbs a second time. */
function normalizedReferencePose(raw: CC0AnimationClip) {
    const source = new THREE.ObjectLoader().parse(
        JSON.parse(
            fs.readFileSync(
                path.join(
                    process.cwd(),
                    "components/_3DExhibit-v2/three/factory/player/instanceavatarvrm/baker/baserig.json"
                ),
                "utf8"
            )
        )
    );
    source.updateMatrixWorld(true);
    const root = new THREE.Group();
    root.scale.setScalar(0.01);
    const nodes = new Map<THREE.Object3D, THREE.Object3D>();
    source.traverse((object) => {
        const node = new THREE.Object3D();
        node.name = object.name;
        node.position.copy(object.getWorldPosition(new THREE.Vector3()));
        if (object.parent)
            node.position.sub(
                object.parent.getWorldPosition(new THREE.Vector3())
            );
        (nodes.get(object.parent) || root).add(node);
        nodes.set(object, node);
    });
    const tracks = THREE.AnimationClip.parse(raw)
        .tracks.filter(
            (t) =>
                t.name.endsWith(".quaternion") ||
                t.name === "mixamorigHips.position"
        )
        .map((track) => ({
            node: root.getObjectByName(track.name.split(".")[0]),
            quaternion: track.name.endsWith(".quaternion"),
            sample: (track as any).createInterpolant(),
        }));
    return (phase: number) => {
        for (const t of tracks) {
            const values = t.sample.evaluate(phase * raw.duration);
            if (t.quaternion) t.node.quaternion.fromArray(values).normalize();
            else t.node.position.fromArray(values);
        }
        root.updateMatrixWorld(true);
        return (name: string) =>
            root
                .getObjectByName(`mixamorig${name}`)
                .getWorldPosition(new THREE.Vector3());
    };
}

test("relaxed idle keeps both hands clear, feet stable and its breathing loop seamless", async () => {
    const raw = await loadDefaultMotion(fetchAsset);
    expect(raw.IDLE.duration).toBeGreaterThanOrEqual(3);
    expect(raw.IDLE.duration).toBeLessThanOrEqual(5);
    const pose = normalizedReferencePose(raw.IDLE);
    const first = pose(0);
    const leftFoot = first("LeftFoot"),
        rightFoot = first("RightFoot");
    const initialHand = first("LeftHand");
    let handMotion = 0;
    for (let frame = 0; frame <= 240; frame++) {
        const position = pose(frame / 240);
        expect(position("LeftFoot").distanceTo(leftFoot)).toBeLessThan(0.012);
        expect(position("RightFoot").distanceTo(rightFoot)).toBeLessThan(0.012);
        for (const [side, sign] of [
            ["Left", 1],
            ["Right", -1],
        ] as const) {
            const clearance =
                sign * (position(`${side}Hand`).x - position(`${side}Arm`).x);
            expect(clearance).toBeGreaterThan(0.055);
            expect(clearance).toBeLessThan(0.15);
        }
        handMotion = Math.max(
            handMotion,
            position("LeftHand").distanceTo(initialHand)
        );
    }
    expect(handMotion).toBeGreaterThan(0.01);
    expect(handMotion).toBeLessThan(0.05);
    for (const track of THREE.AnimationClip.parse(raw.IDLE).tracks) {
        const sample = (track as any).createInterpolant();
        const start = Array.from(sample.evaluate(0)) as number[];
        const end = Array.from(sample.evaluate(raw.IDLE.duration)) as number[];
        expect(end).toEqual(start);
        if (track.name.endsWith(".quaternion")) {
            const before = new THREE.Quaternion().fromArray(
                sample.evaluate(raw.IDLE.duration - 1 / 120)
            );
            const after = new THREE.Quaternion().fromArray(
                sample.evaluate(1 / 120)
            );
            expect(before.angleTo(after)).toBeLessThan(0.015);
        }
    }
});

test("Default walk preserves the requested Oncyber stride and gives its hands extra clearance", async () => {
    const raw = await loadDefaultMotion(fetchAsset);
    const legacy = JSON.parse(
        fs.readFileSync(
            path.join(process.cwd(), "public/lobby/native-avatar-motion.json"),
            "utf8"
        )
    ).WALK;
    expect(raw.WALK.duration).toBe(legacy.duration);
    const current = normalizedReferencePose(raw.WALK);
    const previous = normalizedReferencePose(legacy);
    for (let frame = 0; frame <= 120; frame++) {
        const a = current(frame / 120),
            b = previous(frame / 120);
        for (const bone of ["Hips", "LeftFoot", "RightFoot"])
            expect(a(bone).distanceTo(b(bone))).toBeLessThan(0.012);
        for (const [side, sign] of [
            ["Left", 1],
            ["Right", -1],
        ] as const) {
            const extra = sign * (a(`${side}Hand`).x - b(`${side}Hand`).x);
            expect(extra).toBeGreaterThan(0.008);
            expect(extra).toBeLessThan(0.06);
        }
    }
});

test.each([false, true])(
    "authored fingers survive packing, sanitation and transition generation (CC0=%s)",
    async (cc0) => {
        const { clips, root } = await library(cc0);
        const mixer = new THREE.AnimationMixer(root);
        for (const clip of clips) {
            const fingers = clip.tracks.filter((t) =>
                /Hand(Thumb|Index|Middle|Ring|Pinky)[123]\.quaternion$/.test(
                    t.name
                )
            );
            expect(fingers).toHaveLength(30);
            mixer.stopAllAction();
            const action = mixer.clipAction(clip).play();
            action.time = clip.duration * 0.37;
            mixer.update(0);
            for (const track of fingers) {
                const expected = new THREE.Quaternion().fromArray(
                    (track as any).createInterpolant().evaluate(action.time)
                );
                const joint = root.getObjectByName(track.name.split(".")[0]);
                expect(joint).toBeDefined();
                expect(joint.quaternion.angleTo(expected)).toBeLessThan(0.001);
            }
            if (["IDLE", "WALK", "RUN", "SPRINT"].includes(clip.name)) {
                for (const side of ["Left", "Right"]) {
                    const index = root.getObjectByName(
                        `mixamorig${side}HandIndex2`
                    );
                    expect(
                        index.quaternion.angleTo(new THREE.Quaternion())
                    ).toBeGreaterThan(0.2);
                }
            }
        }
        mixer.stopAllAction();
        mixer.uncacheRoot(root);
    }
);

test.each([false, true])(
    "held movement visibly progresses from walk to run before sprint (CC0=%s)",
    async (cc0) => {
        const { metadata } = await library(cc0);
        for (const running of [false, true])
            for (const procedural of [false, true])
                for (const quality of ["full", "crowd"] as const) {
                    const c = createLobbyLocomotion(metadata),
                        body = state();
                    const command = input({
                        strafe: 0,
                        forward: -1,
                        yaw: 0,
                        running,
                        jump: false,
                        animation: -1,
                    });
                    const seen: string[] = [];
                    const visible = { WALK: 0, RUN: 0, SPRINT: 0 };
                    for (let f = 0; f < 180; f++) {
                        step(body, command);
                        const p = c.update(1 / 60, {
                            speed: Math.hypot(body.vx, body.vz),
                            grounded: true,
                            procedural,
                            quality,
                        });
                        const dominant =
                            p.blend < 0.5 ? p.primary : p.secondary;
                        if (dominant.name in visible) {
                            if (seen.at(-1) !== dominant.name)
                                seen.push(dominant.name);
                            const weight =
                                p.primary.name === p.secondary.name
                                    ? 1
                                    : Math.max(p.blend, 1 - p.blend);
                            if (weight >= 0.65)
                                visible[dominant.name] += 1 / 60;
                        }
                    }
                    expect(seen).toEqual(
                        running ? ["WALK", "RUN", "SPRINT"] : ["WALK", "RUN"]
                    );
                    // Keep a brief readable walk, without the previous long speed buildup.
                    expect(visible.WALK).toBeGreaterThan(0.08);
                    expect(visible.RUN).toBeGreaterThan(0.14);
                    expect(visible.SPRINT).toBeGreaterThanOrEqual(
                        running ? 0.8 : 0
                    );
                }
    }
);

test.each([false, true])(
    "walk, run and sprint remain distinct and phase aligned (CC0=%s)",
    async (cc0) => {
        const { metadata } = await library(cc0);
        for (const quality of ["full", "crowd"] as const) {
            const c = createLobbyLocomotion(metadata);
            for (const [speed, expected] of [
                [1.6, "WALK"],
                [3.2, "RUN"],
                [5.4, "SPRINT"],
            ] as const) {
                let pose;
                for (let i = 0; i < 150; i++)
                    pose = c.update(1 / 60, { speed, grounded: true, quality });
                const dominant =
                    pose.blend < 0.5 ? pose.primary : pose.secondary;
                expect(dominant.name).toBe(expected);
            }
            for (let frame = 0; frame < 150; frame++) {
                const p = c.update(1 / 60, {
                    speed: 5.4 - frame * 0.02,
                    grounded: true,
                    quality,
                    procedural: false,
                });
                if (p.primary.name !== "IDLE" && p.secondary.name !== "IDLE")
                    expect(
                        p.primary.time / metadata[p.primary.name].duration
                    ).toBeCloseTo(
                        p.secondary.time / metadata[p.secondary.name].duration,
                        8
                    );
            }
        }
    }
);

test.each([30, 60, 120])(
    "Default and CC0 brake once after sprint/run/walk at %i Hz",
    async (fps) => {
        for (const cc0 of [false, true]) {
            const { metadata } = await library(cc0);
            for (const seed of [0, 0.23, 0.51, 0.87]) {
                const c = createLobbyLocomotion(metadata, seed);
                let wasStop = false,
                    stops = 0,
                    done = false;
                for (let f = 0; f < 12 * fps; f++) {
                    const t = f / fps,
                        sample = benchmarkMotionPose(t);
                    const p = c.update(1 / fps, {
                        speed: sample.speed,
                        grounded: true,
                        procedural: true,
                    });
                    const stop = [p.primary, p.secondary].some((s) =>
                        s.name.startsWith("STOP_")
                    );
                    if (stop && !wasStop) stops++;
                    if (wasStop && !stop) done = true;
                    if (stop)
                        expect(sample.speed / 2.7).toBeLessThanOrEqual(
                            0.360001
                        );
                    if (done) {
                        expect(isLobbyIdle(p.primary.name)).toBe(true);
                        expect(isLobbyIdle(p.secondary.name)).toBe(true);
                    }
                    wasStop = stop;
                }
                expect(stops).toBe(1);
            }
        }
    }
);

test.each([30, 60, 120])(
    "Default double jump plays once, lands once and settles at %i Hz",
    async (fps) => {
        const { metadata } = await library();
        for (const procedural of [true, false])
            for (const quality of ["full", "crowd"] as const) {
                const c = createLobbyLocomotion(metadata);
                const seen = new Set<string>();
                let doubleStarts = 0,
                    wasDouble = false,
                    lastTime = 0;
                for (let f = 0; f < 2 * fps; f++) {
                    const m = benchmarkJumpPose(f / fps, true);
                    const p = c.update(1 / fps, {
                        speed: 0,
                        grounded: m.floor,
                        height: m.y,
                        verticalVelocity: m.verticalVelocity,
                        jumpCount: m.jumpCount,
                        procedural,
                        quality,
                    });
                    const d = [p.primary, p.secondary].find(
                        (s) => s.name === "JUMP_DOUBLE"
                    );
                    if (d && !wasDouble) doubleStarts++;
                    if (d) {
                        expect(d.time).toBeGreaterThanOrEqual(lastTime);
                        lastTime = d.time;
                    }
                    wasDouble = !!d;
                    for (const s of [p.primary, p.secondary]) {
                        seen.add(s.name);
                        expect(s.time).toBeGreaterThanOrEqual(0);
                        expect(s.time).toBeLessThanOrEqual(
                            metadata[s.name].duration + 1e-6
                        );
                    }
                    if (f / fps > 1.7) {
                        expect(isLobbyIdle(p.primary.name)).toBe(true);
                        expect(p.blend).toBe(0);
                    }
                }
                expect(doubleStarts).toBe(1);
                for (const n of [
                    "JUMP_IDLE",
                    "JUMP_DOUBLE",
                    "FALLING",
                    "DROP_IDLE",
                ])
                    expect(seen.has(n)).toBe(true);
            }
    }
);

test("jump variants match locomotion and a fresh jump interrupts landing", async () => {
    const { metadata } = await library();
    for (const [speed, band] of [
        [0, "IDLE"],
        [1.6, "WALKING"],
        [3.2, "RUNNING"],
        [5.4, "SPRINTING"],
    ] as const) {
        const c = createLobbyLocomotion(metadata);
        for (let f = 0; f < 60; f++)
            c.update(1 / 60, { speed, grounded: true });
        const p = c.update(1 / 60, {
            speed,
            grounded: false,
            verticalVelocity: 6,
            jumpCount: 1,
        });
        expect(p.secondary.name).toBe(`JUMP_${band}`);
        for (let f = 0; f < 30; f++)
            c.update(1 / 60, { speed, grounded: false, verticalVelocity: -8 });
        const landing = c.update(1 / 60, {
            speed,
            grounded: true,
            verticalVelocity: 0,
        });
        expect(landing.secondary.name).toBe(`DROP_${band}`);
        const again = c.update(1 / 60, {
            speed,
            grounded: false,
            verticalVelocity: 6,
            jumpCount: 1,
        });
        expect(again.secondary.name).toBe(`JUMP_${band}`);
    }
});

test("Default sprint receives foot-contact and stride calibration", async () => {
    const { root, bone, clips, metadata } = await library();
    await calibrateLobbyContacts(THREE, root, clips, metadata, bone);
    for (const n of ["WALK", "RUN", "SPRINT"]) {
        expect(metadata[n].contacts.left.length).toBeGreaterThan(10);
        expect(metadata[n].speed).toBeGreaterThan(0);
    }
});

test("shared physics accepts two separate presses, rejects a third and holding, and resets on landing", () => {
    const s = state(),
        command = input({
            strafe: 0,
            forward: 0,
            yaw: 0,
            running: false,
            jump: true,
            animation: -1,
        });
    step(s, command);
    expect(s.jumpCount).toBe(1);
    for (let f = 0; f < 14; f++) step(s, command);
    expect(s.jumpCount).toBe(1);
    step(s, { ...command, jump: false });
    step(s, command);
    expect(s.jumpCount).toBe(2);
    expect(s.vy).toBeCloseTo(5.7);
    step(s, { ...command, jump: false });
    step(s, command);
    expect(s.jumpCount).toBe(2);
    expect(s.vy).toBeCloseTo(5.1);
    for (let f = 0; f < 120; f++) {
        step(s, command);
        expect(validState(s)).toBe(true);
    }
    expect(s.floor).toBe(true);
    expect(s.jumpCount).toBe(0);
    step(s, { ...command, jump: false });
    step(s, command);
    expect(s.jumpCount).toBe(1);
});

test("a remote second launch is detected even immediately after the takeoff becomes falling", async () => {
    const { metadata } = await library(),
        c = createLobbyLocomotion(metadata);
    c.update(1 / 60, { speed: 0, grounded: true });
    let falling = false;
    for (let frame = 0; frame < 60; frame++) {
        const p = c.update(1 / 60, {
            speed: 0,
            grounded: false,
            verticalVelocity: 6 - frame * 0.3,
        });
        if (p.secondary.name === "FALLING") {
            falling = true;
            break;
        }
    }
    expect(falling).toBe(true);
    const second = c.update(1 / 60, {
        speed: 0,
        grounded: false,
        verticalVelocity: 6,
    });
    expect(second.secondary.name).toBe("JUMP_DOUBLE");
    const arriving = createLobbyLocomotion(metadata).update(1 / 60, {
        speed: 0,
        grounded: false,
        verticalVelocity: -5,
    });
    expect(arriving.secondary.name).toBe("FALLING");
});

test.each([false, true])(
    "derived turns preserve loop seams, source cut endpoints and normalized joints (CC0=%s)",
    async (cc0) => {
        const { clips, metadata } = await library(cc0);
        const turns = clips.filter((c) => metadata[c.name].turn);
        expect(turns).toHaveLength(14);
        for (const clip of turns) {
            const m = metadata[clip.name],
                source = clips.find((c) => c.name === m.turn.gait);
            expect(clip.tracks).toHaveLength(source.tracks.length);
            expect(clip.duration).toBeLessThanOrEqual(1.34);
            for (const track of clip.tracks) {
                const original = source.tracks.find(
                    (t) => t.name === track.name
                ) as any;
                const rotation = track.name.endsWith(".quaternion"),
                    size = rotation ? 4 : 3;
                for (let i = 0; i < track.values.length; i += size) {
                    const current = new THREE.Quaternion().fromArray(
                        track.values,
                        i
                    );
                    if (rotation) {
                        expect(current.length()).toBeCloseTo(1, 5);
                        if (i) {
                            const sourceAt = (index: number) => {
                                const phase =
                                    (m.turn.entryPhase +
                                        (m.turn.phaseSpan *
                                            track.times[index]) /
                                            clip.duration) %
                                    1;
                                return new THREE.Quaternion().fromArray(
                                    original
                                        .createInterpolant()
                                        .evaluate(phase * source.duration)
                                );
                            };
                            const correction = current
                                .clone()
                                .multiply(sourceAt(i / size).invert());
                            const previous = new THREE.Quaternion()
                                .fromArray(track.values, i - size)
                                .multiply(sourceAt(i / size - 1).invert());
                            const jump = correction.angleTo(previous);
                            if (jump >= 0.4)
                                throw new Error(
                                    `${cc0}:${clip.name}:${track.name}:${
                                        i / size
                                    }: correction jump=${jump}`
                                );
                            expect(jump).toBeLessThan(0.4);
                        }
                    }
                }
                for (const end of [0, 1]) {
                    const value = Array.from(
                        track.values.slice(
                            end ? track.values.length - size : 0,
                            end ? track.values.length : size
                        )
                    );
                    const phase =
                        (m.turn.entryPhase + m.turn.phaseSpan * end) % 1;
                    const expected = m.loop
                        ? Array.from(track.values.slice(0, size))
                        : (Array.from(
                              original
                                  .createInterpolant()
                                  .evaluate(phase * source.duration)
                          ) as number[]);
                    if (rotation)
                        expect(
                            new THREE.Quaternion()
                                .fromArray(value)
                                .angleTo(
                                    new THREE.Quaternion().fromArray(expected)
                                )
                        ).toBeLessThan(0.001);
                    else
                        expect(
                            Math.hypot(...value.map((v, i) => v - expected[i]))
                        ).toBeLessThan(0.001);
                }
            }
        }
        for (const gait of ["WALK", "RUN", "SPRINT"]) {
            const left = clips.find((c) => c.name === `TURN_${gait}_L`),
                right = clips.find((c) => c.name === `TURN_${gait}_R`);
            for (const bone of ["Hips", "LeftUpLeg", "RightUpLeg"]) {
                const name = `mixamorig${bone}.quaternion`;
                const a = left.tracks.find((t) => t.name === name) as any,
                    b = right.tracks.find((t) => t.name === name) as any;
                expect(
                    new THREE.Quaternion()
                        .fromArray(
                            a.createInterpolant().evaluate(left.duration * 0.37)
                        )
                        .angleTo(
                            new THREE.Quaternion().fromArray(
                                b
                                    .createInterpolant()
                                    .evaluate(right.duration * 0.37)
                            )
                        )
                ).toBeGreaterThan(0.015);
            }
        }
    }
);

test.each([30, 60, 120])(
    "turning course covers gait arcs and phase-matched cuts, then settles at %i Hz",
    async (fps) => {
        for (const cc0 of [false, true]) {
            const { metadata } = await library(cc0);
            for (const procedural of [true, false])
                for (const quality of ["full", "crowd"] as const) {
                    const controller = createLobbyLocomotion(metadata),
                        seen = new Set<string>();
                    let previousRotation = 0;
                    for (let f = 0; f < fps * 30; f++) {
                        const sample = benchmarkTurningPose(f / fps);
                        const turnRate =
                            Math.atan2(
                                Math.sin(sample.rotation - previousRotation),
                                Math.cos(sample.rotation - previousRotation)
                            ) * fps;
                        previousRotation = sample.rotation;
                        const p = controller.update(1 / fps, {
                            ...sample,
                            turnRate,
                            grounded: true,
                            procedural,
                            quality,
                        });
                        const phases: number[] = [];
                        for (const s of [p.primary, p.secondary]) {
                            const m = metadata[s.name];
                            expect(m).toBeDefined();
                            expect(s.time).toBeGreaterThanOrEqual(0);
                            expect(s.time).toBeLessThanOrEqual(
                                m.duration + 1e-6
                            );
                            if (m.turn) seen.add(s.name);
                            if (m.turn?.kind === "cut")
                                phases.push(
                                    (m.turn.entryPhase +
                                        (m.turn.phaseSpan * s.time) /
                                            m.duration) %
                                        1
                                );
                            else if (
                                m.turn ||
                                ["WALK", "RUN", "SPRINT"].includes(s.name)
                            )
                                phases.push(s.time / m.duration);
                        }
                        if (
                            phases.length === 2 &&
                            [p.primary, p.secondary].some(
                                (s) => metadata[s.name].turn
                            )
                        ) {
                            const error = Math.abs(phases[0] - phases[1]);
                            expect(Math.min(error, 1 - error)).toBeLessThan(
                                1e-6
                            );
                        }
                        if (f / fps > 29.5)
                            expect(isLobbyIdle(p.primary.name)).toBe(true);
                    }
                    if (procedural && quality === "full") {
                        for (const gait of ["WALK", "RUN", "SPRINT"])
                            expect(
                                [...seen].some((n) =>
                                    n.startsWith(`TURN_${gait}_`)
                                )
                            ).toBe(true);
                        expect(
                            [...seen].some(
                                (n) => n.startsWith("CUT_") && n.includes("90")
                            )
                        ).toBe(true);
                        if (
                            ![...seen].some(
                                (n) => n.startsWith("CUT_") && n.includes("180")
                            )
                        )
                            throw new Error(
                                `Missing cut180 cc0=${cc0}, seen=${[
                                    ...seen,
                                ].join(",")}`
                            );
                    } else expect(seen.size).toBe(0);
                }
        }
    }
);

test("late crowd turn bakes keep locomotion running and blend in only after readiness", async () => {
    const { metadata } = await library();
    let available = false;
    const requests = new Set<string>(),
        c = createLobbyLocomotion(metadata, 0.2, (name) => {
            requests.add(name);
            return available;
        });
    let previousTime = 0;
    for (let frame = 0; frame < 120; frame++) {
        const p = c.update(1 / 60, {
            speed: 3.2,
            grounded: true,
            turnRate: 0.8,
            turnIntent: 0.2,
        });
        expect(p.primary.name + p.secondary.name).not.toMatch(/TURN_|CUT_/);
        if (frame > 60) expect(p.primary.time).not.toBe(previousTime);
        previousTime = p.primary.time;
    }
    expect(requests.has("TURN_RUN_L")).toBe(true);
    available = true;
    let previousWeight = 0;
    for (let frame = 0; frame < 30; frame++) {
        const p = c.update(1 / 60, {
            speed: 3.2,
            grounded: true,
            turnRate: 0.8,
            turnIntent: 0.2,
        });
        expect(p.turnWeight - previousWeight).toBeLessThan(0.2);
        previousWeight = p.turnWeight;
    }
    expect(previousWeight).toBe(1);
    const air = c.update(1 / 60, {
        speed: 3.2,
        grounded: false,
        verticalVelocity: 6,
        jumpCount: 1,
    });
    expect(air.primary.name).toBe("TURN_RUN_L");
    expect(air.secondary.name).toBe("JUMP_RUNNING");
    expect(air.blend).toBeGreaterThan(0);
    for (let f = 0; f < 30; f++)
        c.update(1 / 60, {
            speed: 3.2,
            grounded: false,
            verticalVelocity: 2,
            jumpCount: 1,
        });
    expect(air.primary.name + air.secondary.name).not.toMatch(/TURN_|CUT_/);
    expect(air.turnWeight).toBe(0);
});

test.each([false, true])(
    "turn clips keep stance feet near the source floor (CC0=%s)",
    async (cc0) => {
        const { root, clips, metadata, bone } = await library(cc0);
        const mixer = new THREE.AnimationMixer(root);
        const feet = [bone("leftFoot"), bone("rightFoot")];
        const sample = (clip: THREE.AnimationClip, t: number) => {
            mixer.stopAllAction();
            const action = mixer
                .clipAction(clip)
                .setLoop(THREE.LoopOnce, 1)
                .play();
            action.clampWhenFinished = true;
            action.time = t;
            mixer.update(0);
            root.updateMatrixWorld(true);
            return feet.map((f) => f.getWorldPosition(new THREE.Vector3()));
        };
        for (const clip of clips.filter((c) => metadata[c.name].turn)) {
            const info = metadata[clip.name].turn,
                source = clips.find((c) => c.name === info.gait);
            for (let frame = 0; frame <= 12; frame++) {
                const phase =
                    (info.entryPhase + (info.phaseSpan * frame) / 12) % 1;
                const expected = sample(source, phase * source.duration),
                    actual = sample(clip, (frame / 12) * clip.duration);
                for (let side = 0; side < 2; side++) {
                    const contacts =
                        metadata[info.gait].contacts[side ? "right" : "left"];
                    if (
                        contacts[Math.round(phase * (contacts.length - 1))] <
                        0.65
                    )
                        continue;
                    const penetration = expected[side].y - actual[side].y;
                    if (penetration > 0.035)
                        throw new Error(
                            `${cc0}:${
                                clip.name
                            }:${side}:${frame}: penetration ${penetration} expectedY=${
                                expected[side].y
                            } actualY=${actual[side].y} contact=${
                                metadata[info.gait].contacts[
                                    side ? "right" : "left"
                                ][
                                    Math.round(
                                        phase *
                                            (metadata[info.gait].contacts.left
                                                .length -
                                                1)
                                    )
                                ]
                            }`
                        );
                    expect(penetration).toBeLessThan(0.035);
                }
            }
        }
        mixer.stopAllAction();
        mixer.uncacheRoot(root);
    }
);

test("leaving a moving turn restores the continuous gait blend without a weight jump", async () => {
    const { metadata } = await library(),
        c = createLobbyLocomotion(metadata);
    for (let f = 0; f < 120; f++)
        c.update(1 / 60, { speed: 2.8, grounded: true, turnRate: 0.9 });
    let previous: Record<string, number> = { TURN_RUN_L: 1 };
    for (let f = 0; f < 120; f++) {
        const p = c.update(1 / 60, { speed: 2.8, grounded: true, turnRate: 0 });
        const weights = { [p.primary.name]: 1 - p.blend };
        weights[p.secondary.name] = (weights[p.secondary.name] || 0) + p.blend;
        for (const name of new Set([
            ...Object.keys(previous),
            ...Object.keys(weights),
        ]))
            expect(
                Math.abs((weights[name] || 0) - (previous[name] || 0))
            ).toBeLessThan(0.18);
        previous = weights;
    }
    expect(previous.WALK).toBeCloseTo(0.25);
    expect(previous.RUN).toBeCloseTo(0.75);
});

test("stopping during a moving turn fades from the visible turn before settling", async () => {
    const { metadata } = await library(),
        c = createLobbyLocomotion(metadata);
    for (let f = 0; f < 120; f++)
        c.update(1 / 60, {
            speed: 3.2,
            grounded: true,
            turnRate: 0.9,
            turnIntent: 0.2,
        });
    // Braking is confirmed for 25ms before selecting a stop.
    c.update(1 / 60, {
        speed: 1.3,
        grounded: true,
        turnRate: 0,
        turnIntent: 0,
    });
    const first = c.update(1 / 60, {
        speed: 0.8,
        grounded: true,
        turnRate: 0,
        turnIntent: 0,
    });
    expect(first.primary.name).toBe("TURN_RUN_L");
    expect(first.secondary.name).toMatch(/^STOP_/);
    expect(first.blend).toBeGreaterThan(0);
    expect(first.blend).toBeLessThan(0.5);
    let p = first;
    for (let f = 0; f < 90; f++)
        p = c.update(1 / 60, {
            speed: Math.max(0, 0.8 - f * 0.2),
            grounded: true,
            turnRate: 0,
        });
    expect(isLobbyIdle(p.primary.name)).toBe(true);
    expect(isLobbyIdle(p.secondary.name)).toBe(true);
    expect(p.turnWeight).toBe(0);
});

test.each([false, true])(
    "sprint downshifts keep advancing a gait instead of entering a planted stop (CC0=%s)",
    async (cc0) => {
        const { metadata } = await library(cc0);
        for (const hz of [30, 60, 120])
            for (const stopping of [undefined, false])
                for (const target of stopping === false
                    ? [0.4, 1.6, 3.2]
                    : [1.6, 3.2])
                    for (const quality of ["full", "crowd"] as const)
                        for (const procedural of [true, false]) {
                            const clock = createLobbyLocomotion(metadata);
                            const velocity = { vx: 0, vz: 0 };
                            const dt = 1 / hz;
                            const tick = () =>
                                clock.update(dt, {
                                    speed: Math.hypot(velocity.vx, velocity.vz),
                                    grounded: true,
                                    quality,
                                    procedural,
                                    stopping,
                                });
                            for (let i = 0; i < hz * 2; i++) {
                                advanceVelocity(velocity, 0, -1, true, dt);
                                tick();
                            }
                            let previousPhase: number | undefined;
                            for (let i = 0; i < hz * 2; i++) {
                                // Hold direction, release sprint or reduce analog input.
                                advanceVelocity(
                                    velocity,
                                    0,
                                    -target / 3.2,
                                    false,
                                    dt
                                );
                                const pose = tick();
                                for (const sample of [
                                    pose.primary,
                                    pose.secondary,
                                ])
                                    expect(sample.name).toMatch(
                                        /^(WALK|RUN|SPRINT)$/
                                    );
                                const dominant =
                                    pose.blend < 0.5
                                        ? pose.primary
                                        : pose.secondary;
                                const phase =
                                    dominant.time /
                                    metadata[dominant.name].duration;
                                if (previousPhase !== undefined) {
                                    const advance =
                                        (phase - previousPhase + 1) % 1;
                                    expect(advance).toBeGreaterThan(0.0001);
                                    expect(advance).toBeLessThan(0.2);
                                }
                                previousPhase = phase;
                            }
                        }
    }
);

test.each([false, true])(
    "actual release still plays one final stop and held input can interrupt it (CC0=%s)",
    async (cc0) => {
        const { metadata } = await library(cc0);
        for (const hz of [30, 60, 120])
            for (const intent of [true, false]) {
                const dt = 1 / hz;
                const clock = createLobbyLocomotion(metadata);
                const velocity = { vx: 0, vz: -5.4 };
                for (let i = 0; i < hz; i++)
                    clock.update(dt, { speed: 5.4, grounded: true });
                let stops = 0,
                    wasStopping = false,
                    finished = false,
                    lastTime = 0;
                for (let i = 0; i < hz * 2; i++) {
                    advanceVelocity(velocity, 0, 0, false, dt);
                    const speed = Math.hypot(velocity.vx, velocity.vz);
                    const pose = clock.update(dt, {
                        speed,
                        grounded: true,
                        stopping: intent ? true : undefined,
                        stopDistance: intent ? speed / 28 : undefined,
                    });
                    const stop = [pose.primary, pose.secondary].find((s) =>
                        s.name.startsWith("STOP_")
                    );
                    if (stop) {
                        if (!wasStopping) stops++;
                        expect(stop.time).toBeGreaterThanOrEqual(lastTime);
                        lastTime = stop.time;
                    } else if (wasStopping) finished = true;
                    if (finished) {
                        expect(isLobbyIdle(pose.primary.name)).toBe(true);
                        expect(isLobbyIdle(pose.secondary.name)).toBe(true);
                    }
                    wasStopping = !!stop;
                }
                expect(stops).toBe(1);
                expect(finished).toBe(true);
            }

        const clock = createLobbyLocomotion(metadata);
        clock.update(1 / 60, { speed: 1.6, grounded: true });
        clock.update(1 / 60, {
            speed: 0.7,
            grounded: true,
            stopping: true,
            stopDistance: 0.1,
        });
        const stop = clock.update(1 / 60, {
            speed: 0.6,
            grounded: true,
            stopping: true,
            stopDistance: 0.08,
        });
        expect(`${stop.primary.name}:${stop.secondary.name}`).toContain(
            "STOP_"
        );
        // Resumed input can arrive before velocity increases; no acceleration threshold should hold the stop.
        const resumed = clock.update(1 / 60, {
            speed: 0.6,
            grounded: true,
            stopping: false,
        });
        expect(
            `${resumed.primary.name}:${resumed.secondary.name}`
        ).not.toContain("STOP_");
    }
);

test.each([false, true])(
    "remote stop inference tolerates a held sample but releases sustained slow motion (CC0=%s)",
    async (cc0) => {
        const { metadata } = await library(cc0);
        for (const hz of [30, 60, 120]) {
            const clock = createLobbyLocomotion(metadata);
            const dt = 1 / hz;
            clock.update(dt, { speed: 1.6, grounded: true });
            for (let i = 0; i < Math.ceil(0.04 * hz); i++)
                clock.update(dt, { speed: 0.8 - i * dt * 4, grounded: true });
            let p = clock.update(dt, { speed: 0.4, grounded: true });
            expect(`${p.primary.name}:${p.secondary.name}`).toContain("STOP_");
            p = clock.update(dt, { speed: 0.4, grounded: true });
            expect(`${p.primary.name}:${p.secondary.name}`).toContain("STOP_");
            for (let i = 0; i < Math.ceil(0.1 * hz); i++)
                p = clock.update(dt, { speed: 0.4, grounded: true });
            expect(p.primary.name).toBe("WALK");
            expect(p.secondary.name).toBe("WALK");
            const before = p.primary.time;
            p = clock.update(dt, { speed: 0.4, grounded: true });
            expect(p.primary.time).toBeGreaterThan(before);
        }
    }
);

test("the shipped idle pool retains each source and shares cached stance features", async () => {
    const { raw, metadata } = await library();
    const original = JSON.parse(
        fs.readFileSync(
            path.join(process.cwd(), "public/lobby/native-avatar-motion.json"),
            "utf8"
        )
    ).IDLE;
    expect(raw.IDLE_ONCYBER.duration).toBe(original.duration);
    expect(raw.IDLE_CC0.duration).toBe(2.5);
    for (const name of ["IDLE", "IDLE_ONCYBER", "IDLE_CC0"]) {
        expect(
            raw[name].tracks.filter((t) =>
                /Hand(Thumb|Index|Middle|Ring|Pinky)[123]\.quaternion$/.test(
                    t.name
                )
            )
        ).toHaveLength(30);
        expect(metadata[name].stance.length).toBe(
            (Math.ceil(raw[name].duration * 30) + 1) * 6
        );
        expect(Array.from(metadata[name].stance).every(Number.isFinite)).toBe(
            true
        );
        expect(metadata[name].contacts.left.length).toBeGreaterThan(30);
    }
    for (const name of [
        "mixamorigSpine.quaternion",
        "mixamorigLeftUpLeg.quaternion",
        "mixamorigRightArm.quaternion",
    ]) {
        const a = original.tracks.find((t) => t.name === name);
        const b = raw.IDLE_ONCYBER.tracks.find((t) => t.name === name);
        const source = new THREE.QuaternionKeyframeTrack(
            name,
            a.times,
            a.values
        ) as any;
        const packed = new THREE.QuaternionKeyframeTrack(
            name,
            b.times,
            b.values
        ) as any;
        const sa = source.createInterpolant(),
            sb = packed.createInterpolant();
        for (let f = 0; f <= 120; f++) {
            const time = (original.duration * f) / 120;
            const q = new THREE.Quaternion()
                .fromArray(sa.evaluate(time))
                .normalize();
            const r = new THREE.Quaternion()
                .fromArray(sb.evaluate(time))
                .normalize();
            expect(q.angleTo(r)).toBeLessThan(0.005);
        }
    }
});

test.each([30, 60, 120])(
    "movement-course legs enter idle without a pose hitch in either direction at %s Hz",
    async (hz) => {
        const { benchmarkMovementPose } = await import("./crowdBenchmark");
        for (const cc0 of [false, true]) {
            const { metadata, clips } = await library(cc0);
            const bones = [
                "LeftUpLeg",
                "LeftLeg",
                "LeftFoot",
                "RightUpLeg",
                "RightLeg",
                "RightFoot",
            ];
            const tracks = new Map(
                clips.map((clip) => [
                    clip.name,
                    bones.map((name) =>
                        (
                            clip.tracks.find(
                                (t) => t.name === `mixamorig${name}.quaternion`
                            ) as any
                        ).createInterpolant()
                    ),
                ])
            );
            for (const seed of [0, 0.17, 0.38, 0.51, 0.72, 0.91]) {
                const clock = createLobbyLocomotion(metadata, seed);
                let previous: THREE.Quaternion[] | undefined;
                let previousHeading = benchmarkMovementPose(0).rotation;
                let previousStop = "",
                    previousStopTime = 0;
                for (let frame = 0; frame < 9 * hz; frame++) {
                    const t = frame / hz,
                        movement = benchmarkMovementPose(t);
                    const p = clock.update(1 / hz, {
                        speed: movement.speed,
                        grounded: true,
                        turnRate: (movement.rotation - previousHeading) * hz,
                    });
                    previousHeading = movement.rotation;
                    const rotations = bones.map((_, i) =>
                        new THREE.Quaternion()
                            .fromArray(
                                tracks
                                    .get(p.primary.name)
                                    [i].evaluate(p.primary.time)
                            )
                            .normalize()
                            .slerp(
                                new THREE.Quaternion()
                                    .fromArray(
                                        tracks
                                            .get(p.secondary.name)
                                            [i].evaluate(p.secondary.time)
                                    )
                                    .normalize(),
                                p.blend
                            )
                    );
                    if (
                        previous &&
                        ((t >= 3.2 && t < 3.8) || (t >= 7.2 && t < 7.8))
                    ) {
                        const delta =
                            (Math.max(
                                ...rotations.map((q, i) =>
                                    q.angleTo(previous[i])
                                )
                            ) *
                                180) /
                            Math.PI;
                        // The former return snapped by 11–15 degrees in a 60 Hz
                        // frame. Permit normal authored leg speed, not a pose skip.
                        expect(delta * hz).toBeLessThan(600);
                    }
                    const stop = [p.primary, p.secondary].find((s) =>
                        s.name.startsWith("STOP_")
                    );
                    if (stop && stop.name === previousStop) {
                        expect(stop.time).toBeGreaterThanOrEqual(
                            previousStopTime
                        );
                        expect(
                            stop.time - previousStopTime
                        ).toBeLessThanOrEqual(1 / hz + 1e-6);
                    }
                    previousStop = stop?.name || "";
                    previousStopTime = stop?.time || 0;
                    previous = rotations;
                }
            }
        }
    }
);

test.each([30, 60, 120])(
    "known single jumps never roll or become double jumps from velocity corrections at %i Hz",
    async (fps) => {
        const { metadata } = await library();
        const c = createLobbyLocomotion(metadata);
        c.update(1 / fps, { speed: 1.6, grounded: true, jumpCount: 0 });
        for (let i = 0; i < fps; i++) {
            const pose = c.update(1 / fps, {
                speed: 1.6,
                grounded: false,
                jumpCount: 1,
                verticalVelocity: i < fps / 3 ? 8 : i < fps / 2 ? 12 : -12,
            });
            expect([pose.primary.name, pose.secondary.name]).not.toContain(
                "JUMP_DOUBLE"
            );
        }
        const pose = c.update(1 / fps, {
            speed: 1.6,
            grounded: true,
            jumpCount: 0,
            verticalVelocity: 0,
        });
        expect(pose.secondary.name).toBe("DROP_WALKING");
    }
);

test("known double jumps retain the moving roll landing", async () => {
    const { metadata } = await library();
    const c = createLobbyLocomotion(metadata);
    c.update(0.1, { speed: 1.6, grounded: true, jumpCount: 0 });
    c.update(0.1, {
        speed: 1.6,
        grounded: false,
        jumpCount: 1,
        verticalVelocity: 8,
    });
    const second = c.update(0.1, {
        speed: 1.6,
        grounded: false,
        jumpCount: 2,
        verticalVelocity: 8,
    });
    expect(second.secondary.name).toBe("JUMP_DOUBLE");
    c.update(0.1, {
        speed: 1.6,
        grounded: false,
        jumpCount: 2,
        verticalVelocity: -10,
    });
    const landing = c.update(0.1, {
        speed: 1.6,
        grounded: true,
        jumpCount: 0,
        verticalVelocity: 0,
    });
    expect(landing.secondary.name).toBe("DROP_WALKING_ROLL");
});

test("a first jump after stepping off a ledge plays takeoff rather than remaining in falling", async () => {
    const { metadata } = await library();
    const c = createLobbyLocomotion(metadata);
    c.update(0.1, { speed: 1.6, grounded: true, jumpCount: 0 });
    c.update(0.1, {
        speed: 1.6,
        grounded: false,
        jumpCount: 0,
        verticalVelocity: -2,
    });
    const takeoff = c.update(0.1, {
        speed: 1.6,
        grounded: false,
        jumpCount: 1,
        verticalVelocity: 8,
    });
    expect(takeoff.secondary.name).toBe("JUMP_WALKING");
});
