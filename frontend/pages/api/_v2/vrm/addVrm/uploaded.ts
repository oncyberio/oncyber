import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { db } from "@utils/firebaseAdmin";

export const addUploadedVrm = proc({
    cors: true,
    auth: true,

    // schema
    schema: z.object({
        name: z.string().max(30),
        fileHash: z.string(),
        url: z.string().url(),
        urlCompressed: z.string().url(),
        scale: z.number(),
        description: z.string().max(140),
        image: z.string().url(),
        isHighQuality: z.boolean(),
        count: z.number().optional(),
        hasPFP: z.boolean().optional(),
        score: z.object({
            drawCalls: z.number().optional(),
            maxTextureSize: z.number().optional(),
            nbTextures: z.number().optional(),
            nbVertices: z.number().optional(),
            normalMap: z.number().optional(),
            pbrMaterials: z.number().optional(),
            perfScore: z.string().optional(),
        }),
    }),
    // handler
    async handler(opts) {
        const response = await db.collection("vrm").add({
            userId: this.userId,
            date: new Date(),
            ...opts,
        });

        const doc = await response.get();

        return {
            id: doc.id,
            ...doc.data(),
        };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
