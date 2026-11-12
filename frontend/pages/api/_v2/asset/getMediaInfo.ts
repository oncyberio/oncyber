import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { FetchedAsset } from "@uitypes/Asset";
import { getAssetMediaInfo } from "@utils/media/mediaInfo";

export const getMediaInfo = proc({
    cors: true,
    auth: false,

    // schema
    schema: z.object({
        asset: z.record(z.string(), z.any()),
    }),

    // handler
    async handler(opts) {
        // throw new Error("no greet")

        const asset = opts.asset as FetchedAsset;

        const result = await getAssetMediaInfo(asset);

        return { ...result };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
