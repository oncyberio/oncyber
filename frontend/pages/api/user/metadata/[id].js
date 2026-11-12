import { db } from "../../../../utils/firebaseAdmin";
import { corsMiddleware } from "../../../../utils/middlewares/corsMiddleware";
import { auth } from "../../../../utils/middlewares/authMiddleware";
import {
    isSignedInAs,
    writesAccountIdentity,
} from "../../../../utils/auth/accountOwnership";
import { publicUserProfile } from "../../../../utils/firestore/userProfiles";

const saveMetadata = async (id, metadata) => {
    // const decodedToken = await auth().verifyIdToken(token, true);
    var userData;

    try {
        userData = await db.doc(`/users/${id}`).update(metadata);
    } catch (e) {
        if (e.code == 5) {
            userData = await db.doc(`/users/${id}`).set(metadata);
        } else {
            throw { code: 400 };
        }
    }

    return {
        ...userData,
        id: id,
    };
};

const getMetadata = async (userId) => {
    const userData = await (await db.doc(`/users/${userId}`).get()).data();
    // prepare for when we dont need to store actual asset data anymore
    // const items = await getAssets(userId);

    return {
        ...userData,
        // ...items
    };
};

export default async (req, res) => {
    await corsMiddleware(req, res);

    try {
        const id = req.query.id;
        var result;
        if (!id) throw 404;

        // Writing a user document is for its owner, as in user/update; a
        // read without that session gets the public shape (no e-mails).
        const sessionUserId = await auth(req).catch(() => null);
        const isOwner = isSignedInAs(sessionUserId, id);

        if (req.body) {
            const { metadata } = JSON.parse(req.body);
            if (!isOwner || writesAccountIdentity(metadata)) {
                return res.status(403).json({
                    success: false,
                    message: "Not your account.",
                });
            }
            result = await saveMetadata(id, metadata);
        } else {
            result = await getMetadata(id);
            if (!isOwner) result = publicUserProfile(result);
        }

        return res.status(200).json(result);
    } catch (err) {
        console.error(err);
        // take in account the update method that throws error code 400
        return res.status(400).json({
            success: false,
            message: "Error happen when authenticating.",
        });
    }
};
