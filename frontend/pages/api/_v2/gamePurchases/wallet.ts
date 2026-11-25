import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { gamesPreviewEnabled } from "@features/games/catalog";
import { purchasesMode } from "@features/games/gamePurchases";
import { walletPaymentConfig } from "@features/games/walletPayment";
import { walletTokenCents } from "@utils/purchaseChain";
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
            // An account that is a wallet: what it holds is read from the
            // chain, to show. Any other account pays from a wallet chosen
            // at the time, and has no balance to show here.
            const address = /^0x[0-9a-fA-F]{40}$/.test(this.userId)
                ? this.userId.toLowerCase()
                : "";
            const cents =
                chain && address
                    ? await walletTokenCents(chain, address)
                    : null;
            return {
                mode,
                cents: cents ?? 0,
                network: chain?.chainName ?? "",
                token: chain?.tokenSymbol ?? "",
                ...(address && cents !== null ? { address } : {}),
            };
        }
        return { mode, cents: await rail.balance(this.userId) };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
