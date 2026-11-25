// Three-free, so the rule can be tested on its own.

type SpaceLike = {
    roomParameters?: { avatarSize?: number; user_height?: number } | null;
    exhibit?: { params?: { avatarSize?: number } | null } | null;
} | null;

/**
 * How high the first-person camera sits above the player's feet.
 *
 * A destination or space that sets an avatar size (every new upload does,
 * in metres) sizes the visitor's avatar, so the eye sits at that avatar's
 * head. An older destination sets none: its scale was authored around its
 * own `user_height`, so the eye sits there, whatever size the visitor once
 * saved on their own avatar. Without this, a visitor whose avatar is set to
 * the largest size looked down on every older destination from 4.5 units.
 */
export function walkingEyeHeight(space: SpaceLike, headHeight: number): number {
    const params = space?.roomParameters;

    if (space?.exhibit?.params?.avatarSize || params?.avatarSize) {
        return headHeight;
    }

    const legacy = params?.user_height;

    return typeof legacy === "number" && legacy > 0 ? legacy : headHeight;
}
