import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";

export const getPoapOwners = proc({
    cors: true,
    auth: false,

    // schema
    schema: z.object({
        poapId: z.number(),
        page: z.number(),
        pagesize: z.number(),
    }),

    // handler
    async handler(opts) {

        const options = {
            method: 'GET',
            headers: {
              accept: 'application/json',
              'x-api-key':  process.env.POAP_API_KEY
            }
        };

        let result = await  fetch(`https://api.poap.tech/event/${opts.poapId}/poaps?limit=${opts.pagesize}&offset=${opts.page*opts.pagesize}`, options)
            .then(response => response.json())
        return result;
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;