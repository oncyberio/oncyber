import { z } from "zod";

import { proc, NoApi } from "@utils/rpc/server";

import { getEventSchedulerById } from "./utils/getEventById";

import { unsubscribe } from "./utils/subscription";

import { nodeEnv } from "@env";

const ONE_SIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
const ONE_SIGNAL_APP_ID = nodeEnv.ONESIGNAL_APP_ID;

export const cancelNotification = proc({
    cors: true,
    auth: true,

    // schema
    schema: z
        .object({
            eventId: z.string().min(1),
            notificationId: z.string().min(1),
        })
        .required(),

    async handler({ eventId, notificationId }) {
        const event = await getEventSchedulerById(eventId);
        const ownsSubscription = this.userId &&
            Array.isArray(event?.subscribedUsers) &&
            event.subscribedUsers.some((subscription) =>
                subscription.userId === this.userId &&
                subscription.notificationId === notificationId
            );
        if (!ownsSubscription) throw new Error("Unauthorized");

        const options = {
            method: "DELETE",
            headers: {
                accept: "application/json",
                Authorization: `Basic ${ONE_SIGNAL_API_KEY}`,
            },
        };

        const response = await fetch(
            `https://onesignal.com/api/v1/notifications/${encodeURIComponent(notificationId)}?app_id=${ONE_SIGNAL_APP_ID}`,
            options
        );

        if (!response.ok) {
            console.error(await response.text());
            return { success: false, err: "Failed to cancel notification." };
        }

        await unsubscribe({ eventId, notificationId, userId: this.userId });
        return { success: true };
    },
});
