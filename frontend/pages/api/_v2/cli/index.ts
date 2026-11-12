import { api } from "@utils/rpc/server";
import { authorize } from "./authorize";
import { exchange } from "./exchange";

const CliService = {
    cors: true,
    auth: false,

    authorize,
    exchange,
};

export default api(CliService);
