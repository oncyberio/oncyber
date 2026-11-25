import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { gamesPreviewEnabled } from "@features/games/catalog";
import { purchasesMode } from "@features/games/gamePurchases";
import { walletPaymentConfig } from "@features/games/walletPayment";
import { railFor } from "./rail";

/**
 * The signed-in visitor's wallet: whether purchases are on here, how they
 * are paid for, and what the visitor can spend. Never anyone else's.
 */
export const wallet = proc({
    auth: true,

    schema: z.object({}),

    async handler() {
        if (!this.userId) throw new Error("Unauthorized");
        const mode = gamesPreviewEnabled() ? purchasesMode() : "off";
        const rail = railFor(mode);
        if (!rail) return { mode: "off" as const, cents: 0 };
        // A rail the visitor pays themselves holds nothing for them: the
        // page names the network instead of a balance.
        if (!rail.balance) {
            const chain = walletPaymentConfig();
            return {
                mode,
                cents: 0,
                network: chain?.chainName ?? "",
                token: chain?.tokenSymbol ?? "",
            };
        }
        return { mode, cents: await rail.balance(this.userId) };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
