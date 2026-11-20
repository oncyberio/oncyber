import cookie from "cookie";
import { POSITIVE_PROFILE_TTL_MS } from "@utils/firestore/userProfiles";

/**
 * When someone last changed their own account, kept in their browser.
 *
 * Page loads read the signed-in account through a cache
 * (utils/firestore/userProfiles.ts). A write clears the shared copy and the
 * copy on the instance that handled it, but every other warm instance keeps
 * its own for up to two hours. So a change someone had just made (the avatar
 * they picked, their camera, their name) could be missing from their next
 * page. The write leaves this mark, and the page load passes it to the
 * cache, which then skips any copy older than it.
 */
export const PROFILE_WRITTEN_COOKIE = "_pw";

/** Call after a write to the signed-in account's own document. */
export function markProfileWritten(res: any, now = Date.now()) {
    const mark = cookie.serialize(PROFILE_WRITTEN_COOKIE, String(now), {
        httpOnly: true,
        // No longer than a cached copy can live.
        maxAge: Math.ceil(POSITIVE_PROFILE_TTL_MS / 1000),
        path: "/",
        secure: true,
        sameSite: "lax",
    });
    const existing = res.getHeader?.("Set-Cookie");
    res.setHeader(
        "Set-Cookie",
        existing ? [].concat(existing as any, mark) : mark
    );
}

/** The mark, as the `notBefore` of a profile read; nothing when unset or odd. */
export function profileWrittenAt(
    cookies: Record<string, string> | undefined,
    now = Date.now()
): number | undefined {
    const at = Number(cookies?.[PROFILE_WRITTEN_COOKIE]);
    // A time in the future would keep every copy out for good.
    return Number.isFinite(at) && at > 0 && at <= now + 60_000 ? at : undefined;
}
