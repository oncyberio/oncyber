//
import { api } from "@utils/rpc/server";
import { savedRead, savedWrite } from "./savedData";

const GameSavedService = {
    // Reads of shared keys are open to guests; each procedure decides.
    auth: false,

    // Services
    savedRead,
    savedWrite,
};

export default api(GameSavedService);
