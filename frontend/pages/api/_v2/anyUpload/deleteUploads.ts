import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { firestore } from "firebase-admin";
import { db } from "@utils/firebaseAdmin";
import { getContentByIds } from "@utils/getContentByIds";
import { patchUploadIndex } from "./uploadIndex";

export const deleteUploads = proc({
    cors: true,
    auth: true,

    schema: z.object({
        hashes: z.array(z.string().min(1)),
    }),

    async handler({ hashes }) {
        //
        const serverTime = Date.now();

        await db.runTransaction(async (t) => {
            //

            const hashesRef = db.collection("assets-upload-hash");

            const userUploadsRef = db
                .collection("users")
                .doc(this.userId)
                .collection("assets-upload-content");

            const [hashesInfo, userUploads] = await Promise.all([
                //
                getContentByIds(
                    hashesRef,
                    firestore.FieldPath.documentId(),
                    hashes
                ),

                getContentByIds(
                    userUploadsRef,
                    firestore.FieldPath.documentId(),
                    hashes
                ),
            ]);

            hashesInfo.forEach((upload) => {
                //
                let newUsers = upload.userIds.filter(
                    (it) => it.toLowerCase() !== this.userId.toLowerCase()
                );

                let updates = ["userIds", newUsers, "lastModified", serverTime];

                if (!upload.d_url) {
                    //
                    let res = userUploads.find((it) => it.id === upload.id);

                    if (res) {
                        updates.push("d_url", res.url);
                    }
                }

                // @ts-ignore
                t.update(hashesRef.doc(upload.id), ...updates);
            });

            hashes.forEach((hash) => {
                t.delete(userUploadsRef.doc(hash));
            });
        });

        const removals: Record<string, any> = {};
        hashes.forEach((hash) => {
            removals[hash] = firestore.FieldValue.delete();
        });
        await patchUploadIndex(this.userId, removals);
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
