import { z } from "zod";

import { proc, NoApi } from "@utils/rpc/server";

import dayjs from "dayjs";

import cookie from "cookie";

import { auth, db, fire } from "@utils/firebaseAdmin";
import { validateSig } from "../authenticate/utils/utils";

export const activateSocial = proc({
    cors: true,

    auth: true,

    schema: z.object({
        isActive: z.boolean(),
        twitterHandle: z.string().optional(),
        sig: z.string().optional(),
    }),

    async handler({ isActive, sig, twitterHandle }) {
        const userId = this.userId;

        if (twitterHandle) {
            if (!sig) return { success: false, message: "Invalid signature" };

            const isValid = await validateSig({
                sig: {
                    sig,
                    type: "web2",
                },
                owner: userId,
                req: this.req,
            });

            if (!isValid) {
                return {
                    success: false,
                    message: "Invalid signature",
                };
            }
        }

        try {
            return await db.runTransaction(async (transaction) => {
                const userRef = db.collection("users").doc(userId);

                const userDoc = await transaction.get(userRef);

                const user = userDoc.data();

                if (!user) {
                    throw new Error("User not found");
                }

                let payload: any = null;

                if (user.socials?.twitter) {
                    payload = {
                        socials: {
                            ...user.socials,
                            twitter: {
                                ...user.socials.twitter,
                                active: isActive,
                            },
                        },
                    };
                }

                if (twitterHandle) {
                    payload = {
                        socials: {
                            ...(user?.socials || {}),
                            twitter: {
                                handle: twitterHandle,
                                active: isActive,
                            },
                        },
                    };
                }

                if (payload) {
                    await transaction.update(userRef, payload);

                    return { success: true, socials: payload.socials };
                }

                return { success: true, socials: {} };
            });
        } catch (err) {
            return {
                success: false,
                message: err.message,
            };
        }
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
