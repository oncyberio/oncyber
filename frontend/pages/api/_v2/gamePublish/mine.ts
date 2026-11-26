import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import {
    assertMayPublish,
    minePublished,
} from "@features/games/publish/publishedGamesServer";

/** The games the signed-in account has published. */
export const mine = proc({
    auth: true,

    schema: z.object({}).optional(),

    async handler() {
        assertMayPublish(this.userId);
        return minePublished(this.userId);
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
