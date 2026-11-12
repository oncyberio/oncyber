import { db } from "@utils/firebaseAdmin";

import { corsMiddleware } from "@utils/middlewares/corsMiddleware";
import { auth } from "@utils/middlewares/authMiddleware";
import { canEditExhibit } from "@utils/firestore/exhibitEditors";

export default async (req, res) => {
    try {
        await corsMiddleware(req, res);

        // The invite id makes whoever opens it a co-curator, so only the
        // space's own owner and editors may read it (generate.ts is
        // owner-only).
        const userId = await auth(req).catch(() => null);
        if (!(await canEditExhibit(req.query.exhibitId, userId))) {
            return res.status(403).json({
                success: false,
                message: "Only the space's editors can see its invite link.",
            });
        }

        const inviteDoc = await db
            .collection("invites")
            .where("exhibitId", "==", req.query.exhibitId)
            .get();

        if (inviteDoc.empty) {
            return res.json({
                success: false,
                message: "No invite link found. please generate a new one.",
            });
        }

        return res.json({
            success: true,
            inviteId: inviteDoc.docs[0].id,
        });
    } catch (err) {
        return res.json({
            success: false,
        });
    }
};
