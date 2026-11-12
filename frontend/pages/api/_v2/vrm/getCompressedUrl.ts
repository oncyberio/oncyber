import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { db } from "@utils/firebaseAdmin";
import { cloudinary } from "@utils/urlUtils";

export const getCompressedUrl = proc({
    cors: true,
    auth: false,
    //
    schema: z.object({
        url: z.string().min(1),
    }),

    async handler(opts): Promise<boolean> {
        //
        let querySnapshot = await db
            .collection("vrm")
            .where("url", "==", opts.url)
            .limit(1)
            .get();

        if (!querySnapshot.empty) {
            const recordDoc = querySnapshot.docs[0];
            const doc = recordDoc.data();

            if (
                doc?.urlCompressed &&
                !cloudinary.isBrokenCloudinaryUrl(doc.urlCompressed)
            ) {
                return doc.urlCompressed;
            }

            return false;
        }

        return false;
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
