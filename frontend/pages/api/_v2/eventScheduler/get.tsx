import { z } from "zod";
import { db, fire } from "@utils/firebaseAdmin";
import { proc, NoApi } from "@utils/rpc/server";
import moment from "moment";
import { getUserProfilesByWalletIds } from "@utils/firestore/userProfiles";

export const getEvents = proc({
    cors: true,
    auth: false,

    // schema
    schema: z.object({}),

    // handler
    async handler(opts) {
        this.res.setHeader("Cache-Control", "private, no-store");
        let events = [];

        const currentUnixTimestamp = moment().unix();

        const snapshot = await db
            .collection("event-scheduler")
            .where("endDate", ">=", currentUnixTimestamp)
            .get();

        await Promise.all(
            snapshot.docs.map(async (doc) => {
                const payload = doc.data();

                const exhibitDoc = await db
                    .collection("exhibits")
                    .doc(payload.exhibitId)
                    .get();

                const exhibitData = exhibitDoc.data();
                const subscribers = Array.isArray(payload.subscribedUsers)
                    ? payload.subscribedUsers
                    : [];
                const ownSubscription = this.userId
                    ? subscribers.find((item) => item?.userId === this.userId)
                    : null;
                // Legacy anonymous subscriptions stored provider device IDs in
                // userId. Only resolved public account identities may appear
                // in the participant avatar list.
                const profiles = await getUserProfilesByWalletIds(
                    subscribers.map((item) => item?.userId)
                        .filter((id) => typeof id === "string" && id.length > 0 && !id.includes("/"))
                );
                const publicIds = new Set(
                    profiles.map((profile) => profile.walletId?.toLowerCase()).filter(Boolean)
                );

                events.push({
                    id: doc.id,
                    title: payload.title,
                    date: payload.date,
                    endDate: payload.endDate,
                    exhibitId: payload.exhibitId,
                    thumbnail: payload.thumbnail,
                    eventType: payload.eventType,
                    userId: payload.userId,
                    eventLocation: exhibitData?.info?.headline,
                    customLink: exhibitData?.info?.customLink || "",
                    // Participant identities are displayed by the existing UI;
                    // provider notification IDs and other private fields are not.
                    subscribedUsers: subscribers
                        .filter((item) => typeof item?.userId === "string" && publicIds.has(item.userId.toLowerCase()))
                        .map((item) => ({ userId: item.userId })),
                    subscriberCount: subscribers.length,
                    subscriptionNotificationId: typeof ownSubscription?.notificationId === "string"
                        ? ownSubscription.notificationId : null,
                });
            })
        );

        events.sort((a, b) => a.date - b.date);

        return events;
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
