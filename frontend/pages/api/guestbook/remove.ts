import { db } from "@utils/firebaseAdmin";

import { auth } from "@utils/middlewares/authMiddleware";

import { corsMiddleware } from "@utils/middlewares/corsMiddleware";

export default async (req, res) => {
    try {
        await corsMiddleware(req, res);

        const { id, destinationId } = req.query;
        const { commentId } = req.body;

        var userId = await auth(req);

        if (!id && !destinationId)
            return res.json({
                success: false,
                error: "Invalid exhibit or destination id",
            });

        // const payload = {
        //     walletId: userId,
        //     message,
        //     date: new Date(),
        // };

        let exhibitData: any = {};

        if (id) {
            const exhibit: any = await db.collection("exhibits").doc(id).get();

            exhibitData = await exhibit.data();
        }

        let ref = null;

        if (id) {
            ref = db
                .collection("exhibits")
                .doc(id)
                .collection("guestbook")
                .doc(commentId);
        } else if (destinationId) {
            ref = db
                .collection("destinations")
                .doc(destinationId)
                .collection("guestbook")
                .doc(commentId);
        } else {
            return res.status(400).json({
                success: false,
                message: "No id provided",
            });
        }

        const comment: any = await ref.get();

        const commentData = await comment.data();

        if (exhibitData.owner != userId && commentData.walletId != userId)
            return res.json({
                success: false,
                error: "Can't remove if not owner or author",
            });

        const deleteComment: any = await db
            .collection("exhibits")
            .doc(id)
            .collection("guestbook")
            .doc(commentId)
            .delete();

        console.log(deleteComment.id);

        // const newDoc = await db
        //     .collection("exhibits")
        //     .doc(id)
        //     .collection("guestbook")
        //     .add(payload);

        res.json({
            success: true,
            message: {
                id: id,
            },
        });
    } catch (err) {
        res.json({
            success: false,
            error: "you need to authenticate first.",
        });
    }
};
