/**
 * Paying for a purchase from the visitor's own wallet (docs/games/
 * purchases.md, "The wallet rail"). The server opens an order and says
 * exactly which transfer pays for it; the visitor's wallet sends it; the
 * server reads the transfer back from the chain before the order is paid.
 *
 * The transfer is an ordinary token `transfer(to, amount)` with 32 more
 * bytes after its arguments: the order's reference. A token ignores the
 * extra bytes, and they tie that one transfer to that one order, so a
 * transfer made for anything else can never be claimed for it.
 *
 * No imports: the page, the server and tests load this file as is.
 */

/** Where purchases are paid, from the deployment's settings. */
export interface WalletPaymentConfig {
    chainId: number;
    /** The network's name as the visitor reads it. */
    chainName: string;
    /** Server-only: the node the server reads transfers from. */
    rpcUrl: string;
    /** The dollar token's contract (six decimals, as USDC has). */
    token: string;
    /** What the visitor calls that token. */
    tokenSymbol: string;
    /** The address every purchase is paid to. */
    recipient: string;
    /** Blocks on top of the transfer before it counts. */
    confirmations: number;
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const REFERENCE = /^0x[0-9a-f]{64}$/;
/** A transaction hash, as a wallet returns it. */
export const TRANSACTION_HASH = /^0x[0-9a-fA-F]{64}$/;

/**
 * The wallet rail's settings, or null when any is missing or malformed: a
 * half-configured rail is off, never guessed at.
 */
export function walletPaymentConfig(
    env: Record<string, string | undefined> = process.env
): WalletPaymentConfig | null {
    const chainId = Number(env.GAMES_PURCHASE_CHAIN_ID);
    const chainName = (env.GAMES_PURCHASE_CHAIN_NAME ?? "").trim();
    const rpcUrl = (env.GAMES_PURCHASE_RPC_URL ?? "").trim();
    const token = (env.GAMES_PURCHASE_TOKEN ?? "").trim();
    const recipient = (env.GAMES_PURCHASE_RECIPIENT ?? "").trim();
    const tokenSymbol =
        (env.GAMES_PURCHASE_TOKEN_SYMBOL ?? "").trim() || "USDC";
    const confirmations = Number(env.GAMES_PURCHASE_CONFIRMATIONS ?? "1");
    if (
        !Number.isInteger(chainId) ||
        chainId < 1 ||
        !chainName ||
        chainName.length > 40 ||
        !/^https:\/\/\S+$/.test(rpcUrl) ||
        !ADDRESS.test(token) ||
        !/^[A-Za-z0-9.]{1,10}$/.test(tokenSymbol) ||
        !ADDRESS.test(recipient) ||
        // Paying the token contract itself would burn the money.
        token.toLowerCase() === recipient.toLowerCase() ||
        !Number.isInteger(confirmations) ||
        confirmations < 1 ||
        confirmations > 64
    )
        return null;
    return {
        chainId,
        chainName,
        rpcUrl,
        token: token.toLowerCase(),
        tokenSymbol,
        recipient: recipient.toLowerCase(),
        confirmations,
    };
}

/** What the visitor's wallet must send to pay for one order. */
export interface WalletPaymentRequest {
    rail: "wallet";
    chainId: number;
    chainName: string;
    /** The token contract the transaction is sent to. */
    token: string;
    tokenSymbol: string;
    recipient: string;
    /** The amount in the token's smallest unit, as decimal text. */
    units: string;
    /** The transaction's data: the transfer, then the order's reference. */
    data: string;
}

/** US cents in a six-decimal dollar token's smallest unit. */
export function tokenUnits(cents: number): string {
    return (BigInt(cents) * BigInt(10000)).toString();
}

const pad32 = (hex: string) => hex.toLowerCase().padStart(64, "0");
const TRANSFER = "a9059cbb"; // transfer(address,uint256)

/**
 * The exact transaction data that pays `units` to `recipient` for the
 * order `reference` names. The server accepts a transaction only when its
 * data is this, byte for byte.
 */
export function transferData(
    recipient: string,
    units: string,
    reference: string
): string {
    if (!ADDRESS.test(recipient)) throw new Error("PAYMENT_RECIPIENT");
    if (!/^[1-9][0-9]{0,30}$/.test(units)) throw new Error("PAYMENT_UNITS");
    if (!REFERENCE.test(reference)) throw new Error("PAYMENT_REFERENCE");
    return (
        "0x" +
        TRANSFER +
        pad32(recipient.slice(2)) +
        pad32(BigInt(units).toString(16)) +
        reference.slice(2)
    );
}

export function walletPaymentRequest(
    config: WalletPaymentConfig,
    cents: number,
    reference: string
): WalletPaymentRequest {
    const units = tokenUnits(cents);
    return {
        rail: "wallet",
        chainId: config.chainId,
        chainName: config.chainName,
        token: config.token,
        tokenSymbol: config.tokenSymbol,
        recipient: config.recipient,
        units,
        data: transferData(config.recipient, units, reference),
    };
}

/** A request as the page may trust it from the server; null when malformed. */
export function readWalletPaymentRequest(
    value: unknown
): WalletPaymentRequest | null {
    const v = value as Partial<WalletPaymentRequest> | null;
    return v &&
        v.rail === "wallet" &&
        Number.isInteger(v.chainId) &&
        typeof v.chainName === "string" &&
        typeof v.token === "string" &&
        ADDRESS.test(v.token) &&
        typeof v.tokenSymbol === "string" &&
        typeof v.recipient === "string" &&
        ADDRESS.test(v.recipient) &&
        typeof v.units === "string" &&
        /^[1-9][0-9]{0,30}$/.test(v.units) &&
        typeof v.data === "string" &&
        /^0xa9059cbb[0-9a-f]{192}$/.test(v.data)
        ? (v as WalletPaymentRequest)
        : null;
}
