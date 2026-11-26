/**
 * Who is visiting, as the page tells a framed world in the contract's
 * `identity` message (docs/plans/framed-worlds.md, slices 2 and 4). A
 * name, a portrait and an avatar; for a signed-in visitor, who they are
 * and the settings the in-world interface shows or applies. No session
 * ever crosses: what needs one is asked of the page (./accountRelay).
 */
import {
    readVisitorIdentity,
    type VisitorIdentity,
} from "@features/frame/gameIdentity";
import type { TravelAvatar } from "@utils/travelAvatar";
import { isGuestId } from "@utils/guestIdentity";

export interface WorldVisitor extends VisitorIdentity {
    /** Not signed in: the world keeps its own guest portrait. */
    guest: boolean;
    /**
     * A guest's id on the page (utils/guestIdentity): the world takes it,
     * so a guest has one name in the lobby, here and in the room.
     */
    guestId?: string;
    /** The avatar choice the visitor arrives with. */
    avatar: TravelAvatar;
    /** The size the visitor saved for their avatar (0 to 1), if any. */
    avatarSize: number | null;
    /**
     * A signed-in visitor's account, as the in-world interface reads it:
     * who they are and their settings. No session: what needs one is asked
     * of the page (./accountRelay).
     */
    account: WorldAccount | null;
    /**
     * Whether this visitor is let into the space, as the page worked it
     * out with their account. Undefined when the page did not say.
     */
    gate?: { type: string };
}

export interface WorldAccount {
    id: string;
    username: string;
    /** The rest of what the in-world interface shows or applies. */
    profile: Record<string, unknown>;
}

// What of an account a world is given. Not here: linked wallets, email,
// anything private, anything that is not shown or applied in a world.
const PROFILE = [
    "avatar",
    "walletId",
    "walletCustomName",
    "avatarContractAddress",
    "avatarTokenId",
    "settings",
] as const;

/** A plain copy of what a world may know of an account, or null. */
function readAccount(value: any): WorldAccount | null {
    if (
        typeof value?.id !== "string" ||
        !value.id ||
        value.id.length > 200 ||
        typeof value.username !== "string"
    )
        return null;
    let profile: Record<string, unknown> = {};
    try {
        const copy = JSON.stringify(value.profile ?? {});
        if (copy.length > 20_000) return null;
        const parsed = JSON.parse(copy);
        for (const key of PROFILE)
            if (parsed?.[key] !== undefined) profile[key] = parsed[key];
    } catch {
        profile = {};
    }
    return { id: value.id, username: value.username.slice(0, 120), profile };
}

/** The page's side: what of its visitor's account a world is given. */
export function worldAccount(id: unknown, userData: any): WorldAccount | null {
    return readAccount({
        id,
        username: userData?.username ?? "",
        profile: userData,
    });
}

const text = (value: unknown, max: number) =>
    typeof value === "string" && value && value.length <= max ? value : "";

const size = (value: unknown) =>
    typeof value === "number" && value > 0 && value <= 1 ? value : null;

/** The page's side: the `identity` message for this visitor. */
export function worldVisitorMessage(
    signedIn: boolean,
    presentation: {
        identity: VisitorIdentity;
        avatar: { id: string; name: string } | null;
    },
    savedAvatarSize?: unknown,
    more: {
        account?: WorldAccount | null;
        gate?: unknown;
        guestId?: string;
    } = {}
) {
    return {
        ...presentation.identity,
        guest: !signedIn,
        avatarId: presentation.avatar?.id ?? "",
        avatarName: presentation.avatar?.name ?? "",
        avatarSize: signedIn ? size(savedAvatarSize) : null,
        account: signedIn ? more.account ?? null : null,
        ...(!signedIn && more.guestId ? { guestId: more.guestId } : {}),
        ...(more.gate ? { gate: more.gate } : {}),
    };
}

/** The world's side: the visitor in a message, or null when it names none. */
export function readWorldVisitor(message: any): WorldVisitor | null {
    const identity = readVisitorIdentity(message);
    if (!identity) return null;
    return {
        ...identity,
        guest: message.guest !== false,
        avatar: {
            id: text(message.avatarId, 200) || identity.avatarUrl,
            name: text(message.avatarName, 120) || "Avatar",
            url: identity.avatarUrl,
        },
        avatarSize: size(message.avatarSize),
        account: message.guest === false ? readAccount(message.account) : null,
        ...(message.guest !== false && isGuestId(message.guestId)
            ? { guestId: text(message.guestId, 80) }
            : {}),
        ...(typeof message.gate?.type === "string" &&
        message.gate.type.length <= 40
            ? { gate: { type: message.gate.type } }
            : {}),
    };
}

/**
 * What the world's own account state holds for this visitor: the fields the
 * engine and the in-world interface read. Null for a guest, who is the
 * world's own guest.
 */
export function visitorUserData(visitor: WorldVisitor | null) {
    if (!visitor || visitor.guest) return null;
    const profile = visitor.account?.profile ?? {};
    const settings = {
        ...((profile.settings as object) ?? {}),
        ...(visitor.avatarSize == null
            ? {}
            : { default_vrm_scale: visitor.avatarSize }),
    };
    // The account's own picture, or none: a world gives a visitor without
    // one its own default, as it does unframed. (Before accounts crossed,
    // the picture the page presents was all there was.)
    const picture = visitor.account ? profile.avatar : visitor.pfp;
    return {
        ...profile,
        username: visitor.name,
        avatar:
            typeof picture === "string" &&
            /^(https:\/\/|\/(?!\/))/.test(picture) &&
            picture.length <= 2048
                ? picture
                : undefined,
        ...(Object.keys(settings).length ? { settings } : {}),
    };
}
