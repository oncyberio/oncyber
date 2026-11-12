import { useContext, useEffect, useState } from "react";
import { UserContext } from "../context/UserContext";
import { formatAssets } from "../../utils/formatAssets";
import { selectUserId } from "../../utils/assets";
import { WalletConnection } from "../../dApp/connect";
import { fetchOwnedEthereumAssets } from "../../utils/ethereumAssets";
import {
    fetchAssetById,
    fetchCreatedAssets,
    fetchOwnedAssets,
} from "../../utils/fetchAssets";
import { getChainAssets, getSharedAssets } from "../../utils/saveToDb";
import { getAddrType } from "../../utils/getAddrType";
import { fetchOwnedChainAssets } from "../../utils/polygonAssets";
import { fetchOwnedAutographAssets } from "../../utils/autographAssets";
import { fetchOwnedNftPortAssets } from "../../utils/nftPortAssets";
import { fetchOwnedPoapAssets } from "../../utils/poapAssets";
import useSWR, { KeyedMutator } from "swr";
import { useCurrentExhibit } from "@components/context/ExhibitContext";
import { nodeEnv } from "@env";

export type Chain = WalletConnection["type"];

export type UserStatus = "owned" | "created" | "delegated";

export type PortalStatus = "owned" | "collab" | "search";

export type AssetRepository =
    | "default"
    | "polygon"
    | "klaytn"
    | "nftport"
    | "arbitrum"
    | "arbitrum_nova"
    | "optimism"
    | "avalanche"
    | "zora"
    | "base"
    | "bsc"
    | "poap"
    | "autograph";

export const OPENSEA_CHAINS = [
    "polygon",
    "matic", // polygon alias
    "klaytn",
    "arbitrum",
    "arbitrum_nova",
    "optimism",
    "avalanche",
    "zora",
    "base",
    "bsc",
];

const noop = (): any => {};
const emptyArray = [];

export interface AssetsData {
    assets?: any[];
    hasMore?: boolean;
    hasError?: boolean;
    error?: any;
    next?: string;
    isLoadingMore?: boolean;
}

export interface UseAssetsData {
    state: "InitialLoading" | "LoadingMore" | "LoadingSuccess" | "LoadinError";
    data?: AssetsData;
    loadMore?: () => void;
    mutate?: KeyedMutator<AssetsData>;
    abord?: (reason?: any) => void;
    next?: string;
    nextPage?: () => void;
}

export function getDefaultRepo(walletId: string) {
    const blockchain = getAddrType(walletId);
    return blockchain === "ethereum"
        ? nodeEnv.DEFAULT_ETH_CHAIN
        : nodeEnv.DEFAULT_CHAIN;
}

async function fetchOwnedRepoAssets(
    walletId: string,
    repos: AssetRepository,
    page: any
): Promise<AssetsData> {
    if (repos === "default") {
        return fetchOwnedAssets(walletId, page);
    } else if (repos === "nftport") {
        return fetchOwnedNftPortAssets(walletId);
    } else if (repos === "autograph") {
        return fetchOwnedAutographAssets(walletId, page);
    } else if (repos === "poap") {
        return fetchOwnedPoapAssets(walletId);
    } else if (OPENSEA_CHAINS.includes(repos)) {
        const chain = repos === "polygon" ? "matic" : repos;
        return fetchOwnedChainAssets(chain, walletId, page);
    } else {
        console.error("Unknown chain", repos);
    }
}

async function fetchAssets(
    exhibitId: string,
    status: UserStatus,
    walletId: string,
    repos: AssetRepository,
    page: number
): Promise<AssetsData> {
    try {
        switch (status) {
            case "owned":
                return fetchOwnedRepoAssets(walletId, repos, page);
            case "created":
                return fetchCreatedAssets(walletId, repos, page);
            case "delegated":
                const result = await getSharedAssets(walletId, exhibitId);
                if (result.error) {
                    return { hasError: true, error: result.error };
                }
                return { assets: result.assets, hasMore: false };
        }
    } catch (error) {
        return { hasError: true, error };
    }
}

