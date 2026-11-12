import { Asset, is3DModel } from "utils/types";
import { getExhibitById } from "utils/db";
import { is3DAssetOptimized, optimize3DAsset } from "./optimize3DAsset";
import { is2DAssetOptimized, optimize2DAsset } from "./optimize2DAsset";

export interface OptimizeAssetByIdOpts {
    exhibitId: string;
    assetId: string;
    userId: string;
    sendEvent?: boolean;
    force?: boolean;
}

export async function optimizeAsset({
    exhibitId,
    assetId,
    userId,
    sendEvent = false,
    force = false,
}: OptimizeAssetByIdOpts) {
    //
    const exhibit = await getExhibitById(exhibitId);

    if (exhibit == null) {
        throw new Error("Not found exhibit " + exhibitId);
    }

    const asset = exhibit.artworks[assetId]?.data;

    if (asset == null) {
        throw new Error("Not found asset " + assetId);
    }

    if (!force && isAssetOptimized(asset)) {
        return {};
    }

    const result = await optimizeAssetImpl(exhibitId, asset, userId, sendEvent);

    return result;
}

export async function optimizeAssetImpl(
    exhibitId: string,
    asset: Asset,
    userId: string,
    sendEvent: boolean
) {
    //
    let result: any;

    if (is3DModel(asset)) {
        //
        result = await optimize3DAsset(exhibitId, asset, userId, sendEvent);
        //
    } else {
        //
        result = await optimize2DAsset(exhibitId, asset, userId, sendEvent);
    }

    return result;
}

export function isAssetOptimized(asset: Asset) {
    //
    if (is3DModel(asset)) {
        //
        return is3DAssetOptimized(asset);
    } else {
        //
        return is2DAssetOptimized(asset);
    }
}
