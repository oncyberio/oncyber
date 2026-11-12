import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { db } from "@utils/firebaseAdmin";

export const getVrm = proc({
    //
    auth: true,
    cors: true,

    // schema
    schema: z.object({
        id: z.string(),
        type: z.literal("owned").optional(),
    }),

    // handler
    async handler({ id, type }) {
        //

        const doc = await db
            .collection(type === "owned" ? "owned-vrm" : "vrm")
            .doc(id)
            .get();

        if (!doc.exists) {
            return false;
        }

        return {
            id: doc.id,
            ...doc.data(),
        };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
