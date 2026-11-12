import AnimatedWrapper from "./wrapper";
import { EMOTES } from "./constants";

jest.mock("@3constants", () => ({}), { virtual: true });
jest.mock("@3utils/math/mix", () => ({ __esModule: true, default: () => 1 }), {
    virtual: true,
});
jest.mock("@3shared", () => ({}), { virtual: true });
jest.mock("..", () => ({}));
jest.mock("gsap", () => ({}));
jest.mock("@pixiv/three-vrm-springbone", () => ({
    VRMSpringBoneColliderShapeCapsule: class {},
    VRMSpringBoneColliderShapeSphere: class {},
}));

beforeEach(() => {
    jest.spyOn(AnimatedWrapper.prototype, "updateVRM").mockImplementation(
        () => {}
    );
});
afterEach(() => jest.restoreAllMocks());
const avatar = () =>
    new AnimatedWrapper({ isHighQuality: false }, "test", { userData: {} });

test("explicit Stop completes the playing emote and returns it to locomotion", async () => {
    const wrapper = avatar();
    const completed = jest.fn();
    const playing = wrapper.playEmote(1).then(completed);
    expect(wrapper.currentEmote).toBe(EMOTES[1]);
    await wrapper.playEmote(-1);
    await playing;
    expect(wrapper.emote).toBe(-1);
    expect(wrapper.currentEmote).toBeNull();
    expect(wrapper.emoteResolve).toBeNull();
    expect(completed).toHaveBeenCalledTimes(1);
});

test("Stop remains safe while already idle and after a previous Stop", async () => {
    const wrapper = avatar();
    expect(() => wrapper.stopEmote()).not.toThrow();
    await expect(wrapper.playEmote(-1)).resolves.toBeUndefined();
    wrapper.playEmote(0);
    await wrapper.playEmote(-1);
    await expect(wrapper.playEmote(-1)).resolves.toBeUndefined();
    expect(wrapper.currentEmote).toBeNull();
});

test("unrecognized indexes do not stop or renumber a playing animation", async () => {
    const wrapper = avatar();
    const lastIndex = EMOTES.length - 1;
    const playing = wrapper.playEmote(lastIndex);
    await wrapper.playEmote(EMOTES.length);
    expect(wrapper.emote).toBe(lastIndex);
    expect(wrapper.currentEmote).toBe(EMOTES[lastIndex]);
    wrapper.stopEmote();
    await playing;
});
