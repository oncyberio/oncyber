import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { db } from "@utils/firebaseAdmin";

// Spaces created on top of destination
export const getSpacesCreatedTopOfDest = proc({
    cors: true,
    auth: false,
    // schema
    schema: z.object({
        slug: z.string().min(1),
    }),

    async handler({ slug }) {
        let exhibits = [];

        const snapshot = await db
            .collection("exhibits")
            .where("info.room", "==", slug)
            .orderBy("number_of_visits", "desc")
            .limit(4)
            .get();

        if (snapshot.empty) {
            return [];
        }

        snapshot.forEach((doc) => {
            const data = doc.data();

            const info = data?.info || {};

            // @ts-ignore
            exhibits.push({ id: doc.id, ...info, owner: data?.owner });
        });

        return exhibits;
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
