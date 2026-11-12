import { UploadableMediaInfo } from "@uitypes/mediaInfo";
import { uploadUrlToPinata } from "@utils/pinataUpload";
import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";

// Cloudinary is gone (all accounts 401): pin the source to Pinata instead and
// keep the old `{ url, secure_url, public_id }` response shape.
export async function doUploadMedia(
    publicId: string,
    mediaInfo: UploadableMediaInfo
) {
    try {
        console.log("[UPLOAD_MEDIA:pinata]", mediaInfo.mime_type);

        const result = await uploadUrlToPinata(
            mediaInfo.url,
            publicId,
            mediaInfo.mime_type
        );
        mediaInfo.url = result.secure_url;
        console.log("[UPLOAD_MEDIA:pinata/success]", result);
        return result;
    } catch (error) {
        console.error("[UPLOAD_MEDIA:pinata/error]", error);
        throw error;
    }
}

export const uploadMedia = proc({
    //
    auth: true,
    cors: true,

    // schema
    schema: z.object({
        publicId: z.string().min(1),
        mimeType: z.string().min(1),
        url: z.string().min(1),
    }),

    // handler
    async handler({ publicId, mimeType, url }) {
        //
        return doUploadMedia(publicId, {
            type: "Uploadable",
            url,
            mime_type: mimeType,
            urlField: null,
            size: 1,
        });
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
