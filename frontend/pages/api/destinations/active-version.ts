import type { NextApiRequest, NextApiResponse } from "next";
import { getActiveCatalogVersion } from "@utils/firestore/destinations";

/**
 * Version token for the active-destinations catalog. The client fetches this
 * (cheap: one doc read, briefly CDN-cached) and uses it to key the long-cached
 * /api/destinations/active request. A publish bumps the version, so the next
 * catalog fetch hits a new URL and gets a fresh copy immediately — without
 * shortening the catalog's own (expensive) cache window.
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") {
        return res
            .status(405)
            .json({ success: false, error: "Method not allowed" });
    }

    const v = await getActiveCatalogVersion();

    // Fixed CORS + short cache so the CDN absorbs the polling but a bump still
    // propagates within seconds.
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Cache-Control",
        "public, s-maxage=30, stale-while-revalidate=60"
    );

    return res.status(200).json({ v });
}
