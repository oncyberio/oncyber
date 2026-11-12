import { z } from "zod";

import { proc, NoApi } from "@utils/rpc/server";

import { db } from "@utils/firebaseAdmin";
import { fetchUserByUsername, fetchUserByWalletId, getProfiles, getSpaceEditors } from "./utils";
import { isSignedInAs } from "@utils/auth/accountOwnership";

// `all` returns the whole document (e-mail, every space it belongs to), so
// only to the account's own session, as `me` does; anyone else gets the
// public shape.
function ownsUser(sessionUserId: string, user: any) {
    return (
        !!user &&
        [user.id, user.walletId].some((id) => isSignedInAs(sessionUserId, id))
    );
}

export const getUsers = proc({
    cors: true,
    // auth: true,

    schema: z.object({
        all: z.boolean().optional(),
        username: z.string().optional(),
        walletIds: z.array(z.string()).optional(),
        walletId: z.string().optional(),
        exhibitId: z.string().optional(),
        loadNumOfSpaces: z.boolean().optional(),
        type: z.literal("username").or(z.literal("editors")).or(z.literal("users")).or(z.literal("walletId")).optional(),
    }),

    async handler({ all, type, walletId, username, walletIds, loadNumOfSpaces, exhibitId }) {
        if (type === "username") {
            if (username[0] == "@") username = username.substr(1);

            let user = await fetchUserByUsername(username);
            if (all && ownsUser(this.userId, user)) {
                user = await fetchUserByUsername(username, all);
            }

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
        }

        if (type === "users") {
            const users = await getProfiles(walletIds || [], loadNumOfSpaces);

            return {
                success: true,
                editors: users,
            };
        }

        if (type === "editors") {
            const editors = await getSpaceEditors(exhibitId);

            if (!editors) {
                return {
                    success: false,
                    message: "Failed to get editors.",
                };
            }

            return {
                success: true,
                editors,
            };
        }

        if (type === "walletId") {
            const user = await fetchUserByWalletId(walletId);

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
        }
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
