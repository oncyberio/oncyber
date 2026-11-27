import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { fieldReport } from "@features/games/health/fieldReport";
import { assertMayPublish } from "@features/games/publish/publishedGamesServer";

/**
 * A game's field health for whoever made it (`oncyber health`): how fast
 * it starts and runs on real visits, by device, what broke, and what
 * those numbers ask for. The game's own account, or a site admin.
 */
export const health = proc({
    auth: true,

    schema: z.object({ id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/) }),

    async handler({ id }) {
        assertMayPublish(this.userId);
        return fieldReport(this.userId, id);
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
