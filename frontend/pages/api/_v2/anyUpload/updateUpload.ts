import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { firestore } from "firebase-admin";
import { db } from "@utils/firebaseAdmin";
import { getContentByIds } from "@utils/getContentByIds";
import { patchUploadIndex } from "./uploadIndex";

export const updateUpload = proc({
    cors: true,
    auth: true,

    schema: z.object({
        hash: z.string().min(1),
        data: z.object({
            name: z.string().min(1),
        }),
    }),

    async handler({ hash, data }) {
        //
        const serverTime = Date.now();

        await db.runTransaction(async (t) => {
            //

            const ref = db
                .collection("users")
                .doc(this.userId)
                .collection("assets-upload-content")
                .doc(hash);

            const doc = await t.get(ref);

            if (!doc.exists) throw new Error("Unkown upload " + hash);

            t.update(ref, "name", data.name, "lastModified", serverTime);
        });

        await patchUploadIndex(this.userId, {
            [hash]: { name: data.name, lastModified: serverTime },
        });
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
