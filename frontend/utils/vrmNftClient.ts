import type { AlchemyNftClient } from "./alchemyNfts";
import { nodeEnv } from "@env";

type Chain = "eth" | "polygon";
const clients: Partial<Record<Chain, Promise<AlchemyNftClient>>> = {};

/** Wallet-owned avatar discovery is optional; visiting a room must not load
 * the blockchain SDK or create RPC providers for it. */
export function getVrmNftClient(chain: Chain): Promise<AlchemyNftClient> {
    if (!clients[chain]) {
        clients[chain] = import("./alchemyNfts")
            .then(({ createAlchemyNftClient }) =>
                createAlchemyNftClient(
                    chain === "eth"
                        ? nodeEnv.ETH_BALANCE_CHECKER_RPC
                        : nodeEnv.POLYGON_RPC
                )
            )
            .catch((error) => {
                delete clients[chain];
                throw error;
            });
    }
    return clients[chain];
}
