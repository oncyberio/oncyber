import type { NextApiRequest, NextApiResponse } from "next";
import { getActiveDestinations } from "@utils/firestore/destinations";
import { destinationPreviews } from "@utils/destinationPreviews";

/** Lightweight public image index backed by the existing cached catalog. */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") return res.status(405).json({ success: false });
    try {
        const previews = destinationPreviews(await getActiveDestinations());
        res.setHeader(
            "Cache-Control",
            "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
        );
        return res.status(200).json({ success: true, previews });
    } catch {
        return res.status(503).json({ success: false });
    }
}
