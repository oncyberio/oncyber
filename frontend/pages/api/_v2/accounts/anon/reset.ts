import { z } from "zod";

import { proc, NoApi } from "@utils/rpc/server";

import { generateHash } from "./utils";

import cookie from "cookie";

import { cookieSettings } from "@utils/cookieSettings";

import dayjs from "dayjs";

export const resetAnon = proc({
    cors: true,

    schema: z.object({}),

    async handler({}) {
        try {
            this.res.setHeader(
                "Set-Cookie",
                cookie.serialize("_edit_hash", "", {
                    ...cookieSettings,
                    expires: dayjs("1970-01-01").toDate(),
                    maxAge: 0,
                })
            );

            return {
                success: true,
            };
        } catch (err) {
            return {
                success: false,
                message: err.toString(),
            };
        }
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
