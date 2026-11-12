//
import { db } from "@utils/firebaseAdmin";
import { api, NoApi, proc } from "@utils/rpc/server";
import { z } from "zod";

export const storage = proc({
    //
    schema: z.object({
        sessionId: z.string().min(1),
        data: z.string(),
        space: z.string(),
        type: z.union([z.literal("feedback"), z.literal("report")]),
        roomId: z.string(),
    }),

    //
    async handler({ sessionId, data, space, type, roomId }) {
        await db.collection(type).add({
            userId: this.userId,
            sessionId,
            data,
            roomId,
            date: new Date(),
            space,
        });
    },
});

export default NoApi;
