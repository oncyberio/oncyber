import { createHash } from "crypto";
import { ethers } from "ethers";
import {
    walletPaymentRequest,
    type WalletPaymentConfig,
} from "@features/games/walletPayment";
import type { PaymentRail } from "@utils/firestore/gamePurchases";

/** The two reads the wallet rail makes of the chain. */
export interface ChainReader {
    getTransaction(hash: string): Promise<{
        to?: string | null;
        from: string;
        data: string;
    } | null>;
    getTransactionReceipt(hash: string): Promise<{
        status?: number;
        confirmations: number;
        logs: Array<{ address: string; topics: string[]; data: string }>;
    } | null>;
    call(transaction: { to: string; data: string }): Promise<string>;
}

const TRANSFER_EVENT =
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const topicAddress = (address: string) =>
    "0x" + address.slice(2).toLowerCase().padStart(64, "0");

/**
 * The reference of a payment: 32 bytes no other account's order shares.
 * It goes after the transfer's arguments in the transaction's data.
 */
export function paymentReference(userId: string, payment: string): string {
    return (
        "0x" +
        createHash("sha256")
            .update(`oncyber-purchase\n${userId}\n${payment}`)
            .digest("hex")
    );
}

let readers = new Map<string, ChainReader>();
function readerFor(config: WalletPaymentConfig): ChainReader {
    const key = `${config.chainId} ${config.rpcUrl}`;
    let reader = readers.get(key);
    if (!reader) {
        reader = new ethers.providers.StaticJsonRpcProvider(
            { url: config.rpcUrl, timeout: 10_000 },
            config.chainId
        );
        readers = new Map([[key, reader]]);
    }
    return reader;
}

/**
 * The rail a visitor pays themselves: their own wallet sends the token and
 * this reads the transfer back. It holds no balance and moves no money.
 *
 * A transfer pays for an order only when all of this is true of it:
 *   - it was sent to the token contract, with exactly the data asked for
 *     (the recipient, the amount, and the order's reference after them);
 *   - it succeeded, with the confirmations the deployment asks for;
 *   - the token logged that same transfer, from whoever sent it.
 * Anything not yet visible or not yet confirmed is "payment-pending": the
 * page asks again. Anything that can never match is "payment-failed".
 */
export function walletRail(
    config: WalletPaymentConfig,
    reader: ChainReader = readerFor(config)
): PaymentRail {
    return {
        id: "wallet",
        request: ({ userId, payment, cents }) =>
            walletPaymentRequest(
                config,
                cents,
                paymentReference(userId, payment)
            ),
        async verify({ userId, payment, cents, proof }) {
            const asked = walletPaymentRequest(
                config,
                cents,
                paymentReference(userId, payment)
            );
            const [sent, receipt] = await Promise.all([
                reader.getTransaction(proof),
                reader.getTransactionReceipt(proof),
            ]);
            if (!sent) return { ok: false, reason: "payment-pending" };
            if (
                (sent.to ?? "").toLowerCase() !== asked.token ||
                sent.data.toLowerCase() !== asked.data
            )
                return { ok: false, reason: "payment-failed" };
            if (!receipt || receipt.confirmations < config.confirmations)
                return { ok: false, reason: "payment-pending" };
            if (receipt.status !== 1)
                return { ok: false, reason: "payment-failed" };
            const amount = ethers.BigNumber.from(asked.units);
            const moved = receipt.logs.some(
                (log) =>
                    log.address.toLowerCase() === asked.token &&
                    log.topics.length === 3 &&
                    log.topics[0] === TRANSFER_EVENT &&
                    log.topics[1].toLowerCase() === topicAddress(sent.from) &&
                    log.topics[2].toLowerCase() ===
                        topicAddress(asked.recipient) &&
                    ethers.BigNumber.from(log.data).eq(amount)
            );
            return moved
                ? { ok: true, reference: proof.toLowerCase() }
                : { ok: false, reason: "payment-failed" };
        },
    };
}

/**
 * What `address` holds of the purchase token, in US cents (rounded down),
 * for showing in the profile. Null when the chain cannot be read: it is
 * information for the visitor, never what a purchase is checked against.
 */
export async function walletTokenCents(
    config: WalletPaymentConfig,
    address: string,
    reader: ChainReader = readerFor(config)
): Promise<number | null> {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return null;
    try {
        const held = await reader.call({
            to: config.token,
            // balanceOf(address)
            data: "0x70a08231" + topicAddress(address).slice(2),
        });
        const cents = ethers.BigNumber.from(held).div(10_000);
        // More than anyone holds, or a node answering nonsense.
        return cents.gt(String(Number.MAX_SAFE_INTEGER))
            ? null
            : cents.toNumber();
    } catch {
        return null;
    }
}
