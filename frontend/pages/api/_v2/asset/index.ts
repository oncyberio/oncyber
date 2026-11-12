//
import { api } from "@utils/rpc/server";
import { getMediaInfo } from "./getMediaInfo";
import { getPoapAssets } from "./getPoapAssets";
import { getPoapOwners } from "./getPoapOwners";
import {
    uploadOverwriteAsset,
    getSharedAssets,
    saveSharedAssets,
    getAssets,
    getChainAssets,
    uploadVideoPreview,
} from "./assetOperations";

const AssetService = {
    // Services
    getMediaInfo,
    getPoapAssets,
    getPoapOwners,
    uploadOverwriteAsset,
    getSharedAssets,
    saveSharedAssets,
    getAssets,
    getChainAssets,
    uploadVideoPreview,
    //...
};

export default api(AssetService);
