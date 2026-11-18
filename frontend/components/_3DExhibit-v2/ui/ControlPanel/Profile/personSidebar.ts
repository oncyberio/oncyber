/** A visitor picked from the people list, the chat or a name tag. */
export interface SelectedVisitor {
    userId?: string;
    userData?: { walletId?: string; username?: string; avatar?: string };
}

export interface WorldVisitor {
    userId?: string;
    sessionId?: string;
    userData?: { username?: string };
}

const WALLET = /^0x[0-9a-f]{40}$/i;

/**
 * What the person sidebar opens on. Usernames read better in the title; a
 * wallet stands in when the visitor has none. Null when there is nobody.
 */
export function visitorProfile(visitor: SelectedVisitor | null | undefined) {
    const data = visitor?.userData || {};
    const wallet = data.walletId || "";
    const username =
        data.username && data.username !== wallet ? data.username : "";
    const id = username || wallet;
    if (!id) return null;
    return {
        id,
        name: username
            ? `@${username}`
            : WALLET.test(wallet)
            ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}`
            : wallet,
        avatar: data.avatar || undefined,
    };
}

/**
 * The visitor's live session in this world, if they are here and not the
 * viewer. Teleport is only offered when this finds someone.
 */
export function visitorInWorld(
    visitor: SelectedVisitor | null | undefined,
    present: WorldVisitor[],
    viewerId?: string
): WorldVisitor | null {
    if (!visitor?.userId || visitor.userId === viewerId) return null;
    return (
        present.find(
            (item) => item?.userId === visitor.userId && item.sessionId
        ) || null
    );
}
