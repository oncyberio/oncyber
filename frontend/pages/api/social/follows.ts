import type { NextApiRequest, NextApiResponse } from "next";
import { getAccountDoc } from "@api/accounts/authenticate/utils/link";
import { auth } from "@utils/middlewares/authMiddleware";
import { db } from "@utils/firebaseAdmin";
import { canonicalAccountId } from "@utils/accountIdentity";
import { DirectedFollows, visiblePresence } from "@utils/follows";
import { contactPolicy } from "@utils/socialPolicyServer";
import { isContentHostRequest } from "@utils/contentHostOrigin";
import { SOCIAL_COLLECTIONS } from "@utils/socialCollections";

const follows = new DirectedFollows(db, canonicalAccountId);
async function resolveTarget(input: string) {
    const canonical = await canonicalAccountId(input);
    const direct = await db.collection("users").doc(canonical).get();
    if (direct.exists) return direct.id;
    return (await getAccountDoc(input))?.id || null;
}
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    res.setHeader("cache-control", "private, no-store");
    if (!["GET", "POST"].includes(req.method)) { res.setHeader("allow", "GET, POST"); return res.status(405).json({ error: "METHOD_NOT_ALLOWED" }); }
    if (req.method === "POST" && !isContentHostRequest(req)) return res.status(403).json({ error: "HOST_ORIGIN_REQUIRED" });
    const uid = await auth(req).catch(() => null);
    if (!uid) return res.status(401).json({ error: "UNAUTHENTICATED" });
    try {
        const account = await getAccountDoc(uid);
        if (!account) return res.status(403).json({ error: "ACCOUNT_REQUIRED" });
        const ownerId = await canonicalAccountId(account.id);
        if (req.method === "GET" && typeof req.query.accountId === "string") {
            if (!req.query.accountId || req.query.accountId.includes("/")) return res.status(422).json({ error: "INVALID_ACCOUNT" });
            const targetId = await resolveTarget(req.query.accountId);
            if (!targetId) return res.status(404).json({ error: "ACCOUNT_NOT_FOUND" });
            const policy = (await contactPolicy(ownerId, [targetId])).get(targetId);
            return res.json({ accountId: targetId, following: !!policy?.allowed && (await follows.list(ownerId)).includes(targetId) });
        }
        if (req.method === "POST") {
            const target = req.body?.accountId;
            if (typeof target !== "string" || !target || target.includes("/") || typeof req.body?.following !== "boolean") return res.status(422).json({ error: "INVALID_FOLLOW" });
            const targetId = await resolveTarget(target);
            if (!targetId) return res.status(404).json({ error: "ACCOUNT_NOT_FOUND" });
            const targetDoc = await db.collection("users").doc(targetId).get();
            if (!targetDoc.exists) return res.status(404).json({ error: "ACCOUNT_NOT_FOUND" });
            if (req.body.following && !(await contactPolicy(ownerId, [targetId])).get(targetId)?.allowed) return res.status(403).json({ error: "CONTACT_UNAVAILABLE" });
            await follows.set(ownerId, targetId, req.body.following);
            return res.json({ ok: true, accountId: targetId, following: req.body.following });
        }
        const targets = await follows.list(ownerId);
        const policies = await contactPolicy(ownerId, targets);
        const rows = await Promise.all(targets.map(async (id) => {
            const policy = policies.get(id);
            if (!policy?.allowed) return null;
            const [profile, presence, preference] = await Promise.all([db.collection("users").doc(id).get(), db.collection(SOCIAL_COLLECTIONS.presence).doc(id).get(), db.collection("users").doc(id).collection(SOCIAL_COLLECTIONS.settings).doc("presence").get()]);
            if (!profile.exists) return null;
            const data = profile.data();
            const current = presence.data();
            const exhibit = current?.experienceId && current.expiresAt > Date.now() ? await db.collection("exhibits").doc(current.experienceId).get() : null;
            return { accountId: id, username: data.username || null, profileUrl: data.username ? `/@${encodeURIComponent(data.username)}` : null, name: data.username || data.walletCustomName || "Oncyber visitor", avatar: data.avatar || null, presence: policy.activityHidden || preference.data()?.visibility === "hidden" ? null : visiblePresence(current, exhibit?.data()) };
        }));
        return res.json({ following: rows.filter(Boolean) });
    } catch (error) {
        if (["SELF_FOLLOW", "FOLLOW_LIMIT"].includes(error.message)) return res.status(422).json({ error: error.message });
        return res.status(503).json({ error: "FOLLOWS_UNAVAILABLE" });
    }
}
