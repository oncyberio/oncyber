import {
    DEFAULT_LOBBY_AVATAR_URL,
    resolveLobbyAvatar,
    type LobbyAvatarIdentity,
} from "@features/lobby/avatarSelection";
import { LOBBY_GUEST_PORTRAIT } from "@features/lobby/lobbyIdentity";
import { readVisitorIdentity, type VisitorIdentity } from "./gameIdentity";

/** What the page reads from the account to present its visitor. */
export type VisitorAccount =
    | (LobbyAvatarIdentity & { username?: unknown; avatar?: unknown })
    | null
    | undefined;

export const GUEST_IDENTITY: VisitorIdentity = {
    avatarUrl: DEFAULT_LOBBY_AVATAR_URL,
    name: "Guest",
    pfp: LOBBY_GUEST_PORTRAIT,
};

/**
 * The visitor as their account presents them: the name, portrait and avatar
 * a framed game or world may show. Anything missing or unusable falls back
 * to the guest's, so what crosses into a frame is always whole.
 */
export async function accountIdentity(
    account: VisitorAccount
): Promise<VisitorIdentity> {
    const avatar = await resolveLobbyAvatar(account ?? undefined).catch(() => ({
        url: DEFAULT_LOBBY_AVATAR_URL,
    }));
    return (
        readVisitorIdentity({
            avatarUrl: avatar.url,
            name:
                typeof account?.username === "string" && account.username.trim()
                    ? account.username.slice(0, 120)
                    : GUEST_IDENTITY.name,
            pfp:
                typeof account?.avatar === "string" && account.avatar
                    ? account.avatar
                    : GUEST_IDENTITY.pfp,
        }) ?? GUEST_IDENTITY
    );
}
