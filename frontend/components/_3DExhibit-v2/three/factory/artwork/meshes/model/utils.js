// @ts-check

import { artworkVersion } from "@components/_3DExhibit-v2/three/utils/spaceutils";
import { ENVMAPS } from "@components/_3DExhibit-v2/utils/envmaps";

/**
 * @param { import("@uitypes/Asset").FetchedAsset } asset
 *
 * @returns { import("@gltypes").EnvironmentParams }
 */
export function getModelEnv (asset, envmap) {
    const isKong = asset?.external_link?.includes?.(
        "cyberkongz.com/kong-vx"
    )

    let envmapParams = ENVMAPS.studio;

    if (typeof envmap !== "undefined") {
        if (ENVMAPS[envmap]) {
            envmapParams = ENVMAPS[envmap];
        }
    } else {
        if(isKong) {
            envmapParams = ENVMAPS.vig;
        }
        else {
            envmapParams = ENVMAPS.studio;
        }
    }

    return envmapParams;
}

export function getScaleCorrection(asset) {
    const isKong = asset?.external_link?.includes?.(
        "cyberkongz.com/kong-vx"
    )

    return isKong ? 0.05 : 1;
}

/**
 *
 * @param { import("@uitypes/experience").ArtworkData } item
 * @returns
 */
export function shouleCenterModel(item) {
    return artworkVersion(item) >= 1
}
