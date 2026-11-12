import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { getEventSchedulerById } from "./utils/getEventById";
import { subscribe, unsubscribe } from "./utils/subscription";
import { nodeEnv } from "@env";
import crypto from "crypto";
import moment from "moment";
import { getUserNotificationId } from "@api/notifications/getNotificationId";
import { db } from "@utils/firebaseAdmin";

const ONE_SIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

const ONE_SIGNAL_APP_ID = nodeEnv.ONESIGNAL_APP_ID;

export const sendNotification = proc({
    cors: true,
    auth: true,

    // schema
    schema: z.object({
        eventId: z.string().min(1),
    }),

    // handler
    async handler(opts) {
        const eventId = opts.eventId;
        const userId = this.userId;
        if (!userId) throw new Error("Unauthorized");

        // Retrieve event data by ID
        const event = await getEventSchedulerById(eventId);

        if (!event) {
            return {
                success: false,
                err: "No event found with the given ID.",
            };
        }


        const exhibitId = event?.exhibitId;

        const date = moment.unix(event.date);

        const exhibitDoc = await db.collection("exhibits").doc(exhibitId).get();

        if (!exhibitDoc.exists) {
            return {
                success: false,
                message: "Space doesn't exist",
            };
        }

        const exhibit = exhibitDoc.data();

        const send_after = date
            .subtract(5, "minutes")
            .utc()
            .format("YYYY-MM-DD HH:mm:ss");

        const payload: any = {
            app_id: ONE_SIGNAL_APP_ID,
            target_channel: "push",
            template_id: nodeEnv.EVENTS_SCHEDULE_TEMPLATE_ID,
            custom_data: {
                event_id: event?.id,
                event_name: event?.title,
                space_slug: exhibitId,
                space_real_slug: exhibit.info?.customLink || "",
                event_thumbnail: event?.thumbnail,
            },
            url: "https://oncyber.io/spaces/" + exhibitId,
            send_after,
        };

        // The recipient is derived from the authenticated account. Never
        // accept a caller-selected device subscription ID.
        payload.include_aliases = {
            external_id: [getUserNotificationId(userId)],
        };

        //* Send a notification
        const response = await fetch(
            "https://onesignal.com/api/v1/notifications",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Basic ${ONE_SIGNAL_API_KEY}`,
                },
                body: JSON.stringify(payload),
            }
        );

        if (!response.ok) {
            console.error(await response.text());

            const errorMsg = await response.text();

            return {
                success: false,
                err: errorMsg || "Failed to send notification.",
            };
        }

        const data = await response.json();

        const notificationId = data?.id;

        if (!notificationId) {
            throw new Error("Failed to save notification");
        }

        await subscribe({ eventId, notificationId, userId: userId });

        return { success: true, notificationId };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
