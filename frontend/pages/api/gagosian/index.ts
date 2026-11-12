import { db } from "@utils/firebaseAdmin";
import { ADMINS } from "../social/isMod";

export default async (req, res) => {
    if (!req.query.userId)
        return res.json({
            success: false,
        });

    if (ADMINS.includes(req.query.userId.toLowerCase())) {
        return res.json({
            success: true,
        });
    }

    const doc = await db
        .collection("exhibits")
        .doc("XC6LnZG5OzGV0oaAbuIt")
        .get();

    const exhibit = doc.data();

    return res.json({
        success: exhibit.editors.includes(req.query.userId.toLowerCase()),
    });
};
