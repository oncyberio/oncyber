import { formatPrice } from "./gamePurchases";
import type { WalletPaymentRequest } from "./walletPayment";

/**
 * Sends the transfer that pays for one order from the visitor's own wallet
 * (walletPayment.ts). The wallet is chosen for this payment only: nothing
 * here signs anyone in or changes the account (dApp/paymentWallet.tsx).
 *
 * `paid` means the wallet sent the transaction and `proof` is its hash; it
 * is the server, reading the chain, that decides the order is paid.
 */
export type WalletPaymentOutcome =
    | { paid: true; proof: string }
    /** The visitor closed the wallet chooser or refused in their wallet. */
    | { paid: false; reason: "cancelled" }
    | { paid: false; reason: "failed"; message: string };

/** The part of an injected wallet this needs. */
interface WalletProvider {
    request(call: { method: string; params?: unknown[] }): Promise<unknown>;
}

const refused = (error: any) =>
    error?.code === 4001 ||
    error?.code === "ACTION_REJECTED" ||
    /user (rejected|denied)/i.test(String(error?.message ?? ""));
const hex = (value: number | bigint) => "0x" + value.toString(16);

/** The wallet to pay with; undefined when the visitor chose none. */
async function chooseWallet(
    userId?: string
): Promise<WalletProvider | undefined> {
    const [{ connectEthereumForPayment }, { getEthersProvider }] =
        await Promise.all([
            import("@dapp/paymentWallet"),
            import("@dapp/connect"),
        ]);
    const connection = await connectEthereumForPayment(userId);
    return getEthersProvider(connection)?.provider as
        | WalletProvider
        | undefined;
}

export async function payWithWallet(
    request: WalletPaymentRequest,
    options: {
        /** The signed-in account, so an already connected wallet is reused. */
        userId?: string;
        /** For tests: the wallet, instead of asking the visitor for one. */
        choose?: (userId?: string) => Promise<WalletProvider | undefined>;
    } = {}
): Promise<WalletPaymentOutcome> {
    const failed = (message: string): WalletPaymentOutcome => ({
        paid: false,
        reason: "failed",
        message,
    });
    let wallet: WalletProvider | undefined;
    try {
        wallet = await (options.choose ?? chooseWallet)(options.userId);
    } catch (error) {
        return refused(error)
            ? { paid: false, reason: "cancelled" }
            : failed("Couldn’t connect to your wallet. Try again.");
    }
    if (!wallet?.request) return { paid: false, reason: "cancelled" };
    try {
        const [from] = (await wallet.request({
            method: "eth_requestAccounts",
        })) as string[];
        if (!from) return { paid: false, reason: "cancelled" };

        // The right network, asked of the wallet rather than assumed.
        const current = Number(await wallet.request({ method: "eth_chainId" }));
        if (current !== request.chainId) {
            try {
                await wallet.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: hex(request.chainId) }],
                });
            } catch (error) {
                return refused(error)
                    ? { paid: false, reason: "cancelled" }
                    : failed(
                          `Switch your wallet to ${request.chainName}, then try again.`
                      );
            }
        }

        // Enough of the token: said plainly before the wallet says it in gas terms.
        const held = BigInt(
            (await wallet.request({
                method: "eth_call",
                params: [
                    {
                        to: request.token,
                        // balanceOf(address)
                        data:
                            "0x70a08231" +
                            from.slice(2).toLowerCase().padStart(64, "0"),
                    },
                    "latest",
                ],
            })) as string
        );
        const price = BigInt(request.units);
        if (held < price) {
            const dollars = (units: bigint) =>
                formatPrice(Number(units / BigInt(10000)));
            return failed(
                `That wallet holds ${dollars(held)} in ${
                    request.tokenSymbol
                } on ${request.chainName}. This costs ${dollars(price)}.`
            );
        }

        const proof = (await wallet.request({
            method: "eth_sendTransaction",
            params: [
                { from, to: request.token, data: request.data, value: "0x0" },
            ],
        })) as string;
        return /^0x[0-9a-fA-F]{64}$/.test(proof)
            ? { paid: true, proof }
            : failed("Your wallet didn’t confirm the payment was sent.");
    } catch (error) {
        return refused(error)
            ? { paid: false, reason: "cancelled" }
            : failed("The payment wasn’t sent. Try again.");
    }
}
