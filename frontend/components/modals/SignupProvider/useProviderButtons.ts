import { useCallback, useEffect, useRef, useState } from "react";
import { connectors, Provider, WalletConnection } from "../../../dApp/connect";
import {
    describeSignInError,
    SignInFailure,
} from "@features/auth/signInErrors";

type LoadingState = {
    [Key in Provider]?: boolean;
};

/**
 * Connects a wallet when its button is pressed, then hands the connection to
 * `onConnect`. What goes wrong is reported, already worded, to `onFailure`
 * together with the button that was used, so it can be shown beside it.
 */
export function useProviderButtons(
    onConnect: (connection: WalletConnection) => Promise<void>,
    onFailure: (failure: SignInFailure, provider: Provider) => void = () => {}
) {
    const [isConnecting, _setConnecting] = useState<LoadingState>({});

    const isUnmounted = useRef(false);

    const setConnecting = useCallback(
        (provider: Provider, connecting: boolean) => {
            _setConnecting((state) => ({
                ...state,
                [provider]: connecting,
            }));
        },
        [_setConnecting]
    );

    const onConnectClick = useCallback(
        async <P extends Provider>(provider: P) => {
            // The wallet's own request (stage "connect") and what follows it
            // are worded differently, so note which one threw.
            let stage: "connect" | "sign-in" = "connect";
            try {
                setConnecting(provider, true);
                let connectFn = connectors[provider];
                let connection = await connectFn();
                stage = "sign-in";
                await onConnect(connection);
            } catch (error) {
                const failure = describeSignInError(error, stage);
                // Closing the wallet's request is the visitor's choice.
                if (!failure.cancelled) console.error("Error", error);
                !isUnmounted.current && onFailure(failure, provider);
            } finally {
                !isUnmounted.current && setConnecting(provider, false);
            }
        },
        [setConnecting, onFailure, onConnect]
    );

    useEffect(() => {
        return () => {
            isUnmounted.current = true;
        };
    }, []);

    return {
        isConnecting,
        setConnecting,
        onConnectClick,
    };
}
