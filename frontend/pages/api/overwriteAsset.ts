import { corsMiddleware } from "@utils/middlewares/corsMiddleware";

import { auth } from "../../utils/middlewares/authMiddleware";

import { db } from "../../utils/firebaseAdmin";

import whitelist from "../../utils/whitelist.json";

import { updateExhibit } from "../api/exhibit";

import { database } from "@utils/firebase";
import reformatAsset from "@utils/metadata/reformatAsset";
import { push, ref } from "firebase/database";

export async function isAdminCurator(userId, exhibitId) {
    const userExhibitDoc = await db
        .collection("users")
        .doc(userId.toLowerCase())
        .collection("exhibits")
        .doc(exhibitId)
        .get();

    const userExhibit = userExhibitDoc.data();

    return userExhibit.isAdminCurator;
}

export default async (req, res) => {
    try {
        await corsMiddleware(req, res);

        let userId = await auth(req);

        const { exhibitId, assetId, fileMetadata, media } = req.body;

        const exhibitDoc = await db.collection("exhibits").doc(exhibitId).get();

        if (!exhibitDoc.exists)
            return res.status(404).json({
                success: false,
                message: "Failed to find exhibit",
            });

        const exhibit = exhibitDoc.data();

        // If user not whitelisted
        // if (!whitelist[exhibit.owner.toLowerCase()]) {
        //     return res.json({
        //         success: false,
        //         message: "You can't edit this space",
        //     });
        // }

        // Check if admin curator or owner
        if (
            exhibit.owner.toLowerCase() !== userId.toLowerCase() &&
            !(await isAdminCurator(userId, exhibitId))
        ) {
            return res.json({
                success: false,
                message: "You can't edit this space",
            });
        }

        let mediaType;

        if (fileMetadata.type.startsWith("image/")) {
            mediaType = "image";
        }

        if (fileMetadata.type.startsWith("video/")) {
            mediaType = "video";
        }

        const response = await updateExhibit(
            exhibitDoc.id,
            {
                FIRESTORE_UPDATE_ASSET: true,
                assetId,
                update: {
                    overwrite: media,
                },
            },
            userId.toLowerCase()
        );

        let newAsset = {
            ...exhibit.artworks[assetId],
            overwrite: media,
        };

        newAsset = reformatAsset(exhibit, newAsset);

        push(ref(database, "/exhibits/" + exhibitId), {
            type: "REPLACE_ASSET",
            payload: {
                asset: newAsset,
            },
            walletId: userId,
            meshId: assetId,
            isServerEvent: true,
            timestamp: new Date().getTime() + 1000 * 10,
        });

        // database.ref("/exhibits/" + exhibitId).push({
        //     type: "REPLACE_ASSET",
        //     payload: {
        //         asset: newAsset,
        //     },
        //     walletId: userId,
        //     meshId: assetId,
        //     isServerEvent: true,
        //     timestamp: new Date().getTime() + 1000 * 10,
        // });

        if (response.success) {
            return res.json({
                success: true,
                asset: newAsset.data,
            });
        } else {
            return res.json({
                success: false,
                message: "Failed to save",
            });
        }
    } catch (err) {
        console.log(err);

        res.json({
            success: false,
            message: "Failed to overwrite asset",
        });
    }
};

export const config = {
    api: {
        bodyParser: {
            sizeLimit: "100mb",
        },
    },
};
