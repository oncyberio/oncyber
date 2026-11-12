import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { createApp } from "utils/express";
import { optimizeExhibit } from "./optimizeExhibit";
import { Success, Error } from "utils/types";
import { optimizeAsset } from "./optimizeAsset";
import { canEditExhibit } from "utils/db";

const app = createApp({ cors: true, auth: true });

app.get("/asset", async (request, response) => {
    //

    const exhibitId = request.query.exhibitId as string;

    const assetId = request.query.assetId as string;

    const sendEvent = request.query.sendEvent as string;

    const force = request.query.force as string;

    if (exhibitId && !(await canEditExhibit(exhibitId, request["user"]))) {
        response.status(403).json(Error("Forbidden"));
        return;
    }

    try {
        //
        logger.info("optimizeAsset/start", {
            exhibitId,
            assetId,
            sendEvent,
            force,
            userId: request["user"],
        });

        const result = await optimizeAsset({
            exhibitId,
            assetId,
            userId: request["user"],
            sendEvent: !!sendEvent,
            force: !!force,
        });

        logger.info("optimizeAsset/success", { result });

        response.json(Success(result));

        //
    } catch (err) {
        //
        logger.error(err);

        response.status(500).json(Error(err.message));
    }
});

app.get("/exhibit", async (request, response) => {
    //

    const exhibitId = request.query.exhibitId as string;

    if (!(await canEditExhibit(exhibitId, request["user"]))) {
        response.status(403).json(Error("Forbidden"));
        return;
    }

    try {
        //
        logger.info("optimizeExhibit/start ...", { exhibitId });

        const result = await optimizeExhibit(exhibitId);

        logger.info("optimizeExhibit/success", { result });

        response.json(Success(result));

        //
    } catch (err) {
        //
        logger.error(err);

        response.status(500).json(Error(err.message));
    }
});

export const optimize_v2_ipfs = onRequest(
    { memory: "4GiB", timeoutSeconds: 540, cpu: 4 },
    app
);
