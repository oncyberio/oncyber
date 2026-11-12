//
import { api } from "@utils/rpc/server";
import { getVrm } from "./getVrm";
import { getVrms } from "./getVrms";
import { updateVrm } from "./updateVrm";
import { destroyVrm } from "./destroyVrm";
import { addOwnedVrm } from "./addVrm/owned";
import { addUploadedVrm } from "./addVrm/uploaded";
import { getCompressedUrl } from "./getCompressedUrl";
import { checkUploadedVrms } from "./checkUploadedVrms";
import { getCloudinaryVrm } from "./getCloudinaryVrm";

const VrmService = {
    // Middleware Options
    // Those options will be applied to all included methods
    // They can be overriden in each individual method
    cors: true,
    auth: true,

    // Services
    getVrm,
    getVrms,
    updateVrm,
    destroyVrm,
    addOwnedVrm,
    addUploadedVrm,
    getCloudinaryVrm,
    getCompressedUrl,
    checkUploadedVrms,
    //...
};

export default api(VrmService);
