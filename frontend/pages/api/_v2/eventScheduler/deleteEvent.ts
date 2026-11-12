import { z } from "zod";

import { proc, NoApi } from "@utils/rpc/server";

import { nodeEnv } from "@env";

import { db } from "@utils/firebaseAdmin";
import moment from "moment";

const ONE_SIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
const ONE_SIGNAL_APP_ID = nodeEnv.ONESIGNAL_APP_ID;

export const deleteEvent = proc({
    cors: true,
    auth: true,

    // schema
    schema: z
        .object({
            eventId: z.string().min(1),
        })
        .required(),

    async handler({ eventId }) {
        try {
            const docRef = db.collection("event-scheduler").doc(eventId);

            const doc = await docRef.get();

            if (!doc.exists) throw new Error("Document not found");

            const options = {
                method: "DELETE",
                headers: {
                    accept: "application/json",
                    Authorization: `Basic ${ONE_SIGNAL_API_KEY}`,
                },
            };

            const event = doc.data();

            if (event.userId.toLowerCase() !== this.userId.toLowerCase()) {
                return {
                    success: false,
                    message: "You are not allowed to delete this event",
                };
            }

            const date = moment.unix(event.date).subtract(5, "minutes");

            if (date.isAfter(moment(new Date()))) {
                await Promise.all(
                    (event.subscribedUsers || []).map(
                        async ({ notificationId }) => {
                            const response = await fetch(
                                `https://onesignal.com/api/v1/notifications/${notificationId}?app_id=${ONE_SIGNAL_APP_ID}`,
                                options
                            );

                            if (!response.ok) {
                                console.error(await response.text());
                                throw new Error(
                                    "Failed to delete notification"
                                );
                            }
                        }
                    )
                );
            }

            await docRef.delete();

            return { success: true };
        } catch (err) {
            console.error("Failed to delete notification", err);
            return {
                success: false,
                message: "Failed to delete event",
            };
        }
    },
});
