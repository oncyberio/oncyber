import { db } from "@utils/firebaseAdmin";

import { auth } from "@utils/middlewares/authMiddleware";

import { corsMiddleware } from "@utils/middlewares/corsMiddleware";

import { createExhibit } from "../exhibit";

import { getDestinationBySlug } from "@utils/firestore/destinations";

import { getOwnedRooms } from "@dapp/cyberRooms";

export async function createSpace(userId, slug, userIds = []) {
    // Ownership gate before a write — must read fresh, not the cached slug copy.
    const destinationData = await getDestinationBySlug(slug, { fresh: true });

    if (!destinationData)
        return {
            success: false,
            message: "Destination not found.",
        };

    const wallets = userIds.concat({
        id: userId,
    });

    let isOwned = false;

    if (
        // destinationData.tag.includes("uploaded") ||
        destinationData.tag.includes("free")
    ) {
        //
        isOwned = true;
    } else {
        for (let i = 0; i < wallets.length; i++) {
            const walletId = wallets[i].id;

            const result = await getOwnedRooms(walletId, [destinationData]);

            console.log("Ojfewfjwoefjweoifjwef", result);

            if (result?.[slug]) {
                isOwned = true;

                break;
            }
        }
    }

    if (!isOwned) {
        return {
            success: false,
            message: "You do not own this space.",
        };
    }

    const exhibit = await createExhibit(userId, slug);

    await db.collection("users").doc(userId).update({
        currentExhibitId: exhibit.id,
    });

    return {
        success: true,
        exhibit,
        message: "Successfully created space.",
    };
}

export default async (req, res) => {
    await corsMiddleware(req, res);

    // We need to check first if user logged in and if he is an editor of the exhibit before he can update...

    try {
        var userId = await auth(req);

        userId = userId.toLowerCase();

        const { slug } = req.body;

        if (!slug)
            return res.status(400).json({
                success: false,
                message: "All fields are required.",
            });

        const exhibit = await createSpace(userId, slug);

        if (!exhibit)
            return res.status(400).json({
                success: false,
                message: "Failed to create exhibit.",
            });

        return res.status(200).json({
            success: true,
            exhibit,
        });
    } catch (err) {
        console.error(err);
        return res
            .status(400)
            .json({ success: false, message: "Failed to execute operation." });
    }
};
