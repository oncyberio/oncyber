/** @jest-environment node */
import {
    MAXIMUM_VRM_BOX,
    METER_AVATAR_HEIGHT,
    METER_AVATAR_SIZE,
    MINIMUM_AVATAR_SIZE,
    MINIMUM_VRM_BOX,
    avatarHeightToSize,
    avatarSizeToHeight,
    worldAvatarSize,
} from "./avatarHeight";
import {
    DefaultRoomParameters,
    newDestinationParameters,
} from "./defaultroomparameters";

// Jest's Node environment does not expose structuredClone.
(globalThis as any).structuredClone ??= (value: unknown) =>
    JSON.parse(JSON.stringify(value));

// The engine scales an avatar by mix(MIN / MAX, 1, size) * (MAX / its own
// height), so it stands MIN + (MAX - MIN) * size units tall.
const engineHeight = (size: number) => {
    const mix = MINIMUM_VRM_BOX / MAXIMUM_VRM_BOX;
    return (mix + (1 - mix) * size) * MAXIMUM_VRM_BOX;
};

test("the metre size makes an avatar stand 1.8 units tall in the engine", () => {
    expect(METER_AVATAR_HEIGHT).toBe(1.8);
    expect(engineHeight(METER_AVATAR_SIZE)).toBeCloseTo(1.8, 3);
});

test.each([1.2, 1.8, 2.75, 4.5])(
    "a height of %s survives being saved as a size",
    (height) => {
        expect(avatarSizeToHeight(avatarHeightToSize(height))).toBe(height);
    }
);

test("the studio's old default of 0.5 is 2.75 units", () => {
    expect(avatarSizeToHeight(0.5)).toBe(2.75);
});

test("a size is never saved as 0, which reads as not set", () => {
    expect(avatarHeightToSize(MINIMUM_VRM_BOX)).toBe(MINIMUM_AVATAR_SIZE);
    expect(avatarHeightToSize(0)).toBe(MINIMUM_AVATAR_SIZE);
    expect(avatarHeightToSize(100)).toBe(1);
});

test("a new upload starts in metres; loaded destinations are left alone", () => {
    const params = newDestinationParameters();

    expect(params.avatarSize).toBe(METER_AVATAR_SIZE);
    expect(params.gravity).toBe(DefaultRoomParameters.gravity);

    // These are merged into every destination that loads.
    expect("avatarSize" in DefaultRoomParameters).toBe(false);

    // Each upload gets its own copy.
    params.fog.enabled = true;
    expect(DefaultRoomParameters.fog.enabled).toBe(false);
});

describe("worldAvatarSize", () => {
    test("a size set on the space wins over the destination's", () => {
        expect(
            worldAvatarSize({
                exhibit: { params: { avatarSize: 0.5 } },
                roomParameters: { avatarSize: 0.23, user_height: 2.3 },
            })
        ).toBe(0.5);
        expect(
            worldAvatarSize({
                exhibit: { params: {} },
                roomParameters: { avatarSize: 0.23, user_height: 2.3 },
            })
        ).toBe(0.23);
    });

    test("an older destination stands avatars with their eyes at its own height", () => {
        // The Starry Night dome: user_height 2.3, no avatar size anywhere.
        const size = worldAvatarSize({
            exhibit: { params: {} },
            roomParameters: { user_height: 2.3 },
        });

        expect(avatarSizeToHeight(size)).toBeCloseTo(2.47, 2);
        expect(avatarSizeToHeight(size) * 0.93).toBeCloseTo(2.3, 1);
    });

    test("a destination built very large stops at the tallest avatar", () => {
        expect(worldAvatarSize({ roomParameters: { user_height: 17 } })).toBe(
            1
        );
    });

    test("with nothing to go by the visitor keeps their own size", () => {
        expect(worldAvatarSize({ roomParameters: {} })).toBeNull();
        expect(
            worldAvatarSize({ roomParameters: { user_height: 0 } })
        ).toBeNull();
        expect(worldAvatarSize(null)).toBeNull();
    });
});
