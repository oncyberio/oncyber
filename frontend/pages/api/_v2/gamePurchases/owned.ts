import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { findGame, gamesPreviewEnabled } from "@features/games/catalog";
import { gameProducts } from "@features/games/gamePurchases";
import { readOwnedProducts } from "@utils/firestore/gamePurchases";

/** The permanent products of one game the signed-in visitor holds. */
export const owned = proc({
    auth: true,

    schema: z.object({ game: z.string().min(1).max(63) }),

    async handler({ game }) {
        if (!this.userId) throw new Error("Unauthorized");
        if (!gamesPreviewEnabled() || !findGame(game))
            throw new Error("Unknown game");
        const permanent = Object.values(gameProducts(game))
            .filter((product) => product.kind === "permanent")
            .map((product) => product.id);
        return {
            game,
            products: await readOwnedProducts(this.userId, game, permanent),
        };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
