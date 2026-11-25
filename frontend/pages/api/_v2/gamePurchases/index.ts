import { api } from "@utils/rpc/server";
import { wallet } from "./wallet";
import { buy } from "./buy";
import { owned } from "./owned";
import { history } from "./history";
import { addTestFunds } from "./addTestFunds";

const GamePurchasesService = {
    // Same-origin only: the game page calls these, never a game's frame.
    cors: false,
    auth: false,

    wallet,
    buy,
    owned,
    history,
    addTestFunds,
};

export default api(GamePurchasesService);
