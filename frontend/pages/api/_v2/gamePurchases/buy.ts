import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { findGame, gamesPreviewEnabled } from "@features/games/catalog";
import {
    gameProducts,
    purchaseFeePercent,
    purchasesMode,
    PURCHASE_LIMITS,
} from "@features/games/gamePurchases";
import { TRANSACTION_HASH } from "@features/games/walletPayment";
import { purchaseProduct } from "@utils/firestore/gamePurchases";
import { railFor } from "./rail";

/**
 * Buy one product of a game for the signed-in visitor, after the visitor
 * said yes on the page's own confirmation. The price is the declared one,
 * read here: nothing the caller sends sets what is charged. `key` is the
 * page's id for that confirmation; sending it again never charges again.
 *
 * A refusal the visitor can act on comes back as `{ bought: false, reason }`
 * rather than an error, so the page can say what happened.
 */
export const buy = proc({
    auth: true,

    schema: z.object({
        game: z.string().min(1).max(63),
        product: z.string().regex(PURCHASE_LIMITS.product),
        key: z.string().regex(PURCHASE_LIMITS.request),
        // Where the visitor pays from their own wallet: the hash of the
        // transaction they sent for this order.
        proof: z.string().regex(TRANSACTION_HASH).optional(),
    }),

    async handler({ game, product, key, proof }) {
        if (!this.userId) throw new Error("Unauthorized");
        // Games are hidden at launch, and so is what they sell.
        if (!gamesPreviewEnabled() || !findGame(game))
            throw new Error("Unknown game");
        const rail = railFor(purchasesMode());
        if (!rail)
            return { bought: false as const, reason: "unavailable" as const };
        const declared = gameProducts(game)[product];
        if (!declared)
            return { bought: false as const, reason: "undeclared" as const };
        return purchaseProduct({
            userId: this.userId,
            game,
            product: declared,
            key,
            rail,
            proof,
            feePercent: purchaseFeePercent(),
        });
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
