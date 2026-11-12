import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { db } from "@utils/firebaseAdmin";
import { nodeEnv } from "@env";

const ONE_SIGNAL_APP_ID = nodeEnv.ONESIGNAL_APP_ID;
// const ONE_SIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

export const getUserDevices = proc({
    cors: true,
    auth: true,

    // schema
    schema: z.object({}),

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

            const devicesData = doc.data().devices;

            if(!devicesData?.length) {
                return { success: true, data: [] };
            }

            const deviceInfoArray = [];

            for (let device of devicesData) {

                if(!device.id) continue;

                deviceInfoArray.push({
                    deviceName: device.deviceName,
                    subscriptionDate: device.subscriptionDate,
                    id: device.id,
                });
            }

            return { success: true, data: deviceInfoArray };
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