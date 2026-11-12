import { z } from "zod";

import { proc, NoApi } from "@utils/rpc/server";

import cookie from "cookie";

import { cookieSettings } from "@utils/cookieSettings";

import { generateHash } from "./utils";

export const setAnonHash = proc({
    cors: true,

    schema: z.object({
        data: z.string(),
    }),

    async handler({ data }) {
        try {
            const fHash = await generateHash(data);

            this.res.setHeader(
                "Set-Cookie",
                cookie.serialize("_edit_hash", fHash, cookieSettings)
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
