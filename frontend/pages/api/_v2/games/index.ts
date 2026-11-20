import { api } from "@utils/rpc/server";
import { reportResult } from "./reportResult";
import { leaderboard } from "./leaderboard";

const GamesService = {
    // Same-origin only: the game page calls these, never a game's frame.
    cors: false,
    auth: false,

    reportResult,
    leaderboard,
};

export default api(GamesService);
