import * as THREE from "three";
import AbstractBaker from "./abstract";
import { prepareNativeLobbyClips } from "../lobbyMotionClips";
jest.mock("../lobbyMotionClips", () => ({
    prepareNativeLobbyClips: jest.fn(),
}));
jest.mock(
    "@3utils/packer.js",
    () =>
        class {
            init() {}
        },
    { virtual: true }
);
const legacy = ["IDLE", "WALK", "custom-walk", "TECHNO"].map(
    (name) => new THREE.AnimationClip(name, 1, [])
);
const shared = [new THREE.AnimationClip("@lobby/IDLE", 2, [])];
const metadata = { IDLE: { duration: 2 } };
function setup() {
    const baker = new AbstractBaker() as any;
    baker.prepareAnimations = jest.fn(() => legacy);
    baker.updateSkeleton = () => ({ mergedSkeleton: {}, boneMap: {} });
    baker.bakeAll = jest.fn(() => ({}));
    const vrm = { scene: new THREE.Group(), update() {} };
    return { baker, vrm };
}
beforeEach(() =>
    (prepareNativeLobbyClips as jest.Mock).mockResolvedValue({
        clips: shared,
        metadata,
    })
);
test("new defaults append after every existing/custom clip without replacing their objects", async () => {
    const { baker, vrm } = setup();
    const result = await baker.prepare(vrm);
    const baked = baker.bakeAll.mock.calls[0][1];
    expect(baked).toEqual([...legacy, ...shared]);
    legacy.forEach((clip, i) => expect(baked[i]).toBe(clip));
    expect(result.lobbyMotion).toBe(metadata);
});
test("a missing optional pack retains all legacy/custom clips", async () => {
    (prepareNativeLobbyClips as jest.Mock).mockResolvedValue(undefined);
    const { baker, vrm } = setup();
    const result = await baker.prepare(vrm);
    expect(baker.bakeAll.mock.calls[0][1]).toEqual(legacy);
    expect(result.lobbyMotion).toBeUndefined();
});
test("atlas budget fallback keeps the complete original pack and disables shared playback", async () => {
    const { baker, vrm } = setup();
    baker.bakeAll.mockImplementationOnce(() => {
        throw Object.assign(new Error("budget"), { code: "LOBBY_ATLAS_FULL" });
    });
    const result = await baker.prepare(vrm);
    expect(baker.bakeAll).toHaveBeenCalledTimes(2);
    expect(baker.bakeAll.mock.calls[1][1]).toEqual(legacy);
    expect(result.lobbyMotion).toBeUndefined();
});
