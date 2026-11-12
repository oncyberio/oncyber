import { z } from "zod";
import { proc } from "@utils/rpc/server";
import {
    uploadToPinata,
    MAX_MODEL_SIZE,
    MAX_IMAGE_SIZE,
} from "@utils/pinataUpload";

/**
 * Upload destination 3D model files (low/mid/high/original) to Pinata.
 * Returns IPFS gateway URLs for each file.
 */
export const uploadDestinationFiles = proc({
    cors: true,
    auth: true,
    schema: z.object({
        path_low: z.string().min(1),
        path_mid: z.string().min(1),
        path_high: z.string().min(1),
        original_path: z.string().min(1),
    }),
    async handler({ path_low, path_mid, path_high, original_path }) {
        const [lowUrl, midUrl, highUrl, originalUrl] = await Promise.all([
            uploadToPinata(path_low, "model_low", MAX_MODEL_SIZE),
            uploadToPinata(path_mid, "model_mid", MAX_MODEL_SIZE),
            uploadToPinata(path_high, "model_high", MAX_MODEL_SIZE),
            uploadToPinata(original_path, "model_original", MAX_MODEL_SIZE),
        ]);

        return {
            path_low: lowUrl,
            path_mid: midUrl,
            path_high: highUrl,
            original_path: originalUrl,
        };
    },
});

/**
 * Upload a destination thumbnail image to Pinata.
 * Returns the IPFS gateway URL.
 */
export const uploadDestinationThumbnail = proc({
    cors: true,
    auth: true,
    schema: z.object({
        thumbnail: z.string().min(1),
    }),
    async handler({ thumbnail }) {
        const url = await uploadToPinata(
            thumbnail,
            "thumbnail",
            MAX_IMAGE_SIZE
        );

        return { thumbnail: url };
    },
});

/**
 * Upload destination media (video, image, etc.) to Pinata.
 * Returns the IPFS gateway URL.
 */
export const uploadDestinationMedia = proc({
    cors: true,
    auth: true,
    schema: z.object({
        dataUrl: z.string().min(1),
        resource_type: z.string().optional().default("raw"),
    }),
    async handler({ dataUrl }) {
        const url = await uploadToPinata(dataUrl, "media", MAX_MODEL_SIZE);

        return { url, secure_url: url };
    },
});
