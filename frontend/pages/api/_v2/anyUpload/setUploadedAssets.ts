import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { firestore } from "firebase-admin";
import { db } from "@utils/firebaseAdmin";
import { patchUploadIndex } from "./uploadIndex";

const schema = z.object({
    hash: z.string().min(1),
    url: z.string().min(1),
    d_optimized_files: z
        .object({
            high: z.string().min(1),
            low: z.string().min(1),
            low_compressed: z.string().min(1),
        })
        .nullable()
        .optional(),
    name: z.string().min(1),
    mimeType: z.string().min(1),
});

export type UploadOpts = z.infer<typeof schema> & {
    createdAt?: number;
    lastModified?: number;
};

export function saveUpload(
    batch: FirebaseFirestore.WriteBatch,
    userId: string,
    opts: UploadOpts
) {
    //
    const serverTime = Date.now();

    // Returned so callers can patch caches/upload-index-{userId} AFTER the
    // batch commits (see ./uploadIndex.ts — the patch must never be part of
    // the primary batch).
    const entry = {
        ...opts,
        createdAt: opts.createdAt ?? serverTime,
        lastModified: opts.lastModified ?? serverTime,
    };

    batch.set(
        db
            .collection("users")
            .doc(userId)
            .collection("assets-upload-content")
            .doc(opts?.hash),
        entry
    );

    batch.set(
        db.collection("assets-upload-hash").doc(opts?.hash),
        {
            d_url: opts.url,
            mimeType: opts.mimeType,
            name: opts.name,
            userIds: firestore.FieldValue.arrayUnion(userId),
            lastModified: serverTime,
        },
        {
            merge: true,
        }
    );

    return entry;
}

//? Used to add an asset to the user uploaded assets list
export const setUploadedAssets = proc({
    cors: true,
    auth: true,

    schema,

    async handler(opts) {
        //
        try {
            //
            const batch = db.batch();

            const entry = saveUpload(batch, this.userId, opts);

            await batch.commit();

            await patchUploadIndex(this.userId, { [opts.hash]: entry });

            return { success: true };
            //
        } catch (err) {
            //
            console.error("ERRROR", err);

            return { error: "IU-00" };
        }
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
