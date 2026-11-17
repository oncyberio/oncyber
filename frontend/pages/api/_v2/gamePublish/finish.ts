import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { UPLOAD_ID } from "@features/games/publishedGames";
import {
    assertMayPublish,
    finishPublish,
} from "@features/games/publishedGamesServer";

/**
 * Register an uploaded release: every file is verified against the hashes
 * `begin` took, and only then is the game's record written. `address` is
 * for upload mode `pinata` only: the CID the storage gave the folder.
 */
export const finish = proc({
    auth: true,

    schema: z.object({
        uploadId: z.string().regex(UPLOAD_ID),
        address: z.string().min(1).max(128).optional(),
    }),

    async handler(input) {
        assertMayPublish(this.userId);
        return finishPublish(this.userId, input);
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
