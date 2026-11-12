import { onRequest } from "firebase-functions/v2/https";
import { canEditExhibit } from "utils/db";
import * as logger from "firebase-functions/logger";

import { uploadExhibitPreviews } from "../utils/uploadExhibitHeroImgs_ipfs";
import { createApp } from "../utils/express";
import { Success, Error } from "../utils/types";
import { uploadImage as uploadImageIPFS } from "utils/ipfsUpload";

const app = createApp({ cors: true, auth: true });

app.post("/exhibitPreview", async (request, response) => {
    //

    const { exhibitId, heroImg, heroImg360, portalId, fHeroImg } = request.body;

    // @ts-ignore
    const userId = request.user as string;

    if (!(await canEditExhibit(exhibitId, userId))) {
        response.status(403).json(Error("Forbidden"));
        return;
    }

    try {
        //
        logger.info("uploadExhibitPreview_ipfs/start", {
            exhibitId,
            portalId,
        });

        const result = await uploadExhibitPreviews({
            exhibitId,
            portalId,
            userId,
            heroImg,
            heroImg360,
            fHeroImg,
        });

        logger.info("uploadExhibitPreview_ipfs/success", { result });

        response.json(Success(result));

        //
    } catch (err) {
        //
        logger.error(err);

        response.status(500).json(Error(err.message));
    }
});

app.post("/image", async (request, response) => {
    //

    const { url } = request.body;

    // @ts-ignore
    const userId = request.user as string;

    try {
        //
        logger.info("uploadImage/start", {
            url,
            userId,
        });

        const result = await uploadImageIPFS(url, userId);

        logger.info("uploadImage/success", { result });

        response.json(Success(result));

        //
    } catch (err) {
        //
        logger.error(err);

        response.status(500).json(Error(err.message));
    }
});

export const upload_v2_ipfs = onRequest(
    { memory: "4GiB", timeoutSeconds: 540 },
    app
);
