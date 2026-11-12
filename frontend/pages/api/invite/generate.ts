import { db } from "@utils/firebaseAdmin";

import { auth } from "@utils/middlewares/authMiddleware";

import { corsMiddleware } from "@utils/middlewares/corsMiddleware";

export default async (req, res) => {
    try {
        await corsMiddleware(req, res);

        if (!req.body.exhibitId) {
            return res.json({
                success: false,
                message: "Space required.",
            });
        }

        var userId = await auth(req);

        const transaction = await db.runTransaction(async (transaction) => {
            // 0. We first check that only the right user is able to do it
            const exhibitRef = db
                .collection("exhibits")
                .doc(req.body.exhibitId);

            const exhibitDoc = await transaction.get(exhibitRef);

            if (!exhibitDoc.exists) {
                return Promise.reject({ success: false });
            }

            const exhibit = exhibitDoc.data();

            if (userId !== exhibit.owner) {
                return Promise.reject({ success: false });
            }

            // 1. check if an invite link is already there
            const inviteRef = db
                .collection("invites")
                .where("exhibitId", "==", req.body.exhibitId);

            const inviteDocs = await transaction.get(inviteRef);

            // 2. If yes, we delete
            if (!inviteDocs.empty) {
                await Promise.all(
                    inviteDocs.docs.map(async (doc) => {
                        await transaction.delete(doc.ref);
                    })
                );
            }

            // 3. then, we create a new invite link
            const newInviteRef = db.collection("invites").doc();

            await transaction.create(newInviteRef, {
                exhibitId: req.body.exhibitId,
            });

            return {
                success: true,
                inviteId: newInviteRef.id,
            };
        });

        res.json({
            success: true,
            inviteId: transaction.inviteId,
        });
    } catch (err) {
        res.json({
            success: false,
            message: "Failed to generate invite link. Please contact support!",
        });
    }
};
