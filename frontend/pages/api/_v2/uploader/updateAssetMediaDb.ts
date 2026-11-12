import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { updateAssetMedia, zodMediaInfoSchema } from "./uploadAssetMedia";
import { UploadableMediaInfo } from "@uitypes/mediaInfo";

export const updateAssetMediaDb = proc({
    //
    auth: true,
    cors: true,

    // schema
    schema: z.object({
        exhibitId: z.string().min(1),
        assetId: z.string().min(1),
        contract_address: z.string().min(1),
        token_id: z.string().min(1),
        mediaInfo: zodMediaInfoSchema,
    }),

    // handler
    async handler({
        exhibitId,
        assetId,
        contract_address,
        token_id,
        mediaInfo,
    }) {
        //

        return updateAssetMedia(
            this.userId,
            exhibitId,
            assetId,
            contract_address,
            token_id,
            mediaInfo as UploadableMediaInfo,
            null
        );
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
