import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import crypto from "crypto";

//! if this leaks we need to clear all users informations from onesignal
const SUFFIX = process.env.ONESIGNAL_SUFFIX;

//? We're doing this because onesignal's api to get user infos are public, and so if we use a predictable id anyone can get the user's info (country, browser, device info, etc)
//? So we're generating an unpredictable id by hasing it with an unknown suffix
//? Devices IDs have the same issue, so we're using the hash of (window.navigator.userAgent + notificationId)

export const getUserNotificationId = (userId: string) => {
    if (!SUFFIX) throw new Error("ONESIGNAL_SUFFIX is not configured");
    const hash = crypto.createHash("sha256");
    hash.update(userId + SUFFIX);
    const hashedValueBuffer = hash.digest();
    return hashedValueBuffer.toString("hex");
}
    
export const getNotificationId = proc({
    cors: true,
    auth: true,

    // schema
    schema: z.object({}),

    // handler
    async handler() {
        try {

            const userNotificationId = getUserNotificationId(this.userId);

            return { success: true, id: userNotificationId };

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
