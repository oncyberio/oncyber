import { auth } from "../../utils/middlewares/authMiddleware";
import { db } from "../../utils/firebaseAdmin";
import { corsMiddleware } from "../../utils/middlewares/corsMiddleware";
import { firestore } from "firebase-admin";

export default async (req, res) => {
    await corsMiddleware(req, res);

    // Check first if already exists
    // IF yes return error
    // else
    // Get exhibit
    // Check previous custom Link
    // Delete it
    // Create new one
    try {
        var userId = await auth(req);

        const { customLink, exhibitId, token } = req.body;

        if (customLink === undefined) {
            return res.status(400).json({
                success: false,
                message: "Invalid customLink value (undefined)",
            });
        }

        // TODO: For now we don't handle yet concurrent customLink edits very well

        const isRemove = customLink === null || customLink == "";

        //
        const exhibitRef = db.collection("exhibits").doc(exhibitId);

        const customLinkRef = isRemove
            ? null
            : db.collection("customLink").doc(customLink);

        const exhibitLinkRef = isRemove
            ? null
            : db
                  .collection("exhibits")
                  .where("info.customLink", "==", customLink)
                  // existence/uniqueness check only — one match is enough
                  .limit(1);

        const [exhibitDoc, exhibitLinkQuery] = await Promise.all([
            exhibitRef.get(),
            exhibitLinkRef?.get(),
        ]);

        const exhibit = exhibitDoc.data();

        // Check ownership
        if (exhibit.owner.toLowerCase() != userId.toLowerCase()) {
            return res.status(400).json({
                success: false,
                message: "No right to access this.",
            });
        }

        // If exhibit has same link do nothing
        const oldLink = exhibit.info.customLink;

        if (oldLink === customLink) {
            return res.status(200).json({
                success: false,
                message: "You already own this link.",
            });
        }

        // make sure that no exhibit has that link
        if (exhibitLinkQuery?.docs.length > 0) {
            return res.status(400).json({
                success: false,
                message: "This link already exists.",
            });
        }

        // write everything in a single batch

        const batch = db.batch();

        if (oldLink) {
            // We delete old link
            const oldLinkRef = db.collection("customLink").doc(oldLink);
            batch.delete(oldLinkRef);
        }

        // Save the new link if any
        if (customLinkRef) {
            batch.set(customLinkRef, {
                exhibitId,
            });
        }

        // Save customLink in exhibit.info
        batch.update(
            exhibitRef,
            new firestore.FieldPath("info", "customLink"),
            customLink
        );

        await batch.commit();

        res.status(200).json({
            success: true,
        });
    } catch (err) {
        res.status(401).json({
            success: false,
            message: "You need to login first.",
        });
    }
};
