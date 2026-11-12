import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";

/** The legacy gallery script generator is retired. No provider is contacted. */
export const getScript = proc({
    cors: true,
    auth: true,
    schema: z.object({ prompt: z.string() }),
    async handler(_opts) {
        return { success: false, data: "", err: "Gallery custom scripts have been retired" };
    },
});

export default NoApi;
