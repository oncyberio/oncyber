import { db } from "@utils/firebaseAdmin";

import { auth } from "@utils/middlewares/authMiddleware";

import { corsMiddleware } from "@utils/middlewares/corsMiddleware";

export default async (req, res) => {
    try {
        await corsMiddleware(req, res);

        const { id, destinationId } = req.query;
        const { message } = req.body;

        var userId = await auth(req);

        if (!id && !destinationId)
            return res.json({
                success: false,
                error: "Invalid exhibit or destination id",
            });

        if (!message) {
            return res.json({
                success: false,
                error: "Message can't be empty",
            });
        }

        const payload = {
            walletId: userId,
            message,
            date: new Date(),
        };

        let ref = null;

        if (id) {
            ref = db.collection("exhibits").doc(id).collection("guestbook");
        } else if (destinationId) {
            ref = db
                .collection("destinations")
                .doc(destinationId)
                .collection("guestbook");
        } else {
            return res.status(400).json({
                success: false,
                message: "No id provided",
            });
        }

        const newDoc = await ref.add(payload);

        res.json({
            success: true,
            message: {
                id: newDoc.id,
                ...payload,
            },
        });
    } catch (err) {
        res.json({
            success: false,
            error: "you need to authenticate first.",
        });
    }
};
