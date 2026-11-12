import {
    getAccountDoc,
    getSubcollections,
    saveSubcollections,
} from "@api/accounts/authenticate/utils/link";
import { getUserByDoc } from "@api/accounts/user/utils";
import { db } from "@utils/firebaseAdmin";
import { auth } from "@utils/middlewares/authMiddleware";
import { corsMiddleware } from "@utils/middlewares/corsMiddleware";
import shortid from "shortid";
import { ADMINS } from "../social/isMod";
import { stripSecretsFromJson } from "@utils/worldPassword/publicGating";
import { copyWorldPassword, secretRef } from "@utils/worldPassword/server";

export async function applyTemplate(spaceId, userId) {
    if (!ADMINS.includes(userId)) {
        return {
            success: false,
            message: "You are not allowed to duplicate this exhibit.",
        };
    }

    return await db.runTransaction(async (transaction) => {
        // fetch document to duplicate

        const ref = await db.collection("exhibits").doc(spaceId);

        const doc = await transaction.get(ref);

        const user = await getAccountDoc(userId, transaction, "walletId");

        if (!doc.exists) {
            return {
                success: false,
                message: "Exhibit doesn't exist.",
            };
        }

        if (!user) {
            return {
                success: false,
                message: "User doesn't exist.",
            };
        }

        const { collections, total } = await getSubcollections({
            source: ref,
            transaction,
        });

        const exhibit: any = doc.data();

        exhibit.info.headline = `${
            exhibit?.info?.headline?.split?.(" Template")?.[0] || ""
        } Template-${shortid.generate()}`;

        // we shouldn't duplicate custom link
        exhibit.info.customLink = "";

        exhibit.number_of_visits = 0;

        exhibit.createdAt = new Date();

        exhibit.editors = [user.id.toLowerCase()];

        exhibit.owner = user.id.toLowerCase();

        const newExhibitRef = db.collection("exhibits").doc();

        // The copy keeps the template's password, hashed, under its own
        // revision; nobody reads it back as text.
        const password = await copyWorldPassword(spaceId);

        if (password) {
            exhibit.gating = { ...exhibit.gating, password: password.password };
            if (password.secret)
                transaction.set(secretRef(newExhibitRef.id), password.secret);
        }

        await transaction.create(newExhibitRef, exhibit);

        const userExhibitRef = user.ref
            .collection("exhibits")
            .doc(newExhibitRef.id);

        await transaction.set(userExhibitRef, {
            id: newExhibitRef.id,
        });

        await saveSubcollections({
            transaction,
            destination: newExhibitRef,
            collections,
        });

        await transaction.update(user.ref, {
            currentExhibitId: newExhibitRef.id,
        });

        return {
            success: true,
            spaceId: newExhibitRef.id,
            exhibit: {
                ...exhibit,
                id: newExhibitRef.id,
            },
            message: "Successfully duplicated exhibit.",
        };
    });
}

export default async (req, res) => {
    await corsMiddleware(req, res);

    stripSecretsFromJson(res);

    try {
        var userId = await auth(req);

        const { spaceId } = req.body;

        // check first if exhibit

        if (!spaceId)
            return res.status(400).json({
                success: false,
                message: "You need to provide an exhibit id",
            });

        const transaction = await applyTemplate(spaceId, userId);

        if (!transaction.success) {
            return res.status(400).json({
                success: false,
                message: transaction.message,
            });
        }

        return res.status(200).json({
            success: true,
            spaceId: transaction.spaceId,
            exhibit: transaction.exhibit,
        });
    } catch (err) {
        res.status(401).json({
            success: false,
            message: "You need to login first.",
        });
    }
};
