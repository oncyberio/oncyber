//
import { api } from "@utils/rpc/server";

import { getMetadata } from "./website";

const WebsiteService = {
    // Services
    getMetadata,
};

export default api(WebsiteService);
