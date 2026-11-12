import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { db } from "@utils/firebaseAdmin";

export const addOwnedVrm = proc({
    cors: true,
    auth: true,

    // schema
    schema: z.object({
        id: z.string(),
        url: z.string().url(),
    }),
    // handler
    async handler({ id, url }) {
        const doc = await db.collection("owned-vrm").doc(id).get();

        if (doc.exists) {
            throw new Error(id + " already stored");
        }

        await db.collection("owned-vrm").doc(id).set({
            date: new Date(),
            url,
        });

        return true;
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
