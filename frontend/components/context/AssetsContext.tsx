import React, { Dispatch, useContext, useEffect, useState } from "react";
import { nodeEnv } from "../../env";
import { getAddrType } from "../../utils/getAddrType";
import {
    AssetRepository,
    UseAssetsData,
    useCreatedAssets,
    useCuratedAssets,
    useDelegatedAssets,
    useOwnedAssets,
    UserStatus,
    PortalStatus,
    useOwnedCuratedAssets,
} from "../hooks/useAssets";
import { useCurrentExhibit } from "./ExhibitContext";
import { UserContext } from "./UserContext";

interface InternalAssetsState {
    currentWalletId: string;
    custodialWalletType?: "autograph" | "null";
    delegatorWalletId: string;
    showPreviewImage: boolean;
    placedAssets: {};
    currentActiveTab: UserStatus;
    currentActivePortalTab: PortalStatus;
    currentRepo: AssetRepository;
    createdAssets: UseAssetsData;
    ownedAssets: UseAssetsData;
    delegatedAssets: UseAssetsData;
    curatedOwnedAssets: UseAssetsData;
    curatedAssets: UseAssetsData;
    artworkMessage: Record<string, { isError?: boolean; message: string }>;
    switchingWalletState: {
        isSwitching: boolean;
        error?: string;
    };
}

interface AssetsState extends InternalAssetsState {
    setAssetsContext?: Dispatch<React.SetStateAction<AssetsState>>;
    setAssetsProp: <K extends keyof AssetsState>(
        prop: K,
        value: AssetsState[K]
    ) => void;
}

const initialState: InternalAssetsState = {
    currentWalletId: "",
    custodialWalletType: null,
    delegatorWalletId: "",
    showPreviewImage: false,
    placedAssets: {},
    currentActiveTab: "owned",
    currentActivePortalTab: "owned",
    currentRepo: nodeEnv.DEFAULT_ETH_CHAIN,
    createdAssets: null,
    ownedAssets: null,
    delegatedAssets: null,
    curatedOwnedAssets: null,
    curatedAssets: null,
    artworkMessage: null,
    switchingWalletState: {
        isSwitching: false,
        error: "",
    },
};

export function getDefaultRepo(walletId: string) {
    const blockchain = getAddrType(walletId);
    return blockchain === "ethereum"
        ? nodeEnv.DEFAULT_ETH_CHAIN
        : nodeEnv.DEFAULT_CHAIN;
}

export const AssetsContext = React.createContext<AssetsState>(null);

export default function AssetsProvider({
    children,
    currentWalletId,
    isAutograph,
    placedAssets = {},
}) {
    const { exhibit: currentExhibit } = useCurrentExhibit();
    const { exhibit: userExhibit, exhibits } = useContext(UserContext);

    const exhibit = currentExhibit || userExhibit;

    const isCurator = exhibits?.find?.(
        (_exhibit) => exhibit?.id === _exhibit?.id
    )?.isCurator;

    const [state, setAssetsContext] = useState<InternalAssetsState>({
        ...initialState,
        custodialWalletType: isAutograph ? "autograph" : null,
        currentWalletId,
        currentRepo: getDefaultRepo(currentWalletId),
        currentActiveTab: isCurator ? "curated" : "owned",
        placedAssets,
        delegatorWalletId: exhibit?.owner,
    });

    const setAssetsProp = <K extends keyof AssetsState>(
        prop: K,
        value: AssetsState[K]
    ) => {
        setAssetsContext((state) => ({
            ...state,
            [prop]: value,
        }));
    };

    // console.log("useOwnedAssets", state.currentRepo);

    const ownedAssets = useOwnedAssets(
        state.currentWalletId,
        state.currentRepo,
        true
    );

    const createdAssets = useCreatedAssets(
        state.currentWalletId,
        state.currentRepo,
        true
    );

    const delegatedAssets = useDelegatedAssets(
        currentWalletId,
        getDefaultRepo(state.currentWalletId),
        true
    );

    // Delays loading until user selects the tab
    const curatedAssets = useCuratedAssets(
        state.delegatorWalletId,
        state.currentRepo,
        state.currentActiveTab === "curated"
    );

    const curatedOwnedAssets = useOwnedCuratedAssets(
        state.delegatorWalletId,
        state.currentRepo,
        state.currentActiveTab === "owned-curated"
    );

    useEffect(() => {
        setAssetsContext((state) => ({
            ...state,
            currentActiveTab: isCurator ? "curated" : "owned",
            currentRepo: getDefaultRepo(state.currentWalletId),
        }));
    }, [isCurator]);

    const value = {
        ...state,
        ownedAssets,
        createdAssets,
        delegatedAssets,
        curatedAssets,
        setAssetsContext,
        setAssetsProp,
        curatedOwnedAssets,
    };

    return (
        <AssetsContext.Provider value={value}>
            {children}
        </AssetsContext.Provider>
    );
}

export function useAssetsContext() {
    return useContext(AssetsContext);
}
