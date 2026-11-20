import type { VisitedProfile } from "@features/landing-carousel/types";

type Lookup = (handle: string) => Promise<any>;

/** The lobby, opened with someone's profile sidebar: where /@name goes. */
export function profileLobbyHref(handle: string) {
    const name = handle.replace(/^@/, "");
    return `/?lobby=1&profile=${encodeURIComponent(name)}`;
}

/** Only what a visitor sees of an account. */
export function publicProfile(user: any): VisitedProfile | null {
    if (!user?.id) return null;
    const text = (value: unknown) =>
        typeof value === "string" && value ? value : undefined;
    const profile: VisitedProfile = {
        id: String(user.id),
        username: text(user.username),
        walletId: text(user.walletId) ?? String(user.id),
        avatar: text(user.avatar),
    };
    // Page props can't hold undefined.
    for (const key of Object.keys(profile))
        if (profile[key] === undefined) delete profile[key];
    return profile;
}

/**
 * An account by username, then by wallet address. `failed` says a lookup
 * could not be made: nobody was found, which is not the same as nobody
 * being there.
 */
export async function lookUpProfile(
    handle: unknown,
    byUsername: Lookup,
    byWalletId: Lookup
): Promise<{ profile: VisitedProfile | null; failed: boolean }> {
    if (typeof handle !== "string") return { profile: null, failed: false };
    const name = handle.replace(/^@/, "").trim();
    if (!name) return { profile: null, failed: false };
    let failed = false;
    const fail = () => {
        failed = true;
        return null;
    };
    const user =
        (await byUsername(name).catch(fail)) ??
        (await byWalletId(name.toLowerCase()).catch(fail));
    const profile = publicProfile(user);
    return { profile, failed: failed && !profile };
}

/** An account by username, then by wallet address; null when neither exists. */
export async function findProfile(
    handle: unknown,
    byUsername: Lookup,
    byWalletId: Lookup
): Promise<VisitedProfile | null> {
    return (await lookUpProfile(handle, byUsername, byWalletId)).profile;
}
