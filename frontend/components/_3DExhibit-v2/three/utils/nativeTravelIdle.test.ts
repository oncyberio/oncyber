import { IDLE, IDLE_CC0 } from "../factory/player/instanceavatarvrm/constants";
import {
    holdNativeTravelIdle,
    nativeTravelIdleAction,
    readNativeTravelIdleTime,
} from "./nativeTravelIdle";
const THREE = require("three");

test("departure blends to ready idle once and repeated holds do not reset its clock", () => {
    const root = new THREE.Object3D();
    const mixer = new THREE.AnimationMixer(root);
    const actions = Object.fromEntries(
        ["IDLE", "IDLE_CC0", "PRAYING"].map((name, i) => [
            name,
            mixer.clipAction(
                new THREE.AnimationClip(name, 2.5, [
                    new THREE.NumberKeyframeTrack(
                        ".position[y]",
                        [0, 2.5],
                        [i, i]
                    ),
                ])
            ),
        ])
    );
    actions.PRAYING.play();
    const avatar: any = {
        isHighQuality: true,
        emote: 9,
        currentEmote: { name: "PRAYING" },
        currentAction: { name: "PRAYING" },
        emoteResolve: jest.fn(),
        vrm: { possibleActions: actions },
        setCurrentAction(next) {
            if (this.currentAction === next) return;
            actions[this.currentAction.name].fadeOut(0.1);
            actions[next.name].reset().setEffectiveWeight(1).fadeIn(0.1).play();
            this.currentAction = next;
        },
    };
    avatar.stopEmote = jest.fn(() => avatar.emoteResolve());
    const reset = jest.spyOn(actions.IDLE_CC0, "reset");
    holdNativeTravelIdle(avatar);
    mixer.update(0.1);
    expect(actions.PRAYING.getEffectiveWeight()).toBeCloseTo(0);
    expect(actions.IDLE_CC0.getEffectiveWeight()).toBeCloseTo(1);
    for (let i = 0; i < 60; i++) {
        holdNativeTravelIdle(avatar);
        mixer.update(1 / 60);
    }
    expect(reset).toHaveBeenCalledTimes(1);
    expect(avatar.stopEmote).toHaveBeenCalledTimes(1);
    expect(avatar.currentAction).toBe(IDLE_CC0);
    expect(readNativeTravelIdleTime(avatar, 0)).toBeCloseTo(1.1);
    avatar.travelReadyIdle = false;
    expect(nativeTravelIdleAction(avatar)).toBeUndefined();
});

test("instanced return uses the shared clip and reads the actual 30Hz atlas phase", () => {
    const avatar: any = {
        metaIds: [["IDLE", "IDLE_CC0"]],
        setCurrentAction(action) {
            this.currentAction = action;
        },
    };
    holdNativeTravelIdle(avatar);
    expect(avatar.currentAction).toBe(IDLE_CC0);
    expect(readNativeTravelIdleTime(avatar, 0)).toBeCloseTo(1 / 30);
    expect(readNativeTravelIdleTime(avatar, 73 / 30)).toBeCloseTo(74 / 30);
    expect(readNativeTravelIdleTime(avatar, 74 / 30)).toBeCloseTo(1 / 30);
    expect(readNativeTravelIdleTime(avatar, NaN)).toBeUndefined();
});

test("older or late-loading rigs safely use available idle and never invent a matching phase", () => {
    const avatar: any = {
        metaIds: [["IDLE"]],
        setCurrentAction(action) {
            this.currentAction = action;
        },
    };
    holdNativeTravelIdle(avatar);
    expect(avatar.currentAction).toBe(IDLE);
    expect(readNativeTravelIdleTime(avatar, 100)).toBeUndefined();
    avatar.metaIds = undefined;
    expect(nativeTravelIdleAction(avatar)).toBeUndefined();
    expect(() => holdNativeTravelIdle(undefined)).not.toThrow();
});

test("arrival idle yields to movement while a departure hold stays owned", () => {
    const avatar: any = {
        metaIds: [["IDLE", "IDLE_CC0"]],
        setCurrentAction: jest.fn(),
    };
    holdNativeTravelIdle(avatar);
    avatar.travelReadyIdleUntilMovement = true;
    expect(nativeTravelIdleAction(avatar)).toBe(IDLE_CC0);
    avatar.floorVelocity = 0.05;
    expect(nativeTravelIdleAction(avatar)).toBeUndefined();
    expect(avatar.travelReadyIdle).toBe(false);
    holdNativeTravelIdle(avatar);
    avatar.floorVelocity = 0.05;
    expect(nativeTravelIdleAction(avatar)).toBe(IDLE_CC0);
});

test("a hidden native rig takes over at full idle weight without exposing an old emote crossfade", () => {
    const root = new THREE.Object3D();
    const mixer = new THREE.AnimationMixer(root);
    const idle = mixer.clipAction(
        new THREE.AnimationClip("IDLE_CC0", 2.5, [
            new THREE.NumberKeyframeTrack(".position[y]", [0, 2.5], [1, 1]),
        ])
    );
    const previous = mixer.clipAction(
        new THREE.AnimationClip("PRAYING", 2.5, [
            new THREE.NumberKeyframeTrack(".position[y]", [0, 2.5], [0.5, 0.5]),
        ])
    );
    previous.play();
    idle.play().setEffectiveWeight(0);
    const avatar = {
        isHighQuality: true,
        vrm: { possibleActions: { IDLE_CC0: idle, PRAYING: previous } },
        setCurrentAction: jest.fn(),
    };
    holdNativeTravelIdle(avatar, true);
    expect(root.position.y).toBe(1);
    expect(idle.getEffectiveWeight()).toBe(1);
    expect(previous.getEffectiveWeight()).toBe(0);
});
