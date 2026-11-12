import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@utils/firebaseAdmin";
import { auth } from "@utils/middlewares/authMiddleware";
import {
    contentHostOrigin,
    isContentHostRequest,
} from "@utils/contentHostOrigin";
import { resolveEmbeddedRuntime } from "@features/content-host/runtime";

/** Editors can attach an external runtime to an existing space; galleries remain the default. */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    res.setHeader("cache-control", "private, no-store");
    if (req.method !== "POST") {
        res.setHeader("allow", "POST");
        return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    }
    // Cookie-authenticated writes must originate in the Oncyber host. Requests
    // from opaque frames have Origin:null and are never accepted.
    if (!isContentHostRequest(req))
        return res.status(403).json({ error: "HOST_ORIGIN_REQUIRED" });
    const origin = contentHostOrigin(req);
    const accountId = await auth(req).catch(() => null);
    if (!accountId) return res.status(401).json({ error: "UNAUTHENTICATED" });
    const id = req.body?.experienceId;
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,160}$/.test(id))
        return res.status(400).json({ error: "INVALID_EXPERIENCE" });
    let runtime;
    try {
        runtime =
            req.body?.runtime?.kind === "cyber"
                ? { kind: "cyber" }
                : resolveEmbeddedRuntime(
                      req.body?.runtime,
                      origin,
                      process.env.NODE_ENV === "development"
                  );
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
    try {
        const ref = db.collection("exhibits").doc(id);
        const result = await db.runTransaction(async (transaction) => {
            const document = await transaction.get(ref);
            if (!document.exists) return "EXPERIENCE_NOT_FOUND";
            const experience = document.data();
            if (experience.deleted === true) return "EXPERIENCE_NOT_FOUND";
            if (
                ![experience.owner, ...(experience.editors || [])].some(
                    (editor) =>
                        typeof editor === "string" &&
                        editor.toLowerCase() === accountId.toLowerCase()
                )
            )
                return "EDITOR_REQUIRED";
            transaction.update(ref, { runtime, lastUpdatedAt: Date.now() });
            return null;
        });
        if (result)
            return res
                .status(result === "EXPERIENCE_NOT_FOUND" ? 404 : 403)
                .json({ error: result });
        return res.status(200).json({ runtime });
    } catch {
        return res.status(503).json({ error: "CONTENT_UNAVAILABLE" });
    }
}

export const config = { api: { bodyParser: { sizeLimit: "10kb" } } };
