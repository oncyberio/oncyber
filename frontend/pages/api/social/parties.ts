import type { NextApiRequest, NextApiResponse } from "next";
import { isContentHostRequest } from "@utils/contentHostOrigin";
import { db } from "@utils/firebaseAdmin";
import { getAccountDoc } from "@api/accounts/authenticate/utils/link";
import { canonicalAccountId } from "@utils/accountIdentity";
import { ApiHttpError, checkSameOrigin, requireAccount, sendApiError } from "@utils/apiAccount";
import { partyService, partyView } from "@utils/partiesServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    res.setHeader("cache-control", "private, no-store");
    if (!["GET", "POST"].includes(req.method)) { res.setHeader("allow", "GET, POST"); return res.status(405).json({ error: "METHOD_NOT_ALLOWED" }); }
    try {
        checkSameOrigin(req);
        if (req.method === "POST" && !isContentHostRequest(req)) return res.status(403).json({ error: "HOST_ORIGIN_REQUIRED" });
        const { account } = await requireAccount(req);
        const actor = { uid: await canonicalAccountId(account.id), name: account.data()?.username || account.data()?.walletCustomName || "Member" };
        if (req.method === "GET") return res.json(partyView(await partyService("read", { actor }), actor.uid));
        const body = req.body || {}; let result;
        if (body.action === "create") result = await partyService("create", { actor, requestId: body.requestId });
        else if (body.action === "invite") {
            if (typeof body.toId !== "string" || !body.toId.trim() || body.toId.length > 512 || body.toId.includes("/")) throw new ApiHttpError(422, { error: "INVALID_INVITEE" });
            const lookup = body.toId.trim();
            let target = await db.collection("users").doc(lookup).get();
            if (!target.exists) target = await getAccountDoc(lookup.replace(/^@/, ""), undefined, lookup.startsWith("@") ? "username" : "walletId");
            if (!target?.exists) throw new ApiHttpError(404, { error: "ACCOUNT_NOT_FOUND" });
            result = await partyService("invite", { actor, toId: await canonicalAccountId(target.id) });
        } else if (body.action === "respond") result = await partyService("respond", { actor, invitationId: body.invitationId, accept: body.accept });
        else if (body.action === "leave") result = await partyService("leave", { actor });
        else if (body.action === "member-state") result = await partyService("member-state", { actor, instanceId: body.instanceId, state: body.state, reason: body.reason });
        // No published destination type supports reserving seats for a whole
        // party yet. Refuse before the party service creates a receipt.
        else if (body.action === "move") throw new ApiHttpError(409, { error: "PARTY_DESTINATION_UNSUPPORTED" });
        else throw new ApiHttpError(422, { error: "UNKNOWN_PARTY_ACTION" });
        return res.json(partyView(result, actor.uid));
    } catch (error) { return sendApiError(res, error); }
}
