import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { auth, db, fire } from "@utils/firebaseAdmin";
import { unlinkAccount } from "./authenticate/utils/link";
// import { setRefreshAndTokenCookie, AUTH_COOKIE } from "./utils/cookie";

export const unlink = proc({
    cors: true,
    auth: true,
    schema: z.object({
        accountToUnlink: z.string().optional(),
    }),
    async handler({ accountToUnlink }) {
        try {
            const uid = this.userId;

            return await unlinkAccount({
                accountToUnlink: accountToUnlink,
                accountId: uid,
            });
        } catch (err) {
            console.log("[ UNLINK ERROR ]", err);

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
