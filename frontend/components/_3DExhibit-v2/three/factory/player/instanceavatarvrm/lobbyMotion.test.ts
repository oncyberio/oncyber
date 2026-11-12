import * as THREE from "three";
import {
    createNativeLobbyMotion,
    nativeLocomotionSpeed,
    encodeLobbyPose,
    hasCustomPlayerAction,
} from "./lobbyMotion";
import { IDLE, WALK, RUN, EMOTES } from "./constants";

const metadata = {
    IDLE: { duration: 2 },
    WALK: { duration: 1 },
    RUN: { duration: 0.7 },
};
const ids = [
    "IDLE",
    "WALK",
    "custom-dance",
    "@lobby/IDLE",
    "@lobby/WALK",
    "@lobby/RUN",
];
const wrapper = () =>
    ({
        position: new THREE.Vector3(),
        rotation: 0,
        onFloor: true,
        currentAction: IDLE,
        currentEmote: null,
        isHighQuality: false,
        metaIds: [ids],
        animations: [0, 0, 0, 0],
        stopEmote: jest.fn(),
    } as any);

test("exact pose encoding preserves old atlas indexes and round-trips blend and phase", () => {
    const output = [0, 0, 0, 0];
    expect(
        encodeLobbyPose(
            {
                primary: { name: "WALK", time: 0.25 },
                secondary: { name: "RUN", time: 0.35 },
                blend: 0.4,
            },
            ids,
            metadata,
            output
        )
    ).toBe(true);
    expect(output).toEqual([4.25, 5.5, 0, -1.4]);
    const before = [...output];
    expect(
        encodeLobbyPose(
            {
                primary: { name: "missing", time: 0 },
                secondary: { name: "IDLE", time: 0 },
                blend: 0,
            },
            ids,
            metadata,
            output
        )
    ).toBe(false);
    expect(output).toEqual(before);
    expect(ids.slice(0, 3)).toEqual(["IDLE", "WALK", "custom-dance"]);
});

test.each([30, 60, 120])(
    "default walk/run remains phase continuous at %s Hz",
    (hz) => {
        jest.spyOn(Math, "random").mockReturnValue(0);
        const w = wrapper();
        const motion = createNativeLobbyMotion(w, metadata);
        motion.update(1 / hz);
        for (let i = 0; i < hz; i++) {
            w.position.z += (i < hz / 2 ? 10 : 20) / hz;
            expect(motion.update(1 / hz)).toBe(true);
            expect(w.animations[3]).toBeLessThanOrEqual(-1);
            expect(w.animations.every(Number.isFinite)).toBe(true);
        }
        expect(w.animations.slice(0, 2).some((v) => Math.floor(v) === 5)).toBe(
            true
        );
        jest.restoreAllMocks();
    }
);

test.each(["custom-dance", "WALK", "IDLE"])(
    "space-authored %s action retains ownership",
    (name) => {
        const w = wrapper();
        w.currentAction = { name, custom: true };
        const current = w.currentAction;
        const motion = createNativeLobbyMotion(w, metadata);
        expect(hasCustomPlayerAction(w)).toBe(true);
        expect(motion.update(1 / 60)).toBe(false);
        expect(w.currentAction).toBe(current);
        expect(w.animations).toEqual([0, 0, 0, 0]);
        expect(w.stopEmote).not.toHaveBeenCalled();
    }
);

test.each(["isSitting", "travelReadyIdle"])(
    "%s takes priority over default locomotion",
    (flag) => {
        const w = wrapper();
        w[flag] = true;
        expect(createNativeLobbyMotion(w, metadata).update(1 / 60)).toBe(false);
        expect(w.animations).toEqual([0, 0, 0, 0]);
    }
);

test("idle emotes and missing packs preserve the existing animation path", () => {
    const w = wrapper();
    w.currentEmote = EMOTES[0];
    expect(createNativeLobbyMotion(w, metadata).update(1 / 60)).toBe(false);
    expect(w.stopEmote).not.toHaveBeenCalled();
    expect(createNativeLobbyMotion(w, undefined)).toBeUndefined();
    expect(
        createNativeLobbyMotion(w, { IDLE: { duration: 2 } })
    ).toBeUndefined();
});

test("teleports do not register as a burst of running", () => {
    const w = wrapper();
    const motion = createNativeLobbyMotion(w, metadata);
    motion.update(1 / 60);
    w.position.set(100, 0, 100);
    motion.update(1 / 60);
    expect(w.currentAction).toBe(IDLE);
});

