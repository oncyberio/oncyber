import { ensureEthChainId, isEthAbort } from "./connect";

/** The networks `ensureEthChainId` can switch to, by chain id. */
const NETWORKS: Record<number, "ethereum" | "polygon"> = {
    1: "ethereum",
    137: "polygon",
};

/**
 * - `ready`: the wallet is on the network (it was, or it switched).
 * - `cancelled`: the visitor closed the wallet's switch request.
 * - `failed`: it could not be switched (no wallet, unknown network, or the
 *   wallet refused for another reason).
 */
export type NetworkSwitch = "ready" | "cancelled" | "failed";

/**
 * Asks the wallet to move to the network a contract lives on, the same step
 * buying an artwork takes before paying (`NftBuyContext` → `ensureEthChainId`).
 * Minting used to refuse with "Please switch…" instead.
 *
 * It never throws, so a caller keeps its own check of the chain id after it
 * and behaves as before whenever switching is not possible.
 */
export async function switchWalletNetwork(
    eth: any,
    chainId: number
): Promise<NetworkSwitch> {
    const network = NETWORKS[chainId];
    if (eth == null || network == null) return "failed";
    try {
        await ensureEthChainId(eth, network);
        return "ready";
    } catch (error) {
        return isEthAbort(error) ? "cancelled" : "failed";
    }
}

/**
 * What a visitor reads when their wallet is still on another network, e.g.
 * "Your wallet is on another network. Switch it to Polygon to mint."
 */
export function wrongNetworkMessage(network: string, toDo: string): string {
    const name = network
        ? network.charAt(0).toUpperCase() + network.slice(1)
        : "the right one";
    return `Your wallet is on another network. Switch it to ${name} to ${toDo}.`;
}
