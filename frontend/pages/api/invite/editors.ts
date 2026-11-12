import { getSpaceEditors } from "@api/accounts/user/utils";

import { corsMiddleware } from "@utils/middlewares/corsMiddleware";

export default async (req, res) => {
    try {
        await corsMiddleware(req, res);

        if (!req.query.exhibitId) {
            return res.json({
                success: false,
                message: "Space required.",
            });
        }

        const editors = await getSpaceEditors(req.query.exhibitId);

        if (editors) {
            return res.json({
                success: true,
                editors,
            });
        }

        return res.status(404).json({
            success: false,
            message: "Exhibit doesn't exist.",
        });
    } catch (err) {
        console.log("err", err);

        res.json({
            success: false,
        });
    }
};
