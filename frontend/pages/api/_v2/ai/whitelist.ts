import { z } from "zod";

import { proc, NoApi } from "@utils/rpc/server";

// The CMS API token is a server-only secret (CYBER_CMS_API_TOKEN), read from
// the environment on every request and never written here. Without it the
// check fails closed: nobody is whitelisted and the CMS is not called.
function cmsToken() {
    const token = process.env.CYBER_CMS_API_TOKEN;
    return typeof token === "string" && token.trim() ? token.trim() : null;
}

const NOT_WHITELISTED = { success: false, message: "You are not whitelisted." };

export const isWhitelisted = proc({
    cors: true,
    auth: false,

    // schema
    schema: z.object({
        walletId: z.string(),
    }),

    // handler
    async handler(opts) {
        const token = cmsToken();
        if (!token) return NOT_WHITELISTED;

        try {
            const response = await fetch(
                `https://cyber-cms-ef9hl.ondigitalocean.app/api/lists/1`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            // A refused or failed CMS request never whitelists, whatever its
            // body says.
            if (!response.ok) return NOT_WHITELISTED;

            const data = await response.json();

            if (!data?.data?.attributes?.users) return NOT_WHITELISTED;

            if (
                data.data.attributes.users
                    .map((w) => w.toLowerCase())
                    .includes(opts.walletId.toLowerCase())
            ) {
                return { success: true, message: "You are whitelisted." };
            }

            return NOT_WHITELISTED;
        } catch {
            // Errors can carry the request's credentials; don't log them.
            return NOT_WHITELISTED;
        }
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
