//
import { api } from "@utils/rpc/server";
import { update } from "./update";
import { updateCustomLink } from "./updateCustomLink";
import { create } from "./create";
import { createEmpty } from "./createEmpty";
import { updateExhibitKit } from "./updateExhibitKit";
import { duplicate } from "./duplicate";
import { get } from "./get";
import {
    create as snapshotCreate,
    list as snapshotList,
} from "./snapshot";

const ExhibitService = {
    // Middleware Options
    // Those options will be applied to all included methods
    // They can be overriden in each individual method
    cors: true,
    auth: false,

    // Services
    create,
    duplicate,
    createEmpty,
    update,
    updateCustomLink,
    updateExhibitKit,
    get,
    snapshotCreate,
    snapshotList,
    //...
};

export default api(ExhibitService);
