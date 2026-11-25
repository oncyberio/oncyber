import { walkingEyeHeight } from "./eyeHeight";

describe("walkingEyeHeight", () => {
    it("uses an older destination's own height, not the visitor's avatar", () => {
        expect(
            walkingEyeHeight({ roomParameters: { user_height: 2.3 } }, 4.5)
        ).toBe(2.3);
    });

    it("follows the avatar's head when the destination sets a size", () => {
        expect(
            walkingEyeHeight(
                { roomParameters: { user_height: 2.3, avatarSize: 0.23 } },
                1.8
            )
        ).toBe(1.8);
    });

    it("follows the avatar's head when the space sets a size", () => {
        expect(
            walkingEyeHeight(
                {
                    roomParameters: { user_height: 2.3 },
                    exhibit: { params: { avatarSize: 0.5 } },
                },
                2.75
            )
        ).toBe(2.75);
    });

    it("falls back to the head with no destination height", () => {
        expect(walkingEyeHeight({ roomParameters: {} }, 1.8)).toBe(1.8);
        expect(walkingEyeHeight(null, 1.8)).toBe(1.8);
    });
});
