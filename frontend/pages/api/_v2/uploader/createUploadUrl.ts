import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import {
    createSignedUploadUrl,
    MAX_DIRECT_UPLOAD_SIZE,
} from "@utils/pinataUpload";

/**
 * A short-lived Pinata upload URL for the signed-in visitor's browser.
 *
 * The browser sends the file straight to Pinata with it, so the Pinata key
 * never leaves the server and large files don't pass through this route.
 */
export const createUploadUrl = proc({
    auth: true,
    cors: true,

    schema: z.object({}),

    async handler() {
        const url = await createSignedUploadUrl();

        return { url, maxSize: MAX_DIRECT_UPLOAD_SIZE };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
