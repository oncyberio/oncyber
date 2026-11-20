//
import { api } from "@utils/rpc/server";
import { updateAssetMediaDb as updateAssetMedia } from "./updateAssetMediaDb";
import { uploadMedia } from "./uploadMedia";
import { createUploadUrl } from "./createUploadUrl";

export const config = {
    api: {
        bodyParser: {
            sizeLimit: "100mb",
        },
    },
};

const UploaderService = {
    // Middleware Options
    // Those options will be applied to all included methods
    // They can be overriden in each individual method
    cors: true,
    auth: true,

    // Services
    updateAssetMedia,

    uploadMedia,

    createUploadUrl,
    //...
};

export default api(UploaderService);
