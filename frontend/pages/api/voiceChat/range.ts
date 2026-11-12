import { Failure, Success } from "@utils/js";
import { auth } from "@utils/middlewares/authMiddleware";
import { corsMiddleware } from "@utils/middlewares/corsMiddleware";
import { pathUpdate } from "@utils/saveToDb";
import { updateExhibit } from "../exhibit";

import { isMod } from "../social/isMod";

export default async function handler(req, res) {
    await corsMiddleware(req, res);

    try {
        if (req.body && typeof req.body === "string") {
            req.body = JSON.parse(req.body);
        }

        const exhibitId = req.body?.payload?.exhibit;
        const range = +req.body?.payload?.range;

        if (!exhibitId) {
            return res.status(400).json(Failure("Missing exhibit id"));
        }

        if (isNaN(range)) {
            return res
                .status(400)
                .json(Failure("Invalid range value " + req.body.range));
        }

        const userId = await auth(req);

        const _isMod = await isMod(userId, exhibitId);

        if (!_isMod) {
            return res.status(401).json(Failure("Unauthorized"));
        }

        // Update exhibit

        let updateResult = await updateExhibit(
            exhibitId,
            pathUpdate({
                options: {
                    voice_range: range,
                },
            }),
            userId,
            () => Success(undefined)
        );

        if (updateResult.success) {
            console.log("[voiceChate/range]", "sending range event");

            // database.ref("/exhibits/" + exhibitId).push({
            //     type: "VOICE_RANGE_CHANGED",
            //     payload: {
            //         range,
            //     },
            //     walletId: userId,
            //     isServerEvent: true,
            //     timestamp: new Date().getTime() + 1000 * 10,
            // });
        }
        return res.json(Success(range));
    } catch (err) {
        console.error("[/voiceChat/range]");
        return res.status(500).json(Failure("Unexpected error"));
    }
}
