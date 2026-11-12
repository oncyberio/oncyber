import type { NextApiRequest, NextApiResponse } from "next";
import { getExhibitById } from "../exhibit";
import { fetchUserByWalletId } from "@api/accounts/user/utils";
import { auth } from "@utils/middlewares/authMiddleware";
import { db } from "@utils/firebaseAdmin";
import { checkGating, checkGatingRules } from "@utils/checkGatingRules";
import { createWorldPasswordCheck } from "@utils/worldPassword/server";
import { attemptClientKey } from "@utils/worldPassword/attempts";
import {
    contentHostOrigin,
    isContentHostRequest,
} from "@utils/contentHostOrigin";
import {
    isEmbeddedRuntime,
    resolveEmbeddedRuntime,
} from "@features/content-host/runtime";

/** Resolve the current descriptor after admission; no host credentials leave here. */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    res.setHeader("cache-control", "private, no-store");
    if (req.method !== "POST") {
        res.setHeader("allow", "POST");
        return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    }
    if (!isContentHostRequest(req))
        return res.status(403).json({ error: "HOST_ORIGIN_REQUIRED" });
    const id = req.body?.experienceId;
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,160}$/.test(id))
        return res.status(400).json({ error: "INVALID_EXPERIENCE" });
    try {
        // A takedown must not depend on a cached descriptor or a version bump.
        const [admission] = await db.getAll(db.collection("exhibits").doc(id), {
            fieldMask: ["deleted"],
        });
        if (!admission?.exists || admission.data()?.deleted === true)
            return res.status(404).json({ error: "EXPERIENCE_NOT_FOUND" });
        const experience = await getExhibitById(id);
        if (!experience || !isEmbeddedRuntime(experience.runtime))
            return res.status(404).json({ error: "EXPERIENCE_NOT_FOUND" });
        const accountId = await auth(req).catch(() => null);
        const user = accountId
            ? await fetchUserByWalletId(accountId.toLowerCase())
            : null;
        let gate = await checkGating(experience, user, 0);
        // The password, or a world access proof from an earlier check, is
        // checked against the stored gating, never the cached descriptor.
        if (
            gate.type === "password-error" &&
            (typeof req.body?.password === "string" ||
                typeof req.body?.accessProof === "string")
        ) {
            const passwordCheck = createWorldPasswordCheck({
                exhibitId: id,
                password: req.body.password,
                proof: req.body.accessProof,
                client: attemptClientKey(req),
            });
            gate = await checkGatingRules(
                experience.gating,
                user,
                0,
                passwordCheck.check
            );
            if (gate.type === "password-error" && passwordCheck.limited)
                gate = { type: "too-many-attempts-error" };
        }
        if (gate.type !== "success")
            return res.status(403).json({ error: "GATED", gating: gate.type });
        const runtime = resolveEmbeddedRuntime(
            experience.runtime,
            contentHostOrigin(req),
            process.env.NODE_ENV === "development"
        );
        return res.status(200).json({ runtime });
    } catch {
        return res.status(503).json({ error: "CONTENT_UNAVAILABLE" });
    }
}

export const config = { api: { bodyParser: { sizeLimit: "10kb" } } };
