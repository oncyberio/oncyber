import { Experience } from "@uitypes/experience";
import { User, UserExhibit } from "@uitypes/user";
import { db } from "@utils/firebaseAdmin";
import { canChangeRole, getUserRole } from "@utils/invite";

import { auth } from "@utils/middlewares/authMiddleware";

import { corsMiddleware } from "@utils/middlewares/corsMiddleware";

export async function getUserData(
    transaction: FirebaseFirestore.Transaction,
    walletId: string,
    exhibitId: string
) {
    //
    const userSnapRef = db
        .collection("users")
        .where("walletId", "==", walletId.toLowerCase());

    const userSnap = await transaction.get(userSnapRef);

    if (userSnap.empty) {
        return Promise.reject({
            success: false,
            message: "Failed to find user " + walletId,
        });
    }

    const userRef = userSnap.docs[0].ref;

    const userDoc = userSnap.docs[0];

    const user = userDoc.data() as User;

    user.id = userDoc.id;

    const userExhibitRef = userRef.collection("exhibits").doc(exhibitId);

    const userExhibitDoc = await transaction.get(userExhibitRef);

    if (!userExhibitDoc.exists) {
        //
        return Promise.reject({
            success: false,
            message: "Failed to find user exhibit",
        });
    }

    const userExhibit = userExhibitDoc.data() as UserExhibit;

    return {
        user,
        userRef,
        userExhibit,
        userExhibitRef,
    };
}

export default async (req, res) => {
    try {
        await corsMiddleware(req, res);

        let { editorId, exhibitId } = req.body;

        if (!exhibitId || !editorId)
            return res.status(400).json({
                success: false,
                message: "All fields are required.",
            });

        const userId = await auth(req);

        editorId = editorId.toLowerCase();

        await db.runTransaction(async (transaction) => {
            //

            // check if the user trying to getting kicked isn't the owner hehe
            if (userId === editorId) {
                return res.status(401).json({
                    success: false,
                    message: "You don't have permission to kick this user.",
                });
            }

            //#region get Exhibit
            const exhibitRef = db.collection("exhibits").doc(exhibitId);

            const exhibitDoc = await transaction.get(exhibitRef);

            if (!exhibitDoc.exists) {
                //
                return Promise.reject({
                    success: false,
                    message: "Failed to find exhibit",
                });
            }

            const exhibit = exhibitDoc.data() as Experience;
            //#endregion

            const [editorData, userData] = await Promise.all([
                getUserData(transaction, editorId, exhibitId),
                getUserData(transaction, userId, exhibitId),
            ]);

            let fallbackExhibitId;

            if (editorData.user.currentExhibitId === exhibitId) {
                //
                const query = await editorData.userRef
                    .collection("exhibits")
                    .limit(1)
                    .get();

                const doc = query.docs?.[0];

                if (doc.exists) {
                    //
                    fallbackExhibitId = doc.id;
                }
            }

            // check if he has the previlege to update

            const userRole = getUserRole(userData.userExhibit);

            const editorRole = getUserRole(editorData.userExhibit);

            if (
                userId !== exhibit.owner &&
                !canChangeRole(userRole, editorRole)
            ) {
                return res.status(401).json({
                    success: false,
                    message: "You don't have permission to kick this user man",
                    userRole,
                    editorRole,
                });
            }

            const sharedAssetsRef = editorData.userRef
                .collection("exhibits")
                .doc(editorData.user.id)
                .collection("shared")
                .where("sharedBy", "==", editorId);

            const sharedAssetsDocs = await transaction.get(sharedAssetsRef);

            //#region Update Exhibit

            // remove the editor from the list of editors
            const newEditors = exhibit.editors.filter(
                (editor) => editor.toLowerCase() !== editorId
            );

            // remove the artworks he hung
            const newArtworks = {};

            Object.keys(exhibit.artworks).forEach((artworkId) => {
                //
                const { addedBy } = exhibit.artworks[artworkId];

                if (addedBy?.toLowerCase?.() !== editorId) {
                    newArtworks[artworkId] = exhibit.artworks[artworkId];
                }
            });

            const now = Date.now();

            transaction.update(exhibitRef, {
                artworks: newArtworks,
                editors: newEditors,
                lastUpdatedAt: now,
                lastContentUpdatedAt: now,
            });
            //#endregion

            // We delete the exhibit from the list of the user's exhibits
            transaction.delete(editorData.userExhibitRef);

            if (editorData.user?.currentExhibitId === exhibitId) {
                // update current exhibit id
                transaction.update(editorData.userRef, {
                    currentExhibitId: fallbackExhibitId || "",
                });
            }

            //#region Remove shared assets

            sharedAssetsDocs.docs.forEach(async (doc) => {
                transaction.delete(doc.ref);
            });
            //#endregion
        });

        return res.json({
            success: true,
        });
    } catch (err) {
        console.log("errrrrrrrrr", err);

        return res.json({
            success: false,
            message: err.message,
        });
    }
};
