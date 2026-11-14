import type { NextApiRequest, NextApiResponse } from "next";

const TOKEN_URL = "https://auth.openai.com/api/accounts/oauth/token";
const RESOURCE = "https://api.openai.com/v1";
const CALLBACK_PATH = "/contribute/chatgpt-callback";

/**
 * Exchanges a Sign in with ChatGPT code (or refresh token) for the visitor.
 * It only forwards to OpenAI's token endpoint: nothing is stored or logged,
 * and the tokens go back to the browser that asked.
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") return res.status(405).end();
    const clientId = process.env.NEXT_PUBLIC_CHATGPT_CLIENT_ID;
    if (!clientId)
        return res
            .status(404)
            .json({ error: "chatgpt_sign_in_not_configured" });

    // Same-origin only: the browser that ran the sign-in.
    const origin = req.headers.origin;
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    if (!origin || new URL(origin).host !== host)
        return res.status(403).json({ error: "forbidden" });

    const body = req.body || {};
    const form = new URLSearchParams({
        client_id: clientId,
        resource: RESOURCE,
    });
    if (
        body.grant_type === "authorization_code" &&
        typeof body.code === "string" &&
        typeof body.code_verifier === "string"
    ) {
        form.set("grant_type", "authorization_code");
        form.set("code", body.code);
        form.set("code_verifier", body.code_verifier);
        form.set("redirect_uri", origin + CALLBACK_PATH);
    } else if (
        body.grant_type === "refresh_token" &&
        typeof body.refresh_token === "string"
    ) {
        form.set("grant_type", "refresh_token");
        form.set("refresh_token", body.refresh_token);
    } else return res.status(400).json({ error: "invalid_request" });

    const headers: Record<string, string> = {
        "Content-Type": "application/x-www-form-urlencoded",
    };
    // A confidential client authenticates with its secret in the header.
    const secret = process.env.CHATGPT_CLIENT_SECRET;
    if (secret)
        headers.Authorization = `Basic ${Buffer.from(
            `${encodeURIComponent(clientId)}:${encodeURIComponent(secret)}`
        ).toString("base64")}`;

    try {
        const response = await fetch(TOKEN_URL, {
            method: "POST",
            headers,
            body: form,
        });
        const data = await response.json().catch(() => ({}));
        const {
            access_token,
            refresh_token,
            expires_in,
            error,
            error_description,
        } = data;
        return res
            .status(response.status)
            .json(
                response.ok
                    ? { access_token, refresh_token, expires_in }
                    : { error, error_description }
            );
    } catch {
        return res.status(502).json({ error: "openai_unreachable" });
    }
}
