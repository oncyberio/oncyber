import { z } from "zod";

import { proc, NoApi } from "@utils/rpc/server";

import dayjs from "dayjs";

import cookie from "cookie";

export const logout = proc({
    cors: true,

    auth: true,

    schema: z.object({
        accountId: z.string().optional(),
    }),

    async handler({ accountId }) {
        const _cookie = cookie.serialize(
            accountId || this.req?.cookies?.["_CCA"],
            "",
            {
                httpOnly: true,
                path: "/",
                secure: true,
                expires: dayjs("1970-01-01").toDate(),
                maxAge: 0,
            }
        );

        this.res.setHeader("Set-Cookie", _cookie);

        return { success: true };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
