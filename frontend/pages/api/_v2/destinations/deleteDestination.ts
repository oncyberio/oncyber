import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { db } from "@utils/firebaseAdmin";
import {
    getDestinationById,
    deleteDestination as firestoreDelete,
} from "@utils/firestore/destinations";

async function deleteStylekit(userId: string, stylekitId: string) {
    //
    const doc = await db.collection("stylekits").doc(stylekitId).get();

    if (!doc.exists) {
        console.warn("Can't find Stylekit " + stylekitId);
        return false;
    }

    const stylekit = doc.data();

    if (stylekit.owner.toLowerCase() != userId.toLowerCase()) {
        throw new Error("Get out of here");
    }

    await db.collection("stylekits").doc(stylekitId).delete();

    return true;
}

export const deleteDestination = proc({
    //
    cors: true,
    auth: true,

    // schema
    schema: z.object({
        id: z.string().min(1),
        slug: z.string().min(1),
    }),

    // handler
    async handler({ id, slug }) {
        //
        const destination = await getDestinationById(id);

        if (!destination) {
            throw new Error("Destination not found");
        }

        if (destination.userId !== this.userId) {
            throw new Error("Unauthorized");
        }

        await firestoreDelete(id);
        await deleteStylekit(this.userId, slug);
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