test("live skeletons sample the same poses and release cleanly to custom actions", () => {
    const w = wrapper();
    w.isHighQuality = true;
    const mixer = new THREE.AnimationMixer(new THREE.Group());
    const possibleActions = {};
    for (const [name, meta] of Object.entries(metadata))
        possibleActions["@lobby/" + name] = mixer.clipAction(
            new THREE.AnimationClip("@lobby/" + name, meta.duration, [])
        );
    possibleActions["custom-dance"] = mixer.clipAction(
        new THREE.AnimationClip("custom-dance", 1, [])
    );
    w.vrm = { possibleActions };
    const motion = createNativeLobbyMotion(w, metadata);
    expect(motion.update(1 / 60)).toBe(true);
    expect(possibleActions["@lobby/IDLE"].getEffectiveWeight()).toBeGreaterThan(
        0
    );
    motion.release();
    expect(possibleActions["@lobby/IDLE"].isScheduled()).toBe(false);
    expect(possibleActions["custom-dance"].getEffectiveTimeScale()).toBe(1);
    expect(w.currentAction).toBeNull();
});

test("native speed converts world units by avatar height, so cadence matches travel", () => {
    // A 2.85-unit space avatar is the 1.8 m lobby avatar scaled up.
    expect(nativeLocomotionSpeed(2.85, 2.85)).toBeCloseTo(1.8);
    expect(nativeLocomotionSpeed(6.8, 2.85)).toBeCloseTo(4.29, 1);
    // Smaller avatars take more steps for the same travel.
    expect(nativeLocomotionSpeed(5, 1.8)).toBeCloseTo(5);
    // Unknown height falls back to the normalized space avatar.
    expect(nativeLocomotionSpeed(2.85)).toBeCloseTo(1.8);
    expect(nativeLocomotionSpeed(-1, 2)).toBe(0);
});

test("a one-frame floor dropout while walking keeps the gait grounded", () => {
    const w = wrapper();
    const motion = createNativeLobbyMotion(w, metadata);
    w.nativeMotionInput = {
        grounded: true, jumpCount: 0, verticalVelocity: 0, speed: 6,
        stopping: false, flying: false, headingError: 0,
    };
    for (let i = 0; i < 30; i++) {
        w.position.x += 0.1;
        motion.update(1 / 60);
    }
    w.nativeMotionInput.grounded = false;
    w.nativeMotionInput.verticalVelocity = -0.3;
    w.position.x += 0.1;
    motion.update(1 / 60);
    expect(w.currentAction).toBe(RUN);
});

test.each([1, 2])(
    "native physics selects the correct landing after %i launches",
    (count) => {
        const w = wrapper();
        const clips = { ...metadata } as Record<string, any>;
        for (const name of [
            "JUMP_IDLE",
            "JUMP_WALKING",
            "JUMP_DOUBLE",
            "FALLING",
            "DROP_IDLE",
            "DROP_WALKING",
            "DROP_WALKING_ROLL",
        ])
            clips[name] = { duration: 0.6, loop: name === "FALLING" };
        w.metaIds = [
            [
                ...ids,
                ...Object.keys(clips)
                    .filter((name) => !metadata[name])
                    .map((name) => "@lobby/" + name),
            ],
        ];
        w.nativeMotionInput = {
            grounded: true,
            // 1.8 m/s for the normalized 2.85-unit avatar: a walking landing.
            speed: 2.85,
            jumpCount: 0,
            verticalVelocity: 0,
            stopping: false,
        };
        const motion = createNativeLobbyMotion(w, clips);
        motion.update(0.1);
        motion.update(0.1);
        Object.assign(w.nativeMotionInput, {
            grounded: false,
            jumpCount: 1,
            verticalVelocity: 8,
        });
        motion.update(0.1);
        if (count === 2) {
            w.nativeMotionInput.jumpCount = 2;
            motion.update(0.1);
            expect(w.metaIds[0][Math.floor(w.animations[1])]).toBe(
                "@lobby/JUMP_DOUBLE"
            );
        }
        w.nativeMotionInput.verticalVelocity = -12;
        motion.update(0.1);
        Object.assign(w.nativeMotionInput, {
            grounded: true,
            jumpCount: 0,
            verticalVelocity: 0,
        });
        motion.update(0.1);
        expect(w.metaIds[0][Math.floor(w.animations[1])]).toBe(
            "@lobby/DROP_WALKING" + (count === 2 ? "_ROLL" : "")
        );
    }
);

test("authored flight retains legacy animation ownership", () => {
    const w = wrapper();
    w.nativeMotionInput = { flying: true };
    expect(createNativeLobbyMotion(w, metadata).update(1 / 60)).toBe(false);
    expect(w.animations).toEqual([0, 0, 0, 0]);
});
