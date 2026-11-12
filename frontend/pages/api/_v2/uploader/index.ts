//
import { api } from "@utils/rpc/server";
import { updateAssetMediaDb as updateAssetMedia } from "./updateAssetMediaDb";
import { uploadMedia } from "./uploadMedia";

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
    //...
};

export default api(UploaderService);
