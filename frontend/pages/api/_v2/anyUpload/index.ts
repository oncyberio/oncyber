//
import { api } from "@utils/rpc/server";
import { updateUpload } from "./updateUpload";
import { deleteUploads } from "./deleteUploads";
import {  getAssetsByHash } from "./getAssetsByHash"
import { getUploadedAssets } from "./getUploadedAssets";
import { setUploadedAssets } from "./setUploadedAssets";
import { checkUploadedAssets } from "./checkUploadedAssets";

const AssetService = {
    cors: true,
    auth: true,
    // Services
    updateUpload,
    deleteUploads,
    getAssetsByHash,
    setUploadedAssets,
    getUploadedAssets,
    checkUploadedAssets,    
    //...
};

export default api(AssetService);
