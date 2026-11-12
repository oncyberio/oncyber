import React, { useRef, useState } from "react";
import styled from "styled-components";
import { showModal } from "@components/Dialogs";
import InlineError from "@ui/components/InlineError";
import { WalletButtons } from "@ui/components/WalletButtons";
import { useProviderButtons } from "@components/modals/SignupProvider/useProviderButtons";
import { SignInFailure } from "@features/auth/signInErrors";
import { baseTokens as base, landingTokens as landing } from "@styles/tokens";
import {
    connectMetamask,
    EthereumConnection,
    Provider,
    WalletConnection,
} from "./connect";

/**
 * Connecting a wallet to pay with, and nothing else.
 *
 * Paying never changes who the visitor is: the wallet chosen here is used for
 * this one payment. Nothing here signs in, writes the `_CCA` cookie or
 * dispatches `USER_LOGIN`; the sign-in sheet (`ConnectWallet`) does all three,
 * which is why checkout no longer opens it.
 */

/** What a visitor reads when the wallet for a payment cannot be connected. */
export interface PaymentWalletFailure {
    message: string;
    /** They closed the wallet's request: their choice, so nothing is shown. */
    cancelled: boolean;
    canRetry: boolean;
}

const COULD_NOT_CONNECT = {
    message: "Couldn’t connect to your wallet. Try again, or choose another.",
    cancelled: false,
    canRetry: true,
};

/**
 * The payment wording for a failure `useProviderButtons` reports. The
 * sign-in rows talk about signing in, which this is not.
 */
export function describePaymentWalletFailure(
    failure: Pick<SignInFailure, "code" | "cancelled">
): PaymentWalletFailure {
    if (failure?.cancelled) {
        return { message: "", cancelled: true, canRetry: false };
    }
    switch (failure?.code) {
        case "wallet/not-installed":
            return {
                message:
                    "That wallet isn’t installed in this browser. Choose another.",
                cancelled: false,
                canRetry: false,
            };
        case "wallet/request-pending":
            return {
                message:
                    "Your wallet already has a request open. Open your wallet to finish it.",
                cancelled: false,
                canRetry: true,
            };
        case "wallet/timeout":
            return {
                message: "Your wallet didn’t answer in time. Try again.",
                cancelled: false,
                canRetry: true,
            };
        default:
            return COULD_NOT_CONNECT;
    }
}

const onlyEthereum = (wallet: { onlyEthereum: boolean }) =>
    !!wallet.onlyEthereum;

/**
 * Lists the Ethereum wallets and resolves with the one the visitor connects.
 * `onClose` comes from `showModal`; closing the dialog resolves with nothing.
 */
export function PaymentWalletPicker({
    onClose = () => {},
}: {
    onClose?: (connection?: EthereumConnection) => void;
}) {
    const [failure, setFailure] = useState<PaymentWalletFailure | null>(null);
    const lastWallet = useRef<Provider>(null);

    const { isConnecting, onConnectClick } = useProviderButtons(
        async (connection: WalletConnection) => {
            if (connection?.type !== "ethereum" || !connection.ethers) {
                throw new Error("Not an Ethereum wallet");
            }
            onClose(connection);
        },
        (described) => setFailure(describePaymentWalletFailure(described))
    );

    const connect = (wallet: Provider) => {
        // Trying again: the old failure is not left beside "Loading…".
        setFailure(null);
        lastWallet.current = wallet;
        void onConnectClick(wallet);
    };

    const connecting = Object.values(isConnecting).some(Boolean);
    const shown = failure && !failure.cancelled ? failure : null;

    return (
        <Panel>
            <h2>Choose a wallet to pay with</h2>
            <p>Paying doesn’t change the account you’re signed in with.</p>
            <WalletButtons
                filter={onlyEthereum}
                shouldDisableButtons={connecting}
                isConnecting={isConnecting}
                onConnectClick={connect}
                isDarkTheme={false}
            />
            <InlineError
                surface="light"
                message={shown?.message}
                onRetry={
                    shown?.canRetry && lastWallet.current
                        ? () => connect(lastWallet.current)
                        : undefined
                }
            />
        </Panel>
    );
}

/**
 * The wallet to pay with on Ethereum. A MetaMask that is already connected
 * for a signed-in visitor is used directly, as before; otherwise the visitor
 * chooses one. Resolves with nothing when they close the chooser.
 */
export function connectEthereumForPayment(
    userId?: string
): Promise<EthereumConnection | undefined> {
    if (userId && typeof window !== "undefined") {
        const eth = (window as any).ethereum;
        if (eth != null && eth.isMetaMask && eth.isConnected?.()) {
            return connectMetamask();
        }
    }
    return showModal(<PaymentWalletPicker />, {
        isModal: false,
        style: {
            borderRadius: "16px",
            width: "450px",
            background: "#ffff",
        },
    });
}

const Panel = styled.div`
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    padding: 32px 24px 24px;
    color: ${landing.color.paperInk};
    font-family: ${base.font.sans};

    h2 {
        margin: 0;
        font-size: 20px;
        font-weight: ${base.font.weight.medium};
    }

    p {
        margin: 0 0 8px;
        color: ${landing.color.paperMuted};
        font-size: ${base.font.size.body}px;
    }
`;
