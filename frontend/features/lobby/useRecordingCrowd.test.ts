/** @jest-environment node */
import { parseRecordingCrowd } from "./recordingCrowdOptions";
import { CROWD_FIGURE_LOOKS, crowdWardrobe } from "./useRecordingCrowd";
import { figureAvatarOf } from "@features/procedural-avatar/catalogue";

test("a crowd wears variations of the figures unless told otherwise", () => {
    const avatars = crowdWardrobe(parseRecordingCrowd("?crowd=20"));
    expect(avatars).toHaveLength(CROWD_FIGURE_LOOKS * 2);
    const of = avatars.map((avatar) => figureAvatarOf(avatar.url));
    const stagehands = of.filter((spec) => spec.id === "figure");
    const ushers = of.filter((spec) => spec.id === "usher");
    // Never the Stagehand as drawn: that one is for you.
    expect(stagehands.map((spec) => spec.look)).not.toContain(0);
    expect(ushers.map((spec) => spec.look)).toContain(0);
    expect(new Set(avatars.map((a) => a.url)).size).toBe(avatars.length);
});

test("named avatars are worn as named", () => {
    const avatars = crowdWardrobe(
        parseRecordingCrowd("?crowd=5&crowdAvatars=runner,nobody,figure")
    );
    expect(avatars[0].url).toBe("/avatars/procedural/runner");
    expect(avatars.slice(1)).toHaveLength(CROWD_FIGURE_LOOKS);
});
