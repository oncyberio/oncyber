/**
 * Purchases on the page and the server. The rules (what a product is, what
 * a game may ask, how an answer reads) are the game runtime's, shared as
 * they are: games/runtime/src/purchases.ts. This file adds what only the
 * site knows: which products each game declared, and whether purchases are
 * on here. See docs/games/purchases.md.
 */
import {
    readProducts,
    type Products,
} from "../../../games/runtime/src/purchases";
import declaredByGame from "./products.declared.json";
import { walletPaymentConfig } from "./walletPayment";

export {
    formatPrice,
    PURCHASE_LIMITS,
    PURCHASE_REFUSALS,
    readProducts,
    readPurchaseRequest,
    type Product,
    type Products,
    type PurchaseRefusal,
} from "../../../games/runtime/src/purchases";

/**
 * The products a game declared in its game.json, as synced into
 * products.declared.json by `node scripts/games/products.mjs sync`. A game
 * that is not in the file sells nothing.
 */
export function gameProducts(
    game: string,
    declared: Record<string, unknown> = declaredByGame
): Products {
    if (!Object.hasOwn(declared, game)) return {};
    const read = readProducts(declared[game]);
    return read.ok ? read.products : {};
}

/**
 * How purchases are paid for on this deployment (`GAMES_PURCHASES`).
 *
 *   off     nothing can be bought; a game's `buy()` answers "unavailable".
 *   test    a play-money balance kept by the site. No real money moves.
 *   wallet  the visitor's own wallet sends a dollar token, and the server
 *           reads the transfer from the chain (walletPayment.ts). Needs
 *           every `GAMES_PURCHASE_*` chain setting; without them it is off.
 *
 * The development server uses `test` when the variable is blank. Anything
 * else is off, including a value this build does not know, so a typo never
 * opens a rail.
 */
export type PurchasesMode = "off" | "test" | "wallet";
export function purchasesMode(
    env: Record<string, string | undefined> = process.env
): PurchasesMode {
    const value = (env.GAMES_PURCHASES ?? "").trim();
    if (value === "test") return "test";
    if (value === "wallet") return walletPaymentConfig(env) ? "wallet" : "off";
    if (value === "" && env.NODE_ENV === "development") return "test";
    return "off";
}

/**
 * Oncyber's share of a sale, in whole percent, from
 * `GAMES_PURCHASE_FEE_PERCENT`. Blank or unreadable is 0; never above 100.
 */
export function purchaseFeePercent(
    env: Record<string, string | undefined> = process.env
): number {
    const value = Number((env.GAMES_PURCHASE_FEE_PERCENT ?? "").trim() || 0);
    return Number.isInteger(value) && value >= 0 && value <= 100 ? value : 0;
}

/** A sale's split, in cents. The fee rounds down, in the seller's favour. */
export function splitSale(cents: number, feePercent: number) {
    const fee = Math.floor((cents * feePercent) / 100);
    return { feeCents: fee, sellerCents: cents - fee };
}

/** The most test money a wallet holds, and the most added at once. */
export const TEST_FUNDS = { maxCents: 100_00, stepCents: 10_00 } as const;
