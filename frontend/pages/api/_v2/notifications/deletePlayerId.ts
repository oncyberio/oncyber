import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { db } from "@utils/firebaseAdmin";
import { nodeEnv } from "@env";

// const ONE_SIGNAL_APP_ID = nodeEnv.ONESIGNAL_APP_ID;
// const ONE_SIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

export const deletePlayerId = proc({
    cors: true,
    auth: true,

    // schema
    schema: z.object({
        id: z.string(),
    }),

    // handler
    async handler(opts) {
        try {
            const userDocRef = db
                .collection("users-onesignal-ids")
                .doc(this.userId);
            const doc = await userDocRef.get();

            if (!doc.exists) {
                return { success: false, err: "User not found" };
            }

            let devicesData = doc.data().devices;
            devicesData = devicesData.filter(
                (device) => device.id !== opts.id
            );

            await userDocRef.update({ devices: devicesData });
            
            const response = await fetch(
                `https://onesignal.com/api/v1/apps/app_id/users/by/external_id/${opts.id}`,
                {
                    method: "DELETE",
                    headers: {
                        // Authorization: `Basic ${ONE_SIGNAL_API_KEY}`,
                        accept: "application/json",
                        "content-type": "application/json",
                    },
                }
            ).then((response) => response.json());

            return { success: true };
        } catch (error) {
            console.error(error);
            return { success: false, err: error.message };
        }
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
