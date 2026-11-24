/**
 * Who is visiting, as the page tells a framed world in the contract's
 * `identity` message (docs/plans/framed-worlds.md, slice 2). Public
 * presentation only: a name, a portrait, an avatar. No account id and no
 * session ever cross; what needs the account stays in the page.
 */
import {
    readVisitorIdentity,
    type VisitorIdentity,
} from "@features/games/gameIdentity";
import type { TravelAvatar } from "@utils/travelAvatar";

export interface WorldVisitor extends VisitorIdentity {
    /** Not signed in: the world keeps its own guest name and portrait. */
    guest: boolean;
    /** The avatar choice the visitor arrives with. */
    avatar: TravelAvatar;
    /** The size the visitor saved for their avatar (0 to 1), if any. */
    avatarSize: number | null;
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
    savedAvatarSize?: unknown
) {
    return {
        ...presentation.identity,
        guest: !signedIn,
        avatarId: presentation.avatar?.id ?? "",
        avatarName: presentation.avatar?.name ?? "",
        avatarSize: signedIn ? size(savedAvatarSize) : null,
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
    };
}

/**
 * What the world's own account state holds for this visitor: the fields the
 * engine reads for a name, a portrait and an avatar size. Null for a guest,
 * who is the world's own guest.
 */
export function visitorUserData(visitor: WorldVisitor | null) {
    if (!visitor || visitor.guest) return null;
    return {
        username: visitor.name,
        avatar: visitor.pfp,
        ...(visitor.avatarSize == null
            ? {}
            : { settings: { default_vrm_scale: visitor.avatarSize } }),
    };
}
