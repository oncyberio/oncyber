import { withDefaultTemplateTags } from "@utils/defaultTemplates";
import type { NextApiRequest, NextApiResponse } from "next";
import { getActiveDestinations } from "@utils/firestore/destinations";

/**
 * Public catalog of active destinations.
 *
 * This data is identical for every user but used to be fetched through the
 * authenticated getCreatedSpaces RPC (POST, uncacheable), re-reading the
 * whole active set from Firestore on every marketplace / templates /
 * create-space page view. Serving it over GET with Cache-Control lets the
 * CDN absorb the traffic: the Firestore query runs at most once per cache
 * window instead of once per view.
 *
 * The cache window is long (1h) and the URL is keyed by a `v` version (see
 * /api/destinations/active-version, bumped on any change to the active set),
 * so a publish busts the cache immediately while the full query otherwise
 * re-runs only a few times a day. The `v` param is consumed by the CDN only;
 * this handler ignores it.
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

    try {
        const destinations = (await getActiveDestinations()).map(
            withDefaultTemplateTags
        );

        // Fixed CORS header instead of the per-origin cors middleware —
        // the response must not vary per request for the CDN to cache it.
        // Safe here: public data, no auth, no cookies involved.
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader(
            "Cache-Control",
            "public, s-maxage=3600, stale-while-revalidate=86400"
        );

        return res.status(200).json({ success: true, destinations });
    } catch (err) {
        console.error("Failed to fetch active destinations", err);
        return res
            .status(500)
            .json({ success: false, error: "Failed to fetch destinations" });
    }
}
