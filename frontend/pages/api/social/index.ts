import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@utils/firebaseAdmin";
import { getAccountDoc } from "@api/accounts/authenticate/utils/link";
import { auth } from "@utils/middlewares/authMiddleware";
import { canonicalAccountId } from "@utils/accountIdentity";
import { isContentHostRequest } from "@utils/contentHostOrigin";
import { socialServiceUrl, socialServiceHeaders } from "@utils/socialService";
import { SOCIAL_COLLECTIONS } from "@utils/socialCollections";

const operations = new Set(["snapshot", "relationships", "code", "add", "request", "requests", "accept", "decline", "cancel", "remove", "list", "block", "unblock", "blocked", "privacy"]);

/** Canonical account identities and service credentials never come from the frame. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    res.setHeader("cache-control", "private, no-store");
    if (req.method !== "POST") {
        res.setHeader("allow", "POST");
        return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    }
    if (!isContentHostRequest(req)) return res.status(403).json({ error: "HOST_ORIGIN_REQUIRED" });
    if (!operations.has(req.body?.operation)) return res.status(400).json({ error: "INVALID_OPERATION" });
    const subject = await auth(req).catch(() => null);
    if (!subject) return res.status(401).json({ error: "UNAUTHENTICATED" });
    try {
        const account = await getAccountDoc(subject);
        if (!account) return res.status(403).json({ error: "ACCOUNT_REQUIRED" });
        if (!process.env.SOCIAL_SERVICE_SECRET) return res.status(503).json({ error: "SOCIAL_NOT_CONFIGURED" });
        const uid = await canonicalAccountId(account.id);
        const body = req.body || {};
        const input: Record<string, unknown> = {};
        if (typeof body.uid === "string" && body.uid && body.uid.length <= 512 && !body.uid.includes("/")) input.uid = await canonicalAccountId(body.uid);
        if (typeof body.code === "string") input.code = body.code.slice(0, 40);
        if (body.operation === "relationships") {
            if (typeof body.worldId !== "string" || !body.worldId || body.worldId.length > 128 || !Array.isArray(body.playerIds) || body.playerIds.length > 100 || body.playerIds.some(id => typeof id !== "string" || !id || id.length > 128)) return res.status(400).json({ error: "INVALID_SCOPE" });
            input.worldId = body.worldId;
            input.playerIds = [...new Set(body.playerIds)];
        }
        for (const key of ["presence", "activity", "friendRequests"]) if (typeof body[key] === "string") input[key] = body[key];
        const upstream = await fetch(socialServiceUrl("/internal/oncyber/social"), {
            method: "POST", headers: socialServiceHeaders(), signal: AbortSignal.timeout(8000),
            body: JSON.stringify({
                identity: { uid, name: account.data()?.username || account.data()?.walletCustomName || "Oncyber visitor" },
                operation: `/friends/${body.operation}`, input,
            }),
        });
        const result = await upstream.json();
        if (upstream.ok && body.operation === "privacy" && result.privacy) {
            const hidden = result.privacy.presence === "nobody" || result.privacy.activity === "nobody";
            await db.collection("users").doc(uid).collection(SOCIAL_COLLECTIONS.settings).doc("presence").set({ visibility: hidden ? "hidden" : "public" }, { merge: true });
            if (hidden) await db.collection(SOCIAL_COLLECTIONS.presence).doc(uid).delete();
        }
        return res.status(upstream.status).json(result);
    } catch {
        return res.status(503).json({ error: "SOCIAL_UNAVAILABLE" });
    }
}
export const config = { api: { bodyParser: { sizeLimit: "8kb" } } };
