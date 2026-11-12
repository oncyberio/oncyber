/**
 * Which built-in avatar someone gets when they have not picked one.
 *
 * - Signed out (no account, or the anonymous studio draft): Summer.
 * - Signed in: their pfp avatar, the one that wears their profile picture.
 *   "check" is the version for an NFT pfp, "square" for any other picture,
 *   including a custom upload.
 *
 * An avatar the person picked (settings.vrm, or the one chosen in this tab)
 * always wins over this default; callers check that first.
 */
export type DefaultAvatarId = "sunshine" | "square" | "check";

export interface DefaultAvatarIdentity {
    walletId?: string;
    avatarContractAddress?: string;
}

export function hasAccount(identity?: DefaultAvatarIdentity | null) {
    const id = identity?.walletId;
    return typeof id === "string" && !!id && id !== "anon";
}

export function hasNftPfp(identity?: DefaultAvatarIdentity | null) {
    const address = identity?.avatarContractAddress;
    return !!address && address !== "0xnotanaddress";
}

/** The pfp avatar that shows this person's profile picture. */
export function pfpAvatarId(
    identity?: DefaultAvatarIdentity | null
): "square" | "check" {
    return hasNftPfp(identity) ? "check" : "square";
}

export function defaultAvatarId(
    identity?: DefaultAvatarIdentity | null
): DefaultAvatarId {
    return hasAccount(identity) ? pfpAvatarId(identity) : "sunshine";
}
