import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@utils/firebaseAdmin";
import {
    scriptsSavedMark,
    worldScriptsEnabled,
} from "@utils/worldScripts/server";

/**
 * When a space's script was last saved, and how that save lands in spaces
 * that are open (features/world-scripts/livePickup.ts).
 *
 * A space that is open asks this every few seconds. It is how a visitor
 * who is not signed in follows a save: the live feed that carries the
 * notice of one refuses them. So it is made to be asked a great deal: a
 * GET, with nothing of the visitor in it, that the CDN answers from one
 * copy for a few seconds; and it reads two numbers, not the document.
 * The script itself is `worldScripts.current`, read only when this says
 * there is something newer.
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET")
        return res.status(405).json({ error: "Method not allowed" });
    const space = String(req.query.space || "");
    if (!worldScriptsEnabled() || !/^[a-zA-Z0-9_-]{1,160}$/.test(space))
        return res.status(404).json({ error: "Not found" });

    const [document] = await db.getAll(db.collection("exhibits").doc(space), {
        fieldMask: ["worldScriptsSavedAt", "worldScriptsLanding", "deleted"],
    });
    const saved = document?.exists ? document.data() : null;

    // The same answer for everyone, so the CDN keeps one copy. A save is
    // seen within the few seconds this is held, plus the asker's own wait.
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Cache-Control",
        "public, s-maxage=4, stale-while-revalidate=8"
    );
    return res.status(200).json({
        savedAt: saved && saved.deleted !== true ? scriptsSavedMark(saved) : 0,
        landing: saved?.worldScriptsLanding === "rewind" ? "rewind" : "add",
    });
}
