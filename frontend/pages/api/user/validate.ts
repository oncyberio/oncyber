import { auth } from "../../../utils/middlewares/authMiddleware";
import { corsMiddleware } from "../../../utils/middlewares/corsMiddleware";

export default async (req, res) => {
    await corsMiddleware(req, res);

    try {
        var userId = await auth(req);
        console.log(userId);

        res.json({ success: true, userId });
    } catch (err) {
        console.log(err);

        res.json({ success: false, error: "user not valid." });
    }
};
