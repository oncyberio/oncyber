//
import { api } from "@utils/rpc/server";

import { getIntent } from "./getIntent";

import { getWhisper } from "./getWhisper";

import { getScript } from "./getScript";

import { isWhitelisted } from "./whitelist";

const AssetService = {
    cors: true,
    auth: true,
    //...
    getWhisper: getWhisper,
    getIntent,
    isWhitelisted: isWhitelisted,

    getScript: getScript,
};

export default api(AssetService);
