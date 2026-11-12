import {
    createNativeTravelAnimation,
    NATIVE_TRAVEL_IDLE_BLEND_MS,
} from "./nativeTravelAnimation";
import { TRAVEL_ANIMATION_PLAY_MS } from "@features/lobby/travelAnimationPack";
const THREE = require("three");
const pose = {
    position: new THREE.Vector3(4, 2, 6),
    rotation: 0.6,
    height: 3.6,
    visible: true,
    idleTime: 1.25,
};
const model = () => ({
    root: new THREE.Group(),
    height: 1.8,
    sourceUrl: "/user.vrm",
    prepareTravel: jest.fn(async () => {}),
    sampleTravelPose: jest.fn((_pose: any) => true),
    update: jest.fn(),
    playEmote: jest.fn(),
    dispose: jest.fn(),
});

test("the exact identity stages in crouch, loops through loading, then stands and blends to the native idle phase", async () => {
    const avatar = model();
    const scene = new THREE.Scene();
    const factory = jest.fn(async () => avatar);
    const travel = createNativeTravelAnimation(
        { userData: { VRM: "/user.vrm", avatar: "/portrait.png" } },
        scene,
        factory
    );
    await travel.prepare(false);
    await travel.prepare(false);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith(
        "/user.vrm",
        expect.objectContaining({ profilePhoto: "/portrait.png" })
    );
    expect(scene.children).toEqual([avatar.root]);
    expect(avatar.root.visible).toBe(false);
    travel.hold(pose, 0);
    travel.hold(pose, 16000);
    expect(avatar.root.position.toArray()).toEqual([4, 2, 6]);
    expect(avatar.root.rotation.y).toBe(0.6);
    expect(avatar.root.scale.toArray()).toEqual([2, 2, 2]);
    expect(avatar.sampleTravelPose).toHaveBeenLastCalledWith({
        name: "TRAVEL_CROUCH_IDLE",
        time: 16,
    });
    // The 1 s authored stand-up plays at trip speed, in 625 ms.
    expect(TRAVEL_ANIMATION_PLAY_MS.TRAVEL_STAND_UP).toBeCloseTo(625);
    expect(travel.standUp(16000, false)).toBe(
        TRAVEL_ANIMATION_PLAY_MS.TRAVEL_STAND_UP + NATIVE_TRAVEL_IDLE_BLEND_MS
    );
    travel.hold(pose, 16050);
    expect(avatar.sampleTravelPose).toHaveBeenLastCalledWith({
        name: "TRAVEL_STAND_UP",
        time: 0.08,
        previous: { name: "TRAVEL_CROUCH_IDLE", time: 16 },
        blend: 0.5,
    });
    travel.hold(pose, 16715);
    expect(avatar.sampleTravelPose).toHaveBeenLastCalledWith({
        name: "IDLE_CC0",
        time: 1.25,
        previous: { name: "TRAVEL_STAND_UP", time: 1 },
        blend: 0.5,
    });
    travel.hold(pose, 16805);
    expect(avatar.sampleTravelPose.mock.calls.at(-1)[0].blend).toBe(1);
    travel.dispose();
    travel.dispose();
    expect(scene.children).toHaveLength(0);
    expect(avatar.dispose).toHaveBeenCalledTimes(1);
    expect(travel.active).toBe(false);
});

test("reduced motion and first-person keep the correct visibility without replaying the transition", async () => {
    const avatar = model();
    const travel = createNativeTravelAnimation(
        {},
        new THREE.Scene(),
        async () => avatar
    );
    await travel.prepare(true);
    travel.hold({ ...pose, visible: false }, 100);
    expect(avatar.root.visible).toBe(false);
    expect(avatar.sampleTravelPose).toHaveBeenLastCalledWith({
        name: "IDLE_CC0",
        time: 1.25,
    });
    expect(travel.standUp(100, true)).toBe(0);
    travel.dispose();
});

test("cancelling while the pack loads disposes the late rig without attaching it", async () => {
    const avatar = model();
    let finish: () => void;
    avatar.prepareTravel.mockImplementation(
        () =>
            new Promise<void>((resolve) => {
                finish = resolve;
            })
    );
    const scene = new THREE.Scene();
    const travel = createNativeTravelAnimation({}, scene, async () => avatar);
    const preparing = travel.prepare(false);
    const rejected = expect(preparing).rejects.toThrow("Arrival cancelled");
    await Promise.resolve();
    travel.dispose();
    finish();
    await rejected;
    expect(scene.children).toHaveLength(0);
    expect(avatar.dispose).toHaveBeenCalledTimes(1);
});

test("a missing pack releases the new rig and fails preparation", async () => {
    const avatar = model();
    avatar.prepareTravel.mockRejectedValue(new Error("Missing clip"));
    const scene = new THREE.Scene();
    const travel = createNativeTravelAnimation({}, scene, async () => avatar);
    await expect(travel.prepare(false)).rejects.toThrow("Missing clip");
    expect(scene.children).toHaveLength(0);
    expect(avatar.dispose).toHaveBeenCalledTimes(1);
    travel.dispose();
});

test("native PFP materials cannot be replaced or retired by a late travel-rig photo load", async () => {
    const avatar = model();
    const factory = jest.fn(async () => avatar);
    const travel = createNativeTravelAnimation({
        userData: { VRM: "/pfp.vrm", avatar: "/photo.png" },
        avatar3D: { highQualityMeshes: new THREE.Group() },
    }, new THREE.Scene(), factory);
    await travel.prepare(false);
    expect(factory).toHaveBeenCalledWith("/pfp.vrm", expect.objectContaining({ profilePhoto: undefined }));
    travel.dispose();
});
