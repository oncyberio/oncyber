import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { db } from "@utils/firebaseAdmin";
import { Failure, Result, Success } from "@utils/js";
import { isSignedInAs } from "@utils/auth/accountOwnership";
import { canEditExhibit } from "@utils/firestore/exhibitEditors";

export const create = proc({
    auth: true,
    cors: true,

    // schema
    schema: z
        .object({
            userId: z.string().min(1),
            title: z.string().min(1),
            date: z.number().min(1),
            thumbnail: z.string().min(1),
            eventType: z.string().min(1),
            exhibitId: z.string().min(1),
            endDate: z.number().min(1),
        })
        .required(),

    // handler
    async handler(payload) {
        //
        try {
            // An event is announced as the caller's, in a space they edit;
            // deleteEvent trusts the stored userId.
            if (
                !isSignedInAs(this.userId, payload.userId) ||
                !(await canEditExhibit(payload.exhibitId, this.userId))
            ) {
                return Failure("Not allowed");
            }

            const result = await db.collection("event-scheduler").add({
                ...payload,
                createdAt: new Date(),
            });

            return Success(result);
            //
        } catch (err) {
            //
            console.error(err);

            return Failure(err.message);
        }
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
