//
import { api } from "@utils/rpc/server";
import { setRange } from "./range";

const VoiceChatService = {
    // Services
    setRange,
};

export default api(VoiceChatService);
