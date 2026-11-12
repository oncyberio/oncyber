//
import { api } from "@utils/rpc/server";
import { isMod } from "./isMod";
import { checkGating } from "./checkGating";
import { storage } from "./storage";

const SocialService = {
    //
    cors: true,
    auth: true,

    isMod,
    checkGating,
    storage,
};

export default api(SocialService);
