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
