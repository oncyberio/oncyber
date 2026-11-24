// Three-free: the upload screen and the studio read these as well as the
// engine.

/** The shortest and the tallest an avatar can stand, in world units. */
export const MINIMUM_VRM_BOX = 1.0;
export const MAXIMUM_VRM_BOX = 4.5;

/**
 * A newly uploaded destination is modelled in metres (one world unit is one
 * metre), so its avatars stand at a person's height.
 */
export const METER_AVATAR_HEIGHT = 1.8;

/**
 * An avatar size is saved as a number from 0 to 1 across the range above
 * (`avatarSize` on a destination or a space). 0 reads as "not set"
 * everywhere, so the smallest size that can be saved sits just above it.
 */
export const MINIMUM_AVATAR_SIZE = 0.01;

const RANGE = MAXIMUM_VRM_BOX - MINIMUM_VRM_BOX;

const round = (value: number, digits: number) =>
    Math.round(value * 10 ** digits) / 10 ** digits;

/** The saved avatar size that makes an avatar stand `height` units tall. */
export function avatarHeightToSize(height: number): number {
    const size = (height - MINIMUM_VRM_BOX) / RANGE;

    return round(Math.min(1, Math.max(MINIMUM_AVATAR_SIZE, size)), 4);
}

/** How tall an avatar stands, in world units, at a saved avatar size. */
export function avatarSizeToHeight(size: number): number {
    const clamped = Math.min(1, Math.max(0, size));

    return round(MINIMUM_VRM_BOX + RANGE * clamped, 2);
}

export const METER_AVATAR_SIZE = avatarHeightToSize(METER_AVATAR_HEIGHT);

/** Where the eyes sit on an avatar, as a share of its height. */
const EYE_LEVEL = 0.93;

type SizedSpace = {
    exhibit?: { params?: { avatarSize?: number } | null } | null;
    roomParameters?: { avatarSize?: number; user_height?: number } | null;
} | null;

/**
 * The avatar size a world gives every visitor, or null when it has nothing
 * to go by and the visitor keeps their own.
 *
 * A space or destination that sets a size wins (every new upload does, in
 * metres). An older destination sets none, but it was built around its own
 * `user_height`, the height its camera looks from, so avatars stand with
 * their eyes there. Without this a visitor's avatar kept its own size, and
 * one modelled in metres stood knee-high to a world built at twice that.
 * The first-person eye follows the same rule (`./eyeHeight`).
 */
export function worldAvatarSize(space: SizedSpace): number | null {
    const set =
        space?.exhibit?.params?.avatarSize || space?.roomParameters?.avatarSize;

    if (typeof set === "number" && set > 0) return set;

    const eye = space?.roomParameters?.user_height;

    return typeof eye === "number" && eye > 0
        ? avatarHeightToSize(eye / EYE_LEVEL)
        : null;
}
