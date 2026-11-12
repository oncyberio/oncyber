import * as logger from "firebase-functions/logger";
import {
    isAssetOptimized,
    optimizeAsset,
    optimizeAssetImpl,
} from "./optimizeAsset";
import { getExhibitById, quickUpdate } from "utils/db";
import { delay } from "utils/js";
import { Asset, Success } from "utils/types";

const one_day = 24 * 60 * 60 * 1000;

const FLAG_FIELD = "cloud_optimizing";

export async function optimizeExhibit(exhibitId: string) {
    //
    try {
        const exhibit = await getExhibitById(exhibitId);

        if (exhibit == null) {
            throw new Error("Not found");
        }

        const cloud_optimizing = exhibit[FLAG_FIELD] || 0;

        const now = Date.now();

        // We check if the cloud_optimizing field is being there for more than a day.
        // if so then the cloud function was killed before clearing the  field
        if (now - cloud_optimizing < one_day) {
            // Exhibit is already being optimized
            logger.info("Exhibit is already being optimized", {
                exhibitId,
            });
            return;
        }

        await quickUpdate(exhibitId, [FLAG_FIELD], Date.now());

        const assets = Object.values(exhibit.artworks || {});

        let unoptimized: Asset[] = assets
            .map((it: any) => it.data)
            .filter((data) => {
                return !isAssetOptimized(data);
            });

        // const token = getToken(exhibit.owner);

        const result = await Promise.all(
            unoptimized.map((asset) => {
                return optimizeAssetImpl(
                    exhibit.id,
                    asset,
                    asset.owner.address,
                    false
                )
                    .then((update) => {
                        return {
                            assetId: asset.id,
                            name: asset.name,
                            status: "success",
                            update,
                        };
                    })
                    .catch((error) => {
                        return {
                            assetId: asset.id,
                            name: asset.name,
                            status: "error",
                            error: error.message || "Unknown error",
                        };
                    });
            })
        );

        return result;
    } finally {
        // delete field
        await quickUpdate(exhibitId, [FLAG_FIELD], undefined);
    }
    //
}
