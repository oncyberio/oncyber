import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { db } from "@utils/firebaseAdmin";

export const update = proc({
    cors: true,
    auth: true,

    // schema
    schema: z.object({
        id: z.string(),
        slug: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        "socials.discord_url": z.string().optional(),
        "socials.external_url": z.string().optional(),
        "socials.twitter_username": z.string().optional(),
        "socials.instagram_username": z.string().optional(),
        "images.image_url": z.string().optional(),
        "images.banner_image_url": z.string().optional(),
        tag: z.string().optional(),
        original_name: z.string().optional(),
    }),

    // handler
    async handler(opts) {
        // opts.slug;

        const doc = await db.collection("collections").doc(opts.id).get();

        if (!doc.exists) {
            return { success: false, error: "Collection not found" };
        }

        const collection = doc.data();

        if (
            !collection.editors
                .map((wallet) => wallet.toLowerCase())
                .includes(this.userId)
        ) {
            return { success: false, error: "Not authorized" };
        }

        await db.collection("collections").doc(opts.id).update(opts);

        return { success: true };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
