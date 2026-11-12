import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";

export const greet = proc({
    // schema
    schema: z.object({
        name: z.string(),
    }),

    // handler
    async handler(x) {
        // throw new Error("no greet")
        return { user: x.name };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
