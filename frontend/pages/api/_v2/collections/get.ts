import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { FetchedAsset } from "@uitypes/Asset";
import { getAssetMediaInfo } from "@utils/media/mediaInfo";
import { db } from "@utils/firebaseAdmin";

export const get = proc({
    cors: true,
    auth: false,

    // schema
    schema: z.object({
        names: z.array(z.string()),
    }),

    // handler
    async handler(opts) {
        // batch firestore get requests

        const collections = await db
            .collection("collections")
            .where("contract_address", "in", opts.names)
            .get();

        return {
            success: true,
            collections: collections.docs.map((doc) => doc.data()),
        };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
