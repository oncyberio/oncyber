import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";

export const getPoapAssets = proc({
    cors: true,
    auth: true,

    // schema
    schema: z.object({
        userId: z.string(),
    }),

    // handler
    async handler(opts) {

        const userId = opts.userId;
        const options = {
            method: 'GET',
            headers: {
              accept: 'application/json',
              'x-api-key': process.env.POAP_API_KEY
            }
        };
        let result = await fetch('https://api.poap.tech/actions/scan/'+userId, options).then(x=>x.json())
        return result;
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;