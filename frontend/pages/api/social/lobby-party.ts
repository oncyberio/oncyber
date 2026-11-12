import type { NextApiRequest, NextApiResponse } from "next";
import { canonicalAccountId } from "@utils/accountIdentity";
import { requireAccount, sendApiError } from "@utils/apiAccount";
import { partyService } from "@utils/partiesServer";
import { lobbyPartyIdentity } from "../../../../multiplayer/src/identity/lobby";

/** Presentation membership only: no raw account IDs or graph leave this endpoint. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    res.setHeader("cache-control", "private, no-store");
    if (req.method !== "GET") { res.setHeader("allow", "GET"); return res.status(405).json({ error: "METHOD_NOT_ALLOWED" }); }
    try {
        const { account } = await requireAccount(req);
        const uid = await canonicalAccountId(account.id);
        const result = await partyService("read", { actor: { uid } });
        const party = result.party;
        if (!party) return res.json({ memberIds: [], isLeader: false });
        const self = lobbyPartyIdentity(uid);
        return res.json({
            partyId: party.id,
            isLeader: party.leaderId === uid,
            identityAvailable: !!self,
            selfIdentity: self,
            memberIds: self ? party.members.slice(0, 8).map(member => lobbyPartyIdentity(member.id)).filter(Boolean) : [],
            ...(party.destination ? { destination: {
                experienceId: party.destination.experienceId,
                url: `/s@${encodeURIComponent(party.destination.experienceId)}`,
                instanceId: party.destination.instanceId,
                revision: party.destination.revision,
                unavailableAt: party.destination.unavailableAt,
            } } : {}),
        });
    } catch (error) { return sendApiError(res, error); }
}
