import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { db } from "@utils/firebaseAdmin";
import { getMimeType } from "@utils/mimeUtils";
import { Asset } from "@uitypes/Asset";

//? Used to check if the seleted file has already been uploaded if yes we give it's url
//? used in content uploader of add any artwork
export const checkUploadedAssets = proc({
    cors: true,
    auth: true,

    schema: z.object({
        fileHash: z.string().min(1),
    }),

    async handler(opts): Promise<{
        url: string;
        mimeType?: string;
        d_optimized_files: Asset["d_optimized_files"];
        exists?: boolean;
    } | null> {
        //
        let hashDBDoc = await db
            .collection("assets-upload-hash")
            .doc(opts.fileHash)
            .get();

        if (!hashDBDoc.exists) return null;

        let data = hashDBDoc.data();

        const exists = data.userIds.some(
            (it) => it.toLowerCase() === this.userId.toLowerCase()
        );

        if (data.d_url) {
            //
            const mimeType = data.mimeType ?? getMimeType(data.d_url);

            return {
                url: data.d_url,
                mimeType,
                d_optimized_files: data.d_optimized_files ?? null,
                exists,
            };
        }

        // We should wvoid this by storing cloudinary in hash data as well
        if (!data.userIds?.length) return null;

        let contentDBDoc = await db
            .collection("users")
            .doc(data.userIds[0])
            .collection("assets-upload-content")
            .doc(opts.fileHash)
            .get();

        if (!contentDBDoc.exists) return null;

        data = contentDBDoc.data();

        const mimeType = data.mimeType ?? getMimeType(data.d_url);

        return {
            url: data.url,
            mimeType,
            d_optimized_files: data.d_optimized_files ?? null,
            exists,
        };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
