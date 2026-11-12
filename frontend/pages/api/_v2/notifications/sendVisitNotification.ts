import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { getExhibitById } from "pages/api/exhibit";
import { nodeEnv } from "@env";
import crypto from "crypto";
import { getUserNotificationId } from "./getNotificationId";

const ONE_SIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
const ONE_SIGNAL_APP_ID = nodeEnv.ONESIGNAL_APP_ID;

export const sendVisitNotification = proc({
    cors: true,
    auth: false,

    // schema
    schema: z.object({
        exhibitId: z.string(),
    }),

    // handler
    async handler(opts) {
        const exhibitId = opts.exhibitId;

        // Retrieve exhibit data by ID
        const exhibit = await getExhibitById(exhibitId);
        if (!exhibit) {
            return {
                success: false,
                err: "No exhibit found with the given ID.",
            };
        }
        const owner = exhibit.owner;

        if (!exhibit?.params?.enableNotifications) {
            return {
                success: false,
                err: "Notifications are disabled for this exhibit.",
            };
        }

        //* we hash the user it to make it more secure
        const userNotificationId = getUserNotificationId(owner);

        //* Send a notification
        const response = await fetch(
            "https://onesignal.com/api/v1/notifications",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Basic ${ONE_SIGNAL_API_KEY}`,
                },
                body: JSON.stringify({
                    app_id: ONE_SIGNAL_APP_ID,
                    include_aliases: {
                        external_id: [userNotificationId],
                    },
                    target_channel: "push",
                    template_id: nodeEnv.VISIT_TEMPLATE_ID,
                    data: {
                        gallery_id: exhibitId,
                        gallery_image: exhibit?.info?.cHeroImg,
                    },
                    url: "https://oncyber.io/spaces/" + exhibitId,
                    big_picture: exhibit?.info?.cHeroImg,
                    ios_attachments: {
                        id1: exhibit?.info?.cHeroImg,
                    },
                    huawei_big_picture: exhibit?.info?.cHeroImg,
                    chrome_web_image: exhibit?.info?.cHeroImg,
                    adm_big_picture: exhibit?.info?.cHeroImg,
                    chrome_big_picture: exhibit?.info?.cHeroImg,
                }),
            }
        );

        if (!response.ok) {
            console.error("[ VISIT NOTIFICATION ERROR ]", await response.text());
            return { success: false, err: "Failed to send notification." };
        }

        return { success: true };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
