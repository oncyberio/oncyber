import type { NextApiRequest, NextApiResponse } from "next";
import { nodeEnv } from "@env";
import { OPENSEA_ALLOWED_PATH } from "@utils/openSeaFetch";

/**
 * Read-only proxy for the OpenSea v2 endpoints the client uses (owned NFTs,
 * single NFTs, collections), so the API key never reaches the browser.
 */
export default async function openSea(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).end();
    }
    const path = req.query.path;
    if (typeof path !== "string" || !OPENSEA_ALLOWED_PATH.test(path))
        return res.status(400).json({ error: "Unsupported OpenSea request" });
    if (!nodeEnv.OPENSEA_X_API_KEY)
        return res.status(503).json({ error: "OpenSea is not configured" });
    try {
        const upstream = await fetch(`https://api.opensea.io/api/v2/${path}`, {
            headers: {
                "X-API-KEY": nodeEnv.OPENSEA_X_API_KEY,
                Accept: "application/json",
            },
        });
        const body = await upstream.text();
        res.status(upstream.status);
        res.setHeader("Content-Type", "application/json");
        if (upstream.ok) res.setHeader("Cache-Control", "private, max-age=30");
        return res.send(body);
    } catch {
        return res.status(502).json({ error: "OpenSea unavailable" });
    }
}
