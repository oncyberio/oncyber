import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { findGame, gamesPreviewEnabled } from "@features/games/catalog";
import { readGameLeaderboard } from "@utils/firestore/gameResults";

/** A game's top players by wins. Public; names and totals only. */
export const leaderboard = proc({
    schema: z.object({ game: z.string().min(1).max(63) }),

    async handler({ game }) {
        // Games are hidden at launch, and so is what they record.
        if (!gamesPreviewEnabled() || !findGame(game))
            throw new Error("Unknown game");
        return { game, entries: await readGameLeaderboard(game) };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
