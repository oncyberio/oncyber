/**
 * The wallet's avatars load slowly, one collection after another, well after
 * the space has started. One of them becomes the avatar on show only when it
 * is the one the visitor is meant to be wearing now: the avatar that
 * travelled with them or the one they picked here, else the saved one.
 * Without this an avatar saved long ago came back over whatever the visitor
 * had just chosen.
 */
export function adoptsOwnedAvatar(
    id: string | undefined,
    wantedId: string | null | undefined,
    activeId: string | undefined
): boolean {
    return !!id && id === wantedId && id !== activeId;
}
