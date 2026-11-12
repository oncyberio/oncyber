import { z } from "zod";
import { db } from "@utils/firebaseAdmin";
import { proc, NoApi } from "@utils/rpc/server";

export const getAssetsByHash = proc({
    cors: true,
    auth: false,

    // schema
    schema: z.object({
        hash: z.string().min(1),
    }),

    // handler
    async handler({ hash }) {
        // 
        const contentDBRef = await db.collection("assets-upload-hash").doc(hash).get();

        if(!contentDBRef.exists) {
            return null;
        }

        const data = contentDBRef.data();

        return data;
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
