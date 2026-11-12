import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { firestore } from "firebase-admin";
import { db } from "@utils/firebaseAdmin";
import { Failure, Result, Success } from "@utils/js";
import { isSignedInAs } from "@utils/auth/accountOwnership";
import { getStylekitByRoom } from "pages/api/stylekit";
import { Experience } from "@uitypes/experience";
import { EMPTY_ROOM } from "@utils/emptyRoom";
import { getDefaultEmptyRoomData } from "@3factory/space/roomdatacompat";

export async function createExhibit(userId: string, kit: string) {
    //
    const room = kit || EMPTY_ROOM.slug;

    const doc = {
        info: {
            room,
        },
        artworks: {},
        editors: [userId],
        createdAt: new Date(),
        hasKitbash: true,
        owner: userId,
        number_of_visits: 0,
    } as any;

    const batch = db.batch();

    const exhibitRef = db.collection("exhibits").doc();

    batch.create(exhibitRef, doc);

    batch.set(
        db
            .collection("users")
            .doc(userId)
            .collection("exhibits")
            .doc(exhibitRef.id),
        {
            id: exhibitRef.id,
        }
    );

    const components = getDefaultEmptyRoomData();
    //
    const kitbashRef = db
        .collection("exhibits")
        .doc(exhibitRef.id)
        .collection("kitbash");

    Object.keys(components).forEach((id) => {
        //
        const c = components[id];

        batch.set(kitbashRef.doc(id), c);
    });

    await batch.commit();

    doc.id = exhibitRef.id;

    doc.kitbash = components;

    return doc;
}

export const createEmpty = proc({
    auth: true,
    cors: true,

    // schema
    schema: z.object({
        userId: z.string().min(1),
        kit: z.string().or(z.null()).optional(),
    }),

    // handler
    async handler({ userId, kit }): Promise<Result<Experience>> {
        // A new space is owned by, and listed under, the signed-in account.
        if (!isSignedInAs(this.userId, userId)) {
            return Failure("Sign in to the account you are creating for.");
        }

        try {
            //
            const result = await createExhibit(userId, kit);

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
