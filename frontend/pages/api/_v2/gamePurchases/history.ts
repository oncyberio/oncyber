import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { gamesPreviewEnabled } from "@features/games/catalog";
import { readPurchaseHistory } from "@utils/firestore/gamePurchases";

/** What the signed-in visitor bought, in every game, newest first. */
export const history = proc({
    auth: true,

    schema: z.object({ limit: z.number().int().min(1).max(50).optional() }),

    async handler({ limit }) {
        if (!this.userId) throw new Error("Unauthorized");
        if (!gamesPreviewEnabled()) return { purchases: [] };
        return { purchases: await readPurchaseHistory(this.userId, limit) };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
