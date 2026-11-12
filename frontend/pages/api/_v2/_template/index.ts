//
import { api } from "@utils/rpc/server";
import { greet } from "./greet";

const GreetService = {
    // Middleware Options
    // Those options will be applied to all included methods
    // They can be overriden in each individual method
    cors: true,
    auth: false,

    // Services
    greet,
    //...
};

export default api(GreetService);
