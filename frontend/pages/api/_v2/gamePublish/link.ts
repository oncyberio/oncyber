import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { GAME_SLUG } from "@features/games/gameSlug";
import { PUBLISH_ID } from "@features/games/publish/publishedGames";
import {
    assertMayPublish,
    setGameLink,
} from "@features/games/publish/publishedGamesServer";

/**
 * Give a published game its short address, /<slug>, change it, or (with
 * `slug: null`) give it up. Only the game's owner. The name must be free:
 * not a page of the site, not a space's link, not another game's
 * (docs/games/publishing.md). The game stays at /games/<id> either way.
 */
export const link = proc({
    auth: true,

    schema: z.object({
        id: z.string().regex(PUBLISH_ID),
        slug: z.string().regex(GAME_SLUG).nullable(),
    }),

    async handler({ id, slug }) {
        assertMayPublish(this.userId);
        return setGameLink(this.userId, id, slug);
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
