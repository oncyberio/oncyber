import type { PurchasesMode } from "@features/games/gamePurchases";
import { testRail, type PaymentRail } from "@utils/firestore/gamePurchases";

/**
 * The rail that pays for purchases in `mode`; null where they are off. A
 * real rail (a wallet holding USDC) is added here, beside the test one.
 */
export function railFor(mode: PurchasesMode): PaymentRail | null {
    return mode === "test" ? testRail : null;
}
