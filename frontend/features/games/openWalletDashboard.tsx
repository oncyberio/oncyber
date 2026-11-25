import { useEffect } from "react";

/**
 * Opens the account dashboard at the wallet, where the balance and the
 * purchases live. Resolves when the dashboard has gone, however it was
 * closed (its Cancel, the backdrop, another dialog replacing it), so the
 * caller can read the balance again.
 */
export async function openWalletDashboard(): Promise<void> {
    const [{ showModal }, { default: AccountDashboard }] = await Promise.all([
        import("@components/Dialogs"),
        import("@components/modals/AccountDashboard"),
    ]);
    return new Promise<void>((resolve) => {
        // `showModal` only resolves for a dialog that reports a result; the
        // dashboard just closes, so its unmounting is what tells us.
        function WalletDashboard(props: { close?: () => void }) {
            useEffect(() => () => resolve(), []);
            return <AccountDashboard defaultStep="wallet" {...props} />;
        }
        void showModal(<WalletDashboard />);
    });
}
