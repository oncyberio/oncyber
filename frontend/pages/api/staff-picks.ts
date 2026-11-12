import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@utils/firebaseAdmin";
import {
    readStaffPickIds,
    setStaffPick,
    staffPickCurator,
} from "@utils/staffPicks";
import { defaultCategoryFor } from "@features/landing-carousel/data";

/**
 * GET: the staff pick count and which feed is the default.
 * POST {id, picked}: owner/admins add or remove a space.
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    res.setHeader("cache-control", "private, no-store");
    try {
        if (req.method === "GET") {
            const ids = await readStaffPickIds();
            return res.json({
                count: ids.length,
                defaultCategory: defaultCategoryFor(ids.length),
            });
        }
        if (req.method !== "POST") {
            res.setHeader("allow", "GET, POST");
            return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
        }
        // JSON only: a cross-site form can't send it without a CORS preflight.
        if (
            !String(req.headers["content-type"] || "").startsWith(
                "application/json"
            )
        )
            return res.status(415).json({ error: "JSON_REQUIRED" });
        const curator = await staffPickCurator(req);
        if (!curator) return res.status(403).json({ error: "ADMIN_REQUIRED" });
        const id =
            typeof req.body?.id === "string" ? req.body.id.slice(0, 200) : "";
        if (!id || typeof req.body?.picked !== "boolean")
            return res.status(400).json({ error: "INVALID_REQUEST" });
        if (req.body.picked) {
            const exhibit = await db.collection("exhibits").doc(id).get();
            if (!exhibit.exists)
                return res.status(404).json({ error: "NOT_FOUND" });
        }
        const ids = await setStaffPick(id, req.body.picked, curator);
        return res.json({
            staffPick: ids.includes(id),
            count: ids.length,
            defaultCategory: defaultCategoryFor(ids.length),
        });
    } catch (error) {
        console.error("staff-picks", error);
        return res.status(500).json({ error: "STAFF_PICKS_UNAVAILABLE" });
    }
}