//! We can add pause/play feature too
export function useAssets(
    walletId: string,
    repo: AssetRepository,
    assetStatus: UserStatus,
    load: boolean
) {
    //

    const exhibitCtx = useCurrentExhibit();
    const {
        userData,
        exhibit: userExhibit,
        exhibits,
    } = useContext(UserContext);

    const exhibit = exhibitCtx?.exhibit || userExhibit;

    const [assetsState, setAssetsState] = useState<
        Record<string, UseAssetsData>
    >({});

    const exhibitMetadata = exhibits?.find?.(
        (_exhibit) => exhibit?.id === _exhibit?.id
    );

    const userId = selectUserId(walletId);

    const diffWallet = userData?.walletId != walletId;

    const key = `${assetStatus}-${userId}-${repo}`;
    const selectedState = assetsState[key];

    async function fetcher(
        walletId: string,
        repos: AssetRepository,
        status: UserStatus,
        currentPage: any
    ) {
        const result = await fetchAssets(
            exhibit?.id,
            status,
            walletId,
            repos,
            currentPage
        );

        if (result.assets?.length && assetStatus !== "delegated") {
            result.assets = formatAssets(
                result.assets,
                noop,
                assetStatus === "created",
                {
                    avatar: diffWallet ? "" : userData?.avatar || "",
                    walletId: walletId,
                    username: diffWallet ? "" : userData?.username || "",
                }
            ).assets;
        }
        // refactor fetchXXX methods to return formatted assets

        const loadMore = () => {
            const page =
                repos === "default" ? result?.hasMore : currentPage + 1;

            fetcher(walletId, repos, status, page);
        };

        const chain = getAddrType(walletId);
        const autoRefetchPages = !(chain === "solana" && status === "created");

        setAssetsState((state) => {
            const selectedState = state[key];
            let newState: UseAssetsData;
            if (result.hasError) {
                newState = {
                    data: {
                        ...result,
                        assets: [].concat(
                            selectedState.data?.assets || emptyArray,
                            result.assets || emptyArray
                        ),
                    },
                    state: "LoadinError",
                    loadMore: null,
                };
            } else {
                newState = {
                    data: {
                        ...result,
                        assets: [].concat(
                            selectedState.data?.assets || emptyArray,
                            result.assets || emptyArray
                        ),
                    },
                    state: result.hasMore ? "LoadingMore" : "LoadingSuccess",
                    loadMore:
                        result.hasMore && !autoRefetchPages ? loadMore : null,
                };
            }

            return {
                ...state,
                [key]: newState,
            };
        });

        if (!result.hasError && result.hasMore && autoRefetchPages) {
            loadMore();
        }
    }

    useEffect(() => {
        // If not owner or admin curator don't load delegated assets
        if (
            assetStatus === "delegated" &&
            !exhibitMetadata?.isAdminCurator &&
            exhibit?.owner !== walletId
        ) {
            // setAssetsState((state) => ({
            //     ...state,
            //     [key]: {
            //         state: "InitialLoading",
            //         loadMore: null,
            //         data: {},
            //     },
            // }));
        } else {
            if (load && !selectedState && walletId) {
                setAssetsState((state) => ({
                    ...state,
                    [key]: {
                        state: "InitialLoading",
                        loadMore: null,
                    },
                }));

                fetcher(userId, repo, assetStatus, 0);
            }
        }
    }, [userId, repo, assetStatus, load, exhibits]);

    return selectedState;
}

export function useCreatedAssets(
    walletId: string,
    repo: AssetRepository,
    load: boolean
) {
    return useAssets(walletId, repo, "created", load);
}

export function useOwnedAssets(
    walletId: string,
    repo: AssetRepository,
    load: boolean
) {
    return useAssets(walletId, repo, "owned", load);
}

export function useDelegatedAssets(
    walletId: string,
    repo: AssetRepository,
    load: boolean
) {
    return useAssets(walletId, repo, "delegated", load);
}
