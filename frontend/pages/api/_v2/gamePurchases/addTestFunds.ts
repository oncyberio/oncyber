import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { gamesPreviewEnabled } from "@features/games/catalog";
import { purchasesMode, TEST_FUNDS } from "@features/games/gamePurchases";
import { addTestFunds as add } from "@utils/firestore/gamePurchases";

/**
 * Add play money to the signed-in visitor's test balance. Only where the
 * test rail is the one in use: on any other deployment this is refused, so
 * it can never top up a real wallet.
 */
export const addTestFunds = proc({
    auth: true,

    schema: z.object({}),

    async handler() {
        if (!this.userId) throw new Error("Unauthorized");
        if (!gamesPreviewEnabled() || purchasesMode() !== "test")
            throw new Error("Test funds are not available here");
        return { cents: await add(this.userId, TEST_FUNDS.stepCents) };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
