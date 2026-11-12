//
import { api } from "@utils/rpc/server";
import { generateSignature, selfClaimTokens, claimSpace } from "./services";

const FactoryService = {
    // Middleware Options
    // Those options will be applied to all included methods
    // They can be overriden in each individual method
    cors: true,
    auth: true,

    // Services
    claimSpace,
    selfClaimTokens,
    generateSignature,
    //...
};

export default api(FactoryService);
