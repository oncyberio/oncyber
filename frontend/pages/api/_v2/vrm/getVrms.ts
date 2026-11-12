import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { db } from "@utils/firebaseAdmin";

export const getVrms = proc({
    //
    auth: true,
    cors: true,

    // schema
    schema: z.object({}),

    // handler
    async handler() {
        //

        let vrms = [];

        const data = await db
            .collection("vrm")
            .where("userId", "==", this.userId)
            .get();

        data.docs.map((doc) => {
            const payload = doc.data();

            vrms = [
                {
                    ...payload,
                    ...{ id: doc.id },
                },
                ...vrms,
            ];
        });

        return vrms;
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
