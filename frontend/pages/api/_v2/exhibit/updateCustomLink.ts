import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { firestore } from "firebase-admin";
import { db } from "@utils/firebaseAdmin";
import { Failure, Success } from "@utils/js";

async function doUpdateCustomLink(
    customLink: string,
    exhibitId: string,
    userId: string
) {
    // Check first if already exists
    // IF yes return error
    // else
    // Get exhibit
    // Check previous custom Link
    // Delete it
    // Create new one

    return db.runTransaction(async (batch) => {
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
            //
            throw new Error("No right to access this");
        }

        // If exhibit has same link do nothing
        const oldLink = exhibit.info.customLink;

        if (oldLink === customLink) {
            return false;
        }

        // make sure that no exhibit has that link
        if (exhibitLinkQuery?.docs.length > 0) {
            throw new Error("This link already exists.");
        }

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
            customLink,
            new firestore.FieldPath("lastUpdatedAt"),
            Date.now()
        );

        return true;
    });
}

export const updateCustomLink = proc({
    auth: true,
    cors: true,

    // schema
    schema: z.object({
        link: z.string(),
        exhibitId: z.string().min(1),
    }),

    // handler
    async handler({ link, exhibitId }) {
        //
        try {
            //
            const result = await doUpdateCustomLink(
                link,
                exhibitId,
                this.userId
            );

            return Success(result);
        } catch (err) {
            //
            console.error(err);

            return Failure(err.message);
        }
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
