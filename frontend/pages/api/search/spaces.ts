import type { NextApiRequest, NextApiResponse } from "next";
import { parseFilters } from "@features/landing-carousel/data";
import { searchSpaces } from "@utils/firestore/spaceSearch";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).json({ success: false });
    }
    if (
        ["q", "owner", "chain", "collection", "category", "cursor"].some(
            (key) =>
                req.query[key] !== undefined &&
                typeof req.query[key] !== "string"
        )
    )
        return res
            .status(400)
            .json({ success: false, message: "Invalid search parameters" });
    const filters = parseFilters(req.query);
    if (
        filters.q.trim().length < 2 &&
        !filters.owner &&
        !filters.chain &&
        !filters.collection
    )
        return res
            .status(200)
            .json({ success: true, exhibits: [], cursor: "", hasMore: false });
    try {
        const result = await searchSpaces(
            filters,
            (req.query.cursor as string) || ""
        );
        res.setHeader("Cache-Control", "private, no-store");
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        const invalid = error.message === "Invalid search cursor";
        if (!invalid) console.error("Space search failed", error);
        return res
            .status(invalid ? 400 : 503)
            .json({
                success: false,
                message: invalid
                    ? error.message
                    : "Search is temporarily unavailable. Please try again.",
            });
    }
}
