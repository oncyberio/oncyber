import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import admin, { firestore } from "firebase-admin";
import { db } from "@utils/firebaseAdmin";
import { Experience } from "@uitypes/experience";

const isOwner = (userId: string) => (exhibit: Experience) => {
    //
    return exhibit.owner?.toLowerCase() == userId?.toLowerCase();
};

const FIELDS = {
    lastUpdatedAt: new firestore.FieldPath("lastUpdatedAt"),
    lastContentUpdatedAt: new firestore.FieldPath("lastContentUpdatedAt"),
    pendingTransaction: new firestore.FieldPath("pendingTransaction"),
};

export async function updateCollection(
    ref: firestore.DocumentReference,
    collection: string,
    docs: Record<string, any>
) {
    //
    await db.recursiveDelete(ref.collection(collection));

    return Promise.all(
        Object.keys(docs).map((id) => {
            //
            const doc = docs[id];
            return ref.collection(collection).doc(id).set(doc);
        })
    );
}

export async function doUpdateExhibitKit(
    newExhibit: Experience,
    userId: string,
    precondition = isOwner(userId)
) {
    //
    const ref = db.collection("exhibits").doc(newExhibit.id);

    const doc = await ref.get();

    if (!doc.exists) return;

    const exhibit = doc.data() as Experience;

    let preResult = precondition(exhibit);

    if (!preResult) return preResult;

    if (exhibit.pendingTransaction) {
        //
        return false;
    }

    try {
        await ref.update(FIELDS.pendingTransaction, true);

        let now = Date.now();

        const hasPortalCollection = exhibit.storageVersion === 2;

        if (hasPortalCollection) {
            //
            await updateCollection(ref, "portals", newExhibit.portals);
        }

        await updateCollection(ref, "kitbash", newExhibit.kitbash);

        const res = await db.runTransaction(async (transaction) => {
            //
            transaction.update(
                ref,
                new firestore.FieldPath("info", "room"),
                newExhibit.info.room
            );

            transaction.update(
                ref,
                new firestore.FieldPath("artworks"),
                newExhibit.artworks
            );

            if (!hasPortalCollection) {
                transaction.update(
                    ref,
                    new firestore.FieldPath("portals"),
                    newExhibit.portals
                );
            }

            transaction.update(ref, FIELDS.lastUpdatedAt, now);

            transaction.update(ref, FIELDS.lastContentUpdatedAt, now);

            return true;
        });

        return res;
        //
    } finally {
        //
        ref.update(FIELDS.pendingTransaction, false);
    }
}

export const updateExhibitKit = proc({
    auth: true,
    cors: true,

    // schema
    schema: z.object({
        exhibit: z.any(),
    }),

    // handler
    async handler({ exhibit }) {
        // throw new Error("no greet")
        return doUpdateExhibitKit(exhibit, this.userId);
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
