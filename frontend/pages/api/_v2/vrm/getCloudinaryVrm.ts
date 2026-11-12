import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { db } from "@utils/firebaseAdmin";
import { cloudinary } from "@utils/urlUtils";

export const getCloudinaryVrm = proc({
    //
    auth: true,
    cors: true,

    // schema
    schema: z.object({
        fileHash: z.string(),
    }),

    // handler
    async handler(opts) {
        //

        const querySnapshot = await db
            .collection("vrm")
            .where("fileHash", "==", opts.fileHash)
            .limit(1)
            .get();

        if (querySnapshot.empty) {
            return false;
        }

        const firstDocument = querySnapshot.docs[0];
        const doc = firstDocument.data();

        if (!doc?.url) return false;

        let urlCompressed = null;

        if (
            doc?.urlCompressed &&
            !cloudinary.isBrokenCloudinaryUrl(doc.urlCompressed)
        ) {
            //
            urlCompressed = doc.urlCompressed;
        }

        return {
            url: doc.url,
            urlCompressed,
            thumbnail: doc.image,
        };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
