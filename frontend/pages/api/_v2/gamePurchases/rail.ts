import type { PurchasesMode } from "@features/games/gamePurchases";
import { walletPaymentConfig } from "@features/games/walletPayment";
import { testRail, type PaymentRail } from "@utils/firestore/gamePurchases";
import { walletRail } from "@utils/purchaseChain";

/**
 * The rail that pays for purchases in `mode`; null where they are off.
 * `test` is play money the site keeps; `wallet` is the visitor's own
 * wallet, read back from the chain.
 */
export function railFor(mode: PurchasesMode): PaymentRail | null {
    if (mode === "test") return testRail;
    if (mode === "wallet") {
        const config = walletPaymentConfig();
        return config ? walletRail(config) : null;
    }
    return null;
}
