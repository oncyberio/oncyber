import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { findGame, gamesPreviewEnabled } from "@features/games/catalog";
import { gameResultSchema } from "@features/games/gameResults";
import { recordGameResult } from "@utils/firestore/gameResults";

/**
 * Record the result of a match the signed-in visitor just played. The
 * result is stored under `this.userId` only (its own match record and its
 * own standing), once per match, and marked unverified: it is what one
 * browser reported.
 */
export const reportResult = proc({
    auth: true,

    schema: z.object({
        game: z.string().min(1).max(63),
        result: gameResultSchema,
    }),

    async handler({ game, result }) {
        if (!this.userId) throw new Error("Unauthorized");
        // Games are hidden at launch, and so is what they record.
        if (!gamesPreviewEnabled() || !findGame(game))
            throw new Error("Unknown game");
        // Parsed again as plain data: no `name: undefined` reaches Firestore.
        const clean = JSON.parse(JSON.stringify(result));
        return recordGameResult(this.userId, game, clean);
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
