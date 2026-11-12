import type { NextApiRequest, NextApiResponse } from "next";
import { auth } from "@utils/middlewares/authMiddleware";
import { getAccountDoc } from "@api/accounts/authenticate/utils/link";
import { db } from "@utils/firebaseAdmin";
import { canonicalAccountId } from "@utils/accountIdentity";
import { syncPresencePrivacy } from "@utils/socialPolicyServer";
import { isContentHostRequest } from "@utils/contentHostOrigin";
import { SOCIAL_COLLECTIONS } from "@utils/socialCollections";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    res.setHeader("cache-control", "private, no-store");
    if (!["GET", "PUT"].includes(req.method)) { res.setHeader("allow", "GET, PUT"); return res.status(405).json({ error: "METHOD_NOT_ALLOWED" }); }
    if (req.method === "PUT" && !isContentHostRequest(req)) return res.status(403).json({ error: "HOST_ORIGIN_REQUIRED" });
    const uid = await auth(req).catch(() => null);
    if (!uid) return res.status(401).json({ error: "UNAUTHENTICATED" });
    try {
        const account = await getAccountDoc(uid);
        if (!account) return res.status(403).json({ error: "ACCOUNT_REQUIRED" });
        const accountId = await canonicalAccountId(account.id);
        const ref = db.collection("users").doc(accountId).collection(SOCIAL_COLLECTIONS.settings).doc("presence");
        if (req.method === "GET") {
            const setting = await ref.get();
            return res.json({ visibility: setting.data()?.visibility === "hidden" ? "hidden" : "public" });
        }
        const visibility = req.body?.visibility;
        if (!["hidden", "public"].includes(visibility)) return res.status(422).json({ error: "INVALID_VISIBILITY" });
        await syncPresencePrivacy(accountId, visibility);
        const batch = db.batch();
        batch.set(ref, { visibility });
        if (visibility === "hidden") batch.delete(db.collection(SOCIAL_COLLECTIONS.presence).doc(accountId));
        await batch.commit();
        return res.json({ visibility });
    } catch { return res.status(503).json({ error: "PREFERENCES_UNAVAILABLE" }); }
}
