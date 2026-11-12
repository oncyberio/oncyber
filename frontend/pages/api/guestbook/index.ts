import { db } from "@utils/firebaseAdmin";
import { corsMiddleware } from "@utils/middlewares/corsMiddleware";
import { getProfile, getProfiles } from "../user/getEditorsProfile";

export default async (req, res) => {
    try {
        await corsMiddleware(req, res);

        const { id, destinationId } = req.query;

        if (!id && !destinationId)
            return res.json({
                success: false,
                message: "Invalid exhibit or destination id",
            });

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

        const snapshot = await ref.orderBy("date", "desc").limit(30).get();

        if (snapshot.empty) {
            return res.json({
                success: true,
                messages: [],
            });
        }

        let messages = [];

        const users = [];

        await Promise.all(
            snapshot.docs.map(async (doc) => {
                const message = doc.data();

                users.push(message.walletId);

                try {
                    let date = message?.date?.toDate?.().toISOString();

                    let payload: any = {
                        id: doc.id,
                        ...message,
                        date,
                    };

                    payload.walletId = message.walletId;

                    messages.push(payload);
                } catch (e) {
                    console.log(e);
                }
            })
        );

        const profiles = await getProfiles(users);

        messages = messages.map((message) => {
            if (profiles?.[message.walletId]) {
                message.username = profiles[message.walletId].username;
                message.avatar = profiles[message.walletId].avatar;
            }

            return message;
        });

        res.json({
            success: true,
            messages,
        });
    } catch (err) {
        res.json({
            success: false,
            message: "failed to fetch messages",
        });
    }
};
