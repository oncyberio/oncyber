import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { PUBLISH_ID } from "@features/games/publish/publishedGames";
import {
    assertMayPublish,
    unpublishGame,
} from "@features/games/publish/publishedGamesServer";

/**
 * Take a game down: its page stops loading and its releases stop being
 * served. Only the owner; the id stays theirs.
 */
export const unpublish = proc({
    auth: true,

    schema: z.object({ id: z.string().regex(PUBLISH_ID) }),

    async handler({ id }) {
        assertMayPublish(this.userId);
        return unpublishGame(this.userId, id);
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
