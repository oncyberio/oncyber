import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { findGame, gamesPreviewEnabled } from "@features/games/catalog";
import { gameResultSchema, resultMembers } from "@features/games/gameResults";
import { recordGameResult } from "@utils/firestore/gameResults";

/**
 * Record the result of a match the signed-in visitor just played. The
 * result is stored under `this.userId` only (its own match record and its
 * own standing), once per match, and marked unverified: it is what one
 * browser reported.
 *
 * `agreedBy` is the page's "party agreed" verdict (docs/games/trust.md):
 * the room ids of the players whose pages all reported this same outcome.
 * It is taken only when it names exactly the people the result says played,
 * two or more of them; such a result is stored as `party-agreed` and counts
 * for the leaderboard. It is the reporting page's word: nothing here
 * compares the members' records yet.
 */
export const reportResult = proc({
    auth: true,

    schema: z.object({
        game: z.string().min(1).max(63),
        result: gameResultSchema,
        agreedBy: z.array(z.string().min(1).max(64)).max(16).optional(),
    }),

    async handler({ game, result, agreedBy }) {
        if (!this.userId) throw new Error("Unauthorized");
        // Games are hidden at launch, and so is what they record.
        if (!gamesPreviewEnabled() || !findGame(game))
            throw new Error("Unknown game");
        // Parsed again as plain data: no `name: undefined` reaches Firestore.
        const clean = JSON.parse(JSON.stringify(result));
        const played = [...resultMembers(clean)].sort();
        const agreed =
            played.length > 1 &&
            Array.isArray(agreedBy) &&
            [...new Set(agreedBy)].sort().join("\n") === played.join("\n");
        return recordGameResult(
            this.userId,
            game,
            clean,
            Date.now(),
            agreed ? "party-agreed" : "solo-unverified"
        );
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
