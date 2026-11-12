import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { firestore } from "firebase-admin";
import { db } from "@utils/firebaseAdmin";
import { Failure, Result, Success } from "@utils/js";
import { isSignedInAs } from "@utils/auth/accountOwnership";
import { getStylekitByRoom } from "pages/api/stylekit";
import { Experience } from "@uitypes/experience";
import { getPostHogClient } from "@utils/posthog-server";

export const oldToNew = {
    temple: "temple_v2",
    classic: "classic_v2",
    warehouse: "warehouse_v2",
    "white-cube": "white-cube_v2",
    "wolfgang-n2": "wolfgang-n2_v2",
    falcon: "falcon_v2",
    genesis: "genesis_v2",
    apesbar: "apesbar_v2",
    gutter: "gutter_v2",
    void: "void_v2",
    mindds: "mindds_v2",
    altitude: "altitude_v2",
    sunshine: "sunshine_v2",
    ackbar: "ackbar_v2",
};

export const newToOld = {};

Object.keys(oldToNew).forEach((key) => {
    newToOld[oldToNew[key]] = key;
});

interface CreateExhibitOpts {
    userId: string;
    room: string;
    isFuture?: boolean;
}

function getDefaultExhibitData(opts: CreateExhibitOpts): Experience {
    const { userId, room } = opts;

    const doc = {
        info: {
            room,
        },
        artworks: {},
        editors: [userId],
        createdAt: new Date(),
        owner: userId,
        number_of_visits: 0,
    } as any;

    return doc;
}

export async function createExhibit(opts: CreateExhibitOpts) {
    //
    let { userId, room } = opts;

    room = oldToNew[room] || room;

    const doc = getDefaultExhibitData({ userId, room });

    const stylekit = await getStylekitByRoom(room);

    if (stylekit?.kitbash) {
        doc.hasKitbash = true;
    }

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

    if (stylekit?.kitbash) {
        //
        const kitbashRef = db
            .collection("exhibits")
            .doc(exhibitRef.id)
            .collection("kitbash");

        Object.keys(stylekit.kitbash).forEach((type) => {
            //
            const kd = stylekit.kitbash[type];
            batch.set(kitbashRef.doc(type), kd);
        });
    }

    await batch.commit();

    doc.id = exhibitRef.id;

    if (stylekit?.kitbash) {
        doc.kitbash = stylekit.kitbash;
    }

    return doc;
}

export const create = proc({
    auth: true,
    cors: true,

    // schema
    schema: z.object({
        userId: z.string().min(1),
        room: z.string().min(1),
    }),

    // handler
    async handler({ userId, room }): Promise<Result<Experience>> {
        // A new space is owned by, and listed under, the signed-in account.
        if (!isSignedInAs(this.userId, userId)) {
            return Failure("Sign in to the account you are creating for.");
        }

        try {
            //
            const result = await createExhibit({ userId, room });

            const posthog = getPostHogClient();
            posthog.capture({
                distinctId: userId,
                event: "space created",
                properties: {
                    room,
                    exhibit_id: result.id,
                },
            });
            // Serverless functions can freeze before posthog-node sends the
            // event, so flush before returning. Never let an analytics failure
            // turn a successful creation into an error.
            await posthog.flush().catch(() => {});

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
