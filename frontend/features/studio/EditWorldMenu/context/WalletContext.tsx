import { UserContext } from "@components/context/UserContext";
import { UserStatus } from "@components/hooks/useAssets";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useSafeContext } from "@components/hooks/useSafeContext";
import { useSnackbar } from "@components/Snackbar";
import { getAddrType } from "@utils/getAddrType";
import { noop } from "@utils/js";
import dynamic from "next/dynamic";
import React, { useContext, useMemo, useState } from "react";
import { validateWalletChange } from "../../utils";
import { useProfile } from "@components/hooks/useProfile";
import { User } from "@uitypes/user";

export type WalletType = "own" | "delegated";

const ConnectWallet = dynamic(() => import("@ui/components/ConnectWallet"));

export interface WalletContextState {
    currentWalletId: string;
    currentWalletType: WalletType;
    custodialWalletType: "autograph" | null;
}

export interface WalletContextValue extends WalletContextState {
    userProfile: Partial<User>;
    changeWallet: (
        walletId: string,
        type: WalletType,
        walletData?: { trustedDelegation?: boolean }
    ) => Promise<void>;

    addNewWallet: () => void;
}

const WalletContext = React.createContext<WalletContextValue>(null);

export interface WalletProviderProps {
    children: React.ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
    //
    const { user, exhibits, isAutograph, userData, defaultWallet } =
        useContext(UserContext);

    const [showConnect, setShowConnect] = useState(false);

    const [openSnackbar, closeSnackbar] = useSnackbar({
        position: "top-right",
    });

    const initState: WalletContextState = {
        currentWalletId: defaultWallet,
        currentWalletType: "own",
        custodialWalletType: isAutograph ? "autograph" : null,
    };

    const [state, setState] = useState(initState);

    const userProfile = useProfile({ id: state.currentWalletId });

    const changeWallet = useEventCallback<WalletContextValue["changeWallet"]>(
        //
        async (
            walletId,
            type: WalletType,
            { trustedDelegation = false } = {}
        ) => {
            //

            if (type === "delegated") {
                //
                setState((s) => {
                    //
                    return {
                        ...s,
                        currentWalletId: walletId,
                        currentWalletType: type,
                    };
                });

                return;
            }

            try {
                //
                closeSnackbar();

                const { walletId: newWalletId, isAutograph } =
                    await validateWalletChange(
                        walletId,
                        type,
                        trustedDelegation
                    );

                setState((state) => ({
                    ...state,
                    currentWalletId: newWalletId,
                    custodialWalletType: isAutograph ? "autograph" : null,
                }));
            } catch (err) {
                //
                console.error(err);

                openSnackbar("Failed to switch wallets", 2000, null, "error");
            }
        },
        []
    );

    const addNewWallet = useEventCallback(() => {
        //
        setShowConnect(true);
    }, []);

    const value: WalletContextValue = useMemo(() => {
        //
        return {
            ...state,
            userProfile,
            changeWallet,
            addNewWallet,
        };
    }, [state, changeWallet]);

    return (
        <WalletContext.Provider value={value}>
            {showConnect && (
                <ConnectWallet
                    toggle={() => setShowConnect(false)}
                    open={true}
                    callbackAfterAuth={noop}
                    onlyEthereum={false}
                    skipRedirectToAccount={true}
                />
            )}
            {children}
        </WalletContext.Provider>
    );
}

export function useWalletContext() {
    return useSafeContext(WalletContext);
}
