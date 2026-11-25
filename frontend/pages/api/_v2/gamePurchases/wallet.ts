import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { gamesPreviewEnabled } from "@features/games/catalog";
import { purchasesMode } from "@features/games/gamePurchases";
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
        return { mode, cents: await rail.balance(this.userId) };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
