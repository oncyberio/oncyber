/** The public presentation fields a game may see about its visitor. */
export interface VisitorIdentity {
    avatarUrl: string;
    name: string;
    pfp: string;
}

/** Only public presentation fields cross into the local game. */
export function readVisitorIdentity(value: unknown): VisitorIdentity | null {
    const identity = value as VisitorIdentity;
    const asset = (url: unknown) => {
        if (typeof url !== "string" || url.length > 2048) return false;
        if (url.startsWith("/") && !url.startsWith("//")) return true;
        try {
            const parsed = new URL(url);
            return (
                /^https?:$/.test(parsed.protocol) &&
                !parsed.username &&
                !parsed.password
            );
        } catch {
            return false;
        }
    };
    if (
        !identity ||
        !asset(identity.avatarUrl) ||
        typeof identity.name !== "string" ||
        !identity.name.trim() ||
        identity.name.length > 120 ||
        !asset(identity.pfp)
    )
        return null;
    return {
        avatarUrl: identity.avatarUrl,
        name: identity.name,
        pfp: identity.pfp,
    };
}
