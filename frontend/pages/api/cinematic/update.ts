import { db } from "@utils/firebaseAdmin";
import { auth } from "@utils/middlewares/authMiddleware";
import { formatCinematic } from "@utils/formatCinematic";
import { corsMiddleware } from "@utils/middlewares/corsMiddleware";
import { getDestination } from "@utils/saveToDb";

export default async (req, res) => {
    try {
        await corsMiddleware(req, res);

        const userId = await auth(req);

        if (req.method === "OPTIONS") {
            return res.status(200).end();
        }
        if (req.body && typeof req.body === "string") {
            req.body = JSON.parse(req.body);
        }

        const { id, slug } = req.query;
        const { cinematic } = req.body;

        if (!cinematic) {
            throw "cinematic is required";
        }

        if (!id && !slug) {
            throw "id or slug is required";
        }

        if (id) {
            const exhibitDoc = await db.collection("exhibits").doc(id).get();

            if (!exhibitDoc.exists) {
                return res.json({
                    success: false,
                    message: "Exhibit doesn't exist",
                });
            }

            const exhibit = exhibitDoc.data();
            if (userId.toLowerCase() !== exhibit?.owner?.toLowerCase()) {
                return res.json({
                    success: false,
                    message: "Exhibit doesn't belong to editor or creator.",
                });
            }
        } else {
            const destination = await getDestination(slug);

            if (destination && destination?.author?.id !== userId) {
                return res.json({
                    success: false,
                    message: "Destination doesn't belong to owner.",
                });
            }
        }

        await db
            .collection("cinematic")
            .doc(id || slug)
            .set(formatCinematic(cinematic));

        return res.json({
            success: true,
        });
    } catch (err) {
        console.log(err);

        return res.json({
            success: false,
        });
    }
};
