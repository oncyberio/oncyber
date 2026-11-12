import type { NextApiRequest, NextApiResponse } from "next";
import { getExhibitAccessByCustomLink } from "@utils/firestore/exhibitAccess";
import {
    hasWorldPassword,
    publicGating,
} from "@utils/worldPassword/publicGating";

/**
 * Whether entering a world needs its password, for the multiplayer server's
 * room join (multiplayer/src/identity/worldAccess.ts): the world's id and its
 * password revision, which a world access proof must name. Reveals nothing
 * the exhibit read does not.
 *
 * GET /api/world-access?space=<room label: custom link or s@id>
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    res.setHeader("cache-control", "private, no-store");
    if (req.method !== "GET") {
        res.setHeader("allow", "GET");
        return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    }
    const space = req.query.space;
    if (
        typeof space !== "string" ||
        !space ||
        space.length > 200 ||
        space.includes("/")
    )
        return res.status(400).json({ error: "INVALID_SPACE" });
    try {
        const access = await getExhibitAccessByCustomLink(space);
        if (!access) return res.status(200).json({ exists: false });
        const password = hasWorldPassword(access.gating);
        return res.status(200).json({
            exists: true,
            id: access.id,
            password,
            rev: password ? publicGating(access.gating).password.rev : null,
        });
    } catch {
        return res.status(503).json({ error: "ACCESS_UNAVAILABLE" });
    }
}
