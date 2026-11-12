import type { NextApiRequest, NextApiResponse } from "next";
import { canonicalAccountId } from "@utils/accountIdentity";
import { isContentHostRequest } from "@utils/contentHostOrigin";
import { requireAccount, sendApiError, ApiHttpError } from "@utils/apiAccount";
import { mintLobbyIdentity } from "../../../../multiplayer/src/identity/lobby";
import { lobbyRole } from "@utils/lobbyRoles";


/** Short-lived proof for lobby joins only; client-selected IDs are never accepted. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    res.setHeader("cache-control", "private, no-store");
    if (req.method !== "POST") { res.setHeader("allow", "POST"); return res.status(405).json({ error: "METHOD_NOT_ALLOWED" }); }
    if (!isContentHostRequest(req)) return res.status(403).json({ error: "HOST_ORIGIN_REQUIRED" });
    try {
        const { account } = await requireAccount(req);
        const uid = await canonicalAccountId(account.id);
        if (!process.env.LOBBY_IDENTITY_SECRET || process.env.LOBBY_IDENTITY_SECRET.length < 32) throw new ApiHttpError(503, { error: "LOBBY_IDENTITY_NOT_CONFIGURED" });
        return res.json(mintLobbyIdentity(uid, undefined, undefined, lobbyRole(account)));
    } catch (error) { return sendApiError(res, error); }
}
