import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { db } from "@utils/firebaseAdmin";

export const updateVrm = proc({
    cors: true,
    auth: true,

    // schema
    schema: z.object({
        id: z.string(),
        name: z.string().max(30).optional(),
        scale: z.number().optional(),
        description: z.string().max(140).optional(),
    }),
    // handler
    async handler({ id, ...payload }) {
        // Only the uploader's own avatar, the same check destroyVrm makes.
        const ref = db.collection("vrm").doc(id);
        const doc = await ref.get();
        if (!doc.exists || doc.data()?.userId !== this.userId) {
            throw new Error("Failed to update vrm");
        }
        await ref.update(payload);
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
