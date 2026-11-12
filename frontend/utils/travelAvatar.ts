/** The loaded choice is tab-local presentation state, independent of a delayed
 * profile save. Same-origin destination frames share this session storage. */
export type TravelAvatar = {
    id: string;
    name?: string;
    url: string;
    scale?: number;
};
const key = "oncyber:travel-avatar";
const owner = (identity: any) =>
    String(identity?.walletId || identity?.id || "anonymous").toLowerCase();
export function rememberTravelAvatar(identity: any, avatar: TravelAvatar) {
    if (!avatar?.id || !avatar?.url) return;
    try {
        sessionStorage.setItem(
            key,
            JSON.stringify({ owner: owner(identity), avatar })
        );
    } catch {}
}
export function readTravelAvatar(identity: any): TravelAvatar | null {
    try {
        const stored = JSON.parse(sessionStorage.getItem(key) || "null");
        if (stored?.owner !== owner(identity)) return null;
        const avatar = stored.avatar;
        if (typeof avatar?.id !== "string" || typeof avatar.url !== "string")
            return null;
        const url = new URL(avatar.url, window.location.href);
        if (!/^https?:$/.test(url.protocol) || url.username || url.password)
            return null;
        return {
            id: avatar.id,
            name: avatar.name || "Avatar",
            url: url.href,
            ...(Number.isFinite(avatar.scale) &&
            avatar.scale > 0 &&
            avatar.scale <= 4
                ? { scale: avatar.scale }
                : {}),
        };
    } catch {
        return null;
    }
}
