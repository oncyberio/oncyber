// The standard Oncyber guest portrait, kept independent of world globals.
export const LOBBY_GUEST_PORTRAIT =
    "https://cyber.mypinata.cloud/ipfs/QmTN7ytNn7DurPVg6J8s7sYFUKZFc1ZuCa3MMuebth894m?filename=finalsun_ipz0ru.png";

// The Cloudinary accounts that now answer 401 for everything (the same list as
// cloudinary.isBrokenCloudinaryUrl, kept here so this file stays import-free).
const DEAD_PORTRAIT_PREFIX =
    /^https?:\/\/res\.cloudinary\.com\/(oncyber-io|oncybertesting|ugc-oo-oo)\//;

/**
 * The portrait the lobby shows for a profile picture: the guest portrait when
 * there is none or it sits on a host known to be gone (the old Cloudinary
 * accounts), as spaces do in formatAvatar. A picture that still fails to load
 * falls back to the guest portrait where it is drawn.
 */
export function lobbyPortraitUrl(value: unknown): string {
    if (typeof value !== "string") return LOBBY_GUEST_PORTRAIT;
    const url = value.trim();
    if (!url || DEAD_PORTRAIT_PREFIX.test(url)) return LOBBY_GUEST_PORTRAIT;
    return url;
}
