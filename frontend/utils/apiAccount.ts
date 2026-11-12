import type { NextApiRequest, NextApiResponse } from "next";
import { auth } from "@utils/middlewares/authMiddleware";
import { getAccountDoc } from "@api/accounts/authenticate/utils/link";

/** An API failure with a status and a JSON body that is safe to return. */
export class ApiHttpError extends Error {
    constructor(public status: number, public body: any) {
        super(body?.error || "SERVICE_UNAVAILABLE");
    }
}

/** Reject cross-site writes: a browser Origin must match this host. */
export function checkSameOrigin(req: NextApiRequest) {
    if (!req.headers.origin || req.method === "GET") return;
    let origin: URL;
    try {
        origin = new URL(req.headers.origin);
    } catch {
        throw new ApiHttpError(403, { error: "FORBIDDEN_ORIGIN" });
    }
    const host = req.headers.host;
    if (origin.host !== host)
        throw new ApiHttpError(403, { error: "FORBIDDEN_ORIGIN" });
}

/** The signed-in account for this request, or a 401/403 error. */
export async function requireAccount(req: NextApiRequest) {
    let uid: string;
    try {
        uid = await auth(req);
    } catch {
        throw new ApiHttpError(401, { error: "SIGN_IN_REQUIRED" });
    }
    const account = await getAccountDoc(uid);
    if (!account) throw new ApiHttpError(403, { error: "ACCOUNT_REQUIRED" });
    return { uid, account };
}

export function sendApiError(res: NextApiResponse, error: any) {
    if (error instanceof ApiHttpError)
        return res.status(error.status).json(error.body);
    console.error(
        "API request failed",
        error instanceof Error ? error.message : "unknown error"
    );
    return res.status(502).json({ error: "SERVICE_UNAVAILABLE" });
}
