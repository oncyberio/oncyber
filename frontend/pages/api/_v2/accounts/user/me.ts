import { z } from "zod";

import { proc, NoApi } from "@utils/rpc/server";

import { db } from "@utils/firebaseAdmin";
import { fetchUserByWalletId } from "./utils";

export const me = proc({
    cors: true,
    auth: true,

    schema: z.object({
        all: z.boolean().optional(),
    }),

    async handler({ all }) {
        const user = await fetchUserByWalletId(this.userId, all);

        if (!user) {
            return {
                success: false,
                message: "User not found",
            };
        }

        return {
            success: true,
            ...user,
        };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
