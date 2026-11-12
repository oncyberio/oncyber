//
import { api } from "@utils/rpc/server";
import { get } from "./get";
import { update } from "./update";

const CollectionService = {
    // Services
    get,
    update,
    //...
};

export default api(CollectionService);
