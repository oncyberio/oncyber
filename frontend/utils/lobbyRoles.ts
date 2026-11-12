import type { LobbyRole } from "../../multiplayer/src/identity/lobby";
const list = (value: string) => value.split(",").map((id) => id.trim().toLowerCase()).filter(Boolean);
/** Owners come from LOBBY_OWNERS and admins from LOBBY_ADMINS (comma-separated wallet addresses or account IDs). */
export function lobbyRole(account: { id: string; data?(): any }, admins = process.env.LOBBY_ADMINS || "", owners = process.env.LOBBY_OWNERS || ""): LobbyRole | undefined {
    const data = account.data?.() || {};
    const ids = [account.id, data.walletId, ...(Array.isArray(data.linkedAccounts) ? data.linkedAccounts : [])]
        .filter((id): id is string => typeof id === "string" && !!id)
        .map((id) => id.toLowerCase());
    if (ids.some((id) => list(owners).includes(id))) return "owner";
    const listed = list(admins);
    if (ids.some((id) => listed.includes(id))) return "admin";
}
