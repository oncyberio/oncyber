import { corsMiddleware } from "../../../utils/middlewares/corsMiddleware";
import { getDestinationsByTag } from "@utils/firestore/destinations";

export default async (req, res) => {
    await corsMiddleware(req, res);

    try {
        const tag = req.query.activeTag;

        if (!tag) {
            return res.json({ success: false, error: "Missing activeTag" });
        }

        const data = await getDestinationsByTag(tag);

        res.json({
            success: true,
            data,
        });
    } catch (err) {
        res.json({
            success: false,
            error: err.message,
        });
    }
};
