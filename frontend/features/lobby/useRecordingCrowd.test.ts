/** @jest-environment node */
import { parseRecordingCrowd } from "./recordingCrowdOptions";
import { CROWD_FIGURE_LOOKS, crowdWardrobe } from "./useRecordingCrowd";
import { figureAvatarOf } from "@features/procedural-avatar/catalogue";

test("a crowd wears variations of the figure unless told otherwise", () => {
    const avatars = crowdWardrobe(parseRecordingCrowd("?crowd=20"));
    expect(avatars).toHaveLength(CROWD_FIGURE_LOOKS);
    const looks = avatars.map((avatar) => figureAvatarOf(avatar.url)?.look);
    // Never the figure as drawn: that one is for you.
    expect(looks).not.toContain(0);
    expect(new Set(looks).size).toBe(CROWD_FIGURE_LOOKS);
});

test("named avatars are worn as named", () => {
    const avatars = crowdWardrobe(
        parseRecordingCrowd("?crowd=5&crowdAvatars=runner,nobody,figure")
    );
    expect(avatars[0].url).toBe("/avatars/procedural/runner");
    expect(avatars.slice(1)).toHaveLength(CROWD_FIGURE_LOOKS);
});
