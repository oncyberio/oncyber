import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { db, fire } from "@utils/firebaseAdmin";

export const destroyVrm = proc({
    //
    auth: true,
    cors: true,

    // schema
    schema: z.object({
        id: z.string(),
    }),

    // handler
    async handler({ id }) {
        //

        const collectionRef = db.collection("vrm");

        const querySnapshot = await collectionRef
            .where(fire.FieldPath.documentId(), "==", id)
            .where("userId", "==", this.userId)
            .get();

        if (querySnapshot.empty) {
            throw new Error("Failed to delete vrm");
        }

        await collectionRef.doc(id).delete();
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
