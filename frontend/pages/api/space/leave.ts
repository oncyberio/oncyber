import { db } from "@utils/firebaseAdmin";
import { auth } from "@utils/middlewares/authMiddleware";
import { corsMiddleware } from "@utils/middlewares/corsMiddleware";

export default async (req, res) => {
    await corsMiddleware(req, res);

    // We need to check first if user logged in and if he is an editor of the exhibit before he can update...

    try {
        var userId = await auth(req);

        userId = userId.toLowerCase();

        let { spaceId } = req.body;

        if (!spaceId)
            return res.status(400).json({
                success: false,
                message: "All fields are required.",
            });

        const transaction = await db.runTransaction(async (transaction) => {
            const exhibitRef = await db.collection("exhibits").doc(spaceId);

            const exhibitDoc = await transaction.get(exhibitRef);

            let exhibit = null;

            if (exhibitDoc.exists) {
                exhibit = exhibitDoc.data();

                // we make sure that the user is in the list of editors
                if (
                    !exhibit.editors
                        .map((editor) => editor.toLowerCase())
                        .includes(userId)
                ) {
                    return {
                        message: "Not and editor",
                        success: false,
                    };
                }
            }

            const usersRef = db
                .collection("users")
                .where("walletId", "==", userId)
                .limit(1);

            const users = await transaction.get(usersRef);

            if (!users.docs?.[0]?.id) {
                return {
                    success: false,
                    message: "User not found",
                };
            }

            const userDoc = users.docs[0];

            const user = userDoc.data();

            // remove the editor from the list of editors
            if (exhibit) {
                const newEditors = exhibit.editors.filter(
                    (editor) => editor.toLowerCase() !== userId
                );

                // remove the artworks he hung
                const newArtworks = {};

                Object.keys(exhibit.artworks).forEach((artworkId) => {
                    const { data, addedBy } = exhibit.artworks[artworkId];

                    if (addedBy && addedBy.toLowerCase() !== userId) {
                        newArtworks[artworkId] = exhibit.artworks[artworkId];
                    }
                });

                // Fetch the assets he shared
                const sharedAssetsRef = await db
                    .collection("users")
                    .doc(exhibit.owner)
                    .collection("exhibits")
                    .doc(spaceId)
                    .collection("shared")
                    .where("sharedBy", "==", userId);

                const sharedAssetsDocs = await transaction.get(sharedAssetsRef);

                //  Delete the assets he shared
                await Promise.all(
                    await sharedAssetsDocs.docs.map(async (doc) => {
                        await doc.ref.delete();
                    })
                );

                const now = Date.now();

                // Writes to `editors` must bump `lastUpdatedAt` — the
                // exhibit-view cache in pages/api/exhibit.ts is version-keyed
                // on it, so an unversioned write keeps serving the departed
                // user as an editor for up to the cache TTL.
                const updatePayload = {
                    editors: newEditors,
                    artworks: newArtworks,
                    lastUpdatedAt: now,
                    lastContentUpdatedAt: now,
                };

                // update exhibit
                await transaction.update(exhibitRef, updatePayload);
            }

            // We delete the exhibit from the list of the user's exhibits
            const userExhibitRef = db
                .collection("users")
                .doc(userDoc.id)
                .collection("exhibits")
                .doc(spaceId);

            await transaction.delete(userExhibitRef);

            // update current exhibit id if it's the current exhibit
            if (user?.currentExhibitId === spaceId) {
                const userRef = db.collection("users").doc(userDoc.id);

                await transaction.update(userRef, {
                    currentExhibitId: "",
                });
            }

            return {
                success: true,
            };
        });

        if (!transaction.success) {
            return res.status(400).json({
                success: transaction.success,
                message: transaction.message,
            });
        }

        return res.status(200).json({
            success: true,
        });
    } catch (err) {
        console.error(err);
        return res
            .status(400)
            .json({ success: false, message: "Failed to execute operation." });
    }
};
