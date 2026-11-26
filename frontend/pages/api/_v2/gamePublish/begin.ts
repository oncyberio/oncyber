import { proc, NoApi } from "@utils/rpc/server";
import { publishBeginSchema } from "@features/games/publish/publishedGames";
import {
    assertMayPublish,
    beginPublish,
} from "@features/games/publish/publishedGamesServer";

/**
 * Start publishing a release: the id, the listing and the list of files
 * with their sizes and hashes. Nothing is stored yet but the intent; the
 * answer says where to send the files. The id must be free or the
 * caller's, and never a catalogued game's.
 */
export const begin = proc({
    auth: true,

    schema: publishBeginSchema,

    async handler(input) {
        assertMayPublish(this.userId);
        return beginPublish(this.userId, input);
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
