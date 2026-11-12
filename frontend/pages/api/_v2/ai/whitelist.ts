import { z } from "zod";

import { proc, NoApi } from "@utils/rpc/server";

// Wallets allowed to use the studio AI assistant, from the server-only
// AI_WHITELIST variable (comma- or space-separated). Read on every request so
// a change takes effect without a redeploy of the code. Blank allows nobody.
export function whitelistedWallets(value = process.env.AI_WHITELIST) {
    if (typeof value !== "string") return new Set<string>();
    return new Set(
        value
            .split(/[\s,]+/)
            .map((wallet) => wallet.trim().toLowerCase())
            .filter(Boolean)
    );
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
        if (whitelistedWallets().has(opts.walletId.toLowerCase())) {
            return { success: true, message: "You are whitelisted." };
        }
        return NOT_WHITELISTED;
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
