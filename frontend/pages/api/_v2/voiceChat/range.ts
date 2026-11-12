import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { Failure, Result, Success } from "@utils/js";
import { pathUpdate } from "@utils/saveToDb";
import { updateExhibit } from "pages/api/exhibit";
import { checkMod } from "@api/social/isMod";

export const setRange = proc({
    //
    cors: true,
    auth: true,

    // schema
    schema: z.object({
        spaceId: z.string().min(1),
        range: z.number(),
    }),

    // handler
    async handler({ spaceId, range }): Promise<Result<number>> {
        //
        const _isMod = await checkMod(this.userId, spaceId);

        if (!_isMod) {
            return Failure("Unauthorized");
        }

        // Update exhibit

        let updateResult = await updateExhibit(
            spaceId,
            pathUpdate({
                options: {
                    voice_range: range,
                },
            }),
            this.userId,
            () => Success(undefined)
        );

        if (updateResult.success) {
            //
            console.log("[voiceChate/range]", "sending range event");

            return Success(range);
        } else {
            return Failure(updateResult.error || "Failed to save new range");
        }
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
