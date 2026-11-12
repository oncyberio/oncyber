import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { db } from "@utils/firebaseAdmin";

export const getSubscription = proc({
    cors: true,
    auth: true,

    // schema
    schema: z.object({
        id: z.string(),
        deviceName: z.string(),
    }),

    // handler
    async handler(opts) {
        try {
            const userDocRef = db
                .collection("users-onesignal-ids")
                .doc(this.userId);
            const doc = await userDocRef.get();

            const deviceData = {
                deviceName: opts.deviceName,
                subscriptionDate: Date.now(),
                id: opts.id,
            };

            if (doc.exists && doc.data().devices?.length > 0) {
                let devicesData = doc.data().devices;
                if (!devicesData.some((device) => device.id === opts.id)) {
                    devicesData.push(deviceData);
                }
                await userDocRef.update({ devices: devicesData });
            } else {
                await userDocRef.set({
                    devices: [deviceData],
                });
            }

            return { success: true };
        } catch (error) {
            console.error("[ NOTIFICATION SUBSCRIPTION ERROR ]", error);
            return { success: false, err: error.message };
        }
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
