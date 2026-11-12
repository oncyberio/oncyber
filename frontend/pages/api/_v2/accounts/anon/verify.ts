import { z } from "zod";

import { proc, NoApi } from "@utils/rpc/server";

import { generateHash } from "./utils";

export const verifyAnonHash = proc({
    cors: true,

    schema: z.object({
        data: z.string(),
    }),

    async handler({ data }) {
        try {
            const fHash = await generateHash(data);

            const prevHash = this.req?.cookies["_edit_hash"];

            console.log(" [ HASH ] ", fHash, prevHash);

            return {
                success: fHash === prevHash,
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
