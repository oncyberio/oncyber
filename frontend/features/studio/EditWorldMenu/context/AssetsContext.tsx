import React, { useContext, useEffect, useReducer } from "react";
import { nodeEnv } from "@env";
import { getAddrType } from "@utils/getAddrType";
import {
    AssetRepository,
    UseAssetsData,
    useCreatedAssets,
    useDelegatedAssets,
    useOwnedAssets,
    UserStatus,
} from "@hooks/useAssets";
import { UserContext } from "@context/UserContext";
import { useWalletContext } from "./WalletContext";
import { useSafeContext } from "@components/hooks/useSafeContext";

interface AssetsContextState {
    currentUserStatus: UserStatus;
    currentRepo: AssetRepository;
}

interface AssetsContextValue extends AssetsContextState {
    //
    assetsByStatus: Record<UserStatus, UseAssetsData>;
    currentUserAssets: UseAssetsData;
    setAssetsState: (partial: Partial<AssetsContextState>) => unknown;
}

export function getDefaultRepo(walletId: string) {
    const blockchain = getAddrType(walletId);
    return blockchain === "ethereum"
        ? nodeEnv.DEFAULT_ETH_CHAIN
        : nodeEnv.DEFAULT_CHAIN;
}

export const AssetsContext = React.createContext<AssetsContextValue>(null);

export default function AssetsProvider({ children, loadAssets }) {
    //
    const {
        user,
        exhibits,
        isAutograph,
        userData,
        defaultWallet,
        isAnonymous,
    } = useContext(UserContext);

    loadAssets &&= !isAnonymous;

    const { currentWalletId, currentWalletType } = useWalletContext();

    const isCurator = currentWalletType === "delegated";

    const initState: AssetsContextState = {
        currentRepo: getDefaultRepo(defaultWallet),
        currentUserStatus: "owned",
    };

    const [state, setAssetsState] = useReducer(
        (state: AssetsContextState, partial: Partial<AssetsContextState>) => ({
            ...state,
            ...partial,
        }),
        initState
    );

    useEffect(() => {
        //
        //
        const addrType = getAddrType(currentWalletId);

        //
        let newState = { ...state };

        if (addrType !== "ethereum") {
            newState.currentRepo = "default";
        }

        newState.currentUserStatus = "owned";

        setAssetsState(newState);
        //
    }, [currentWalletId]);

    // console.log("useOwnedAssets", state.currentRepo);

    const ownedAssets = useOwnedAssets(
        currentWalletId,
        state.currentRepo,
        loadAssets
    );

    const createdAssets = useCreatedAssets(
        currentWalletId,
        state.currentRepo,
        loadAssets
    );

    const delegatedAssets = useDelegatedAssets(
        // ???
        user.id,
        getDefaultRepo(currentWalletId),
        loadAssets
    );

    const assetsByStatus: Record<UserStatus, UseAssetsData> = {
        owned: ownedAssets,
        created: createdAssets,
        delegated: delegatedAssets,
    };

    const value: AssetsContextValue = {
        ...state,
        setAssetsState,
        assetsByStatus,
        currentUserAssets: assetsByStatus[state.currentUserStatus],
    };

    return (
        <AssetsContext.Provider value={value}>
            {children}
        </AssetsContext.Provider>
    );
}

export function useAssetsContext() {
    return useSafeContext(AssetsContext);
}
