import { useDebouncedValue } from "@components/hooks/usDebouncedValue";
import { AssetsData, UseAssetsData } from "@components/hooks/useAssets";
import type { Blockchain, WalletConnection } from "@dapp/connect";
import { useEffect, useState } from "react";
import {
    fetchEthAssetsByQuery,
    fetchEthereumAssetById,
} from "@utils/ethereumAssets";
import { fetchChainAsset, fetchChainCollection } from "@utils/fetchOSChain";
import { formatAsset } from "@utils/formatAssets";
import { useEventCallback } from "@components/hooks/useEventCallback";
import useSWRInfinite from "swr/infinite";
import { fetchSolanaAssetById } from "@utils/solanaAssets";
import { OpenSeaChain } from "@uitypes/Asset";
import { fetchCounterPartyAssetById } from "@utils/counterpartyAssets";
import {
    fetchTezosAssetById,
    fetchTezosCollectionAssets,
    formatTezosAsset,
} from "@utils/tezosAssets";

const emptyResult: UseAssetsData = {
    state: "LoadingSuccess",
    data: { assets: [], hasMore: false },
    next: null,
};

export const OS_ASSET_PREFIX = "https://opensea.io/assets/";

export const OS_ITEM_PREFIX = "https://opensea.io/item/";

export const COUNTER_PARTY_REFIX = "https://xchain.io/asset/";

export const OS_COLLECTION_PREFIX = "https://opensea.io/collection/";

export const OBJKT_ASSET_PREFIX = "https://objkt.com/tokens/";

export const OBJKT_COLLECTION_PREFIX = "https://objkt.com/collections/";

const OPEN_SEA_CHAIN_SLUGS = new Set([
    "ethereum",
    "matic",
    "polygon",
    "klaytn",
    "solana",
    "arbitrum",
    "arbitrum-nova",
    "bsc",
    "avalanche",
    "zora",
    "base",
    "optimism",
]);

function normalizeOpenSeaChain(chain: string) {
    switch (chain?.toLowerCase?.()) {
        case "polygon":
            return "matic";
        case "arbitrum-nova":
            return "arbitrum_nova";
        default:
            return chain?.toLowerCase?.();
    }
}

function parseOpenSeaAssetPath(id: string) {
    try {
        const url = new URL(id);

        if (!url.hostname.endsWith("opensea.io")) {
            return null;
        }

        const parts = url.pathname.split("/").filter(Boolean);
        const [route, maybeChain, maybeCollection, maybeTokenId] = parts;

        if (!(route === "assets" || route === "item")) {
            return null;
        }

        if (parts.length >= 4) {
            return {
                blockchain: normalizeOpenSeaChain(maybeChain) as any,
                collection: maybeCollection,
                tokenId: maybeTokenId,
                provider: "opensea",
                type: "asset",
            };
        }

        if (route === "assets" && parts.length >= 3) {
            if (OPEN_SEA_CHAIN_SLUGS.has(normalizeOpenSeaChain(maybeChain))) {
                return null;
            }

            return {
                blockchain: "ethereum" as const,
                collection: maybeChain,
                tokenId: maybeCollection,
                provider: "opensea",
                type: "asset",
            };
        }
    } catch (error) {
        return null;
    }

    return null;
}

export function parseQuery(
    id: string,
    openSeaColChain = "ethereum"
): {
    blockchain: WalletConnection["type"];
    collection: string;
    tokenId: string;
    provider: string;
    type: string;
} {
    //

    if (!id) return null;

    if (id.startsWith(COUNTER_PARTY_REFIX)) {
        id = id.slice(COUNTER_PARTY_REFIX.length);

        const ps = id.split("/");
        if (ps.length === 0) return null;

        return {
            blockchain: "counterparty",
            collection: "none",
            tokenId: ps[0],
            provider: "counterparty",
            type: "asset",
        };
    }

    if (id.startsWith(OS_COLLECTION_PREFIX)) {
        const collection = id.slice(OS_COLLECTION_PREFIX.length);

        if (!collection) return null;

        return {
            // @ts-ignore
            blockchain: openSeaColChain,
            collection,
            tokenId: null,
            provider: "opensea",
            type: "collection",
        };
    }

    if (id.startsWith(OS_ASSET_PREFIX)) {
        return parseOpenSeaAssetPath(id);
    }

    if (id.startsWith(OS_ITEM_PREFIX)) {
        return parseOpenSeaAssetPath(id);
    }

    if (id.startsWith(OBJKT_COLLECTION_PREFIX)) {
        const collection = id.slice(OBJKT_COLLECTION_PREFIX.length);

        if (!collection) return null;

        return {
            blockchain: "tezos",
            collection,
            tokenId: null,
            provider: "objkt",
            type: "collection",
        };
    }

    if (id.startsWith(OBJKT_ASSET_PREFIX)) {
        id = id.slice(OBJKT_ASSET_PREFIX.length);

        const ps = id.split("/");
        if (ps.length === 0) return null;

        return {
            blockchain: "tezos",
            collection: ps[0],
            tokenId: ps[1],
            provider: "objkt",
            type: "asset",
        };
    }

    return null;
}

export async function fetcher([
    url,
    [keys, previousPageData, index, abortController],
]) {

    const [blockchain, addr, tokenId, provider, type] = keys;

    let continuation = null;

    if (previousPageData?.next) {
        continuation = previousPageData.next;
    }

    if (provider === "opensea") {
        //

        if (blockchain === "solana" && type === "asset") {
            //
            const data = await fetchSolanaAssetById("", addr);

            if (data?.success) {
                const asset = formatAsset(data.asset);

                const res: AssetsData = {
                    assets: [asset],
                    hasMore: false,
                    next: null,
                };

                return res;
            }
        } else if (blockchain === "ethereum") {

            if (!tokenId) {
                const data = await fetchChainCollection(
                    blockchain as OpenSeaChain,
                    addr,
                    continuation,
                    abortController.signal
                );
                if (data?.assets) {
                    data.assets = data.assets.map((it) => {
                        //
                        const asset = formatAsset(it);
                        asset.provider = "OpenSea";
                        // @ts-ignore
                        asset.needsEthRecheck = true;
                        return asset;
                    });
                    return data;
                }
            } else {
                const data = await fetchEthereumAssetById(addr, tokenId);

                if (data.success) {
                    const asset = formatAsset(data.asset);
                    // @ts-ignore
                    asset.needsEthRecheck = true;
                    const res: AssetsData = {
                        assets: [asset],
                        hasMore: false,
                        next: null,
                    };
                    return res;
                }
            }
        } else if (!tokenId) {
            const data = await fetchChainCollection(
                blockchain as OpenSeaChain,
                addr,
                continuation,
                abortController.signal
            );
            if (data?.assets) {
                data.assets = data.assets.map((it) => {
                    //
                    const asset = formatAsset(it);
                    asset.provider = "OpenSea";
                    // @ts-ignore
                    asset.needsEthRecheck = true;
                    return asset;
                });
                return data;
            }
        } else {
            //

            const data = await fetchChainAsset(
                blockchain as OpenSeaChain,
                addr,
                tokenId,
                abortController.signal
            );

            if (data.success) {
                const asset = formatAsset(data.asset);

                asset.provider = "OpenSea";

                // @ts-ignore
                asset.needsEthRecheck = true;
                const res: AssetsData = {
                    assets: [asset],
                    hasMore: false,
                };

                return res;
            }
        }

        return emptyResult.data;
    }

    if (provider === "counterparty") {
        const data = await fetchCounterPartyAssetById(tokenId);

        if (data.success) {
            const asset = data.asset;

            return {
                assets: [asset],
                hasMore: false,
                next: null,
            };
        }
    }

    if (provider === "objkt") {
        //

        if (tokenId) {
            const data = await fetchTezosAssetById(
                null,
                addr,
                tokenId,
                abortController.signal
            );

            if (data.success) {
                let asset = formatAsset(data.asset);
                asset.account_base_url = "https://objkt.com/profile";
                asset.provider = "Objkt";
                // @ts-ignore
                asset.needsEthRecheck = true;
                const res: AssetsData = {
                    assets: [asset],
                    hasMore: false,
                };

                return res;
            }
        } else {
            const data = await fetchTezosCollectionAssets(
                addr,
                index,
                abortController.signal
            );

            if (data.success) {
                const collectionItems = data.value;

                const assetPromises = [];

                if (Array.isArray(collectionItems)) {
                    collectionItems.forEach((item) => {
                        if (item?.assets) {
                            const assetPromisesForItem = item.assets.map(
                                async (asset) => {
                                    let formattedAsset = await formatTezosAsset(
                                        asset,
                                        null,
                                        null
                                    );

                                    return formattedAsset;
                                }
                            );

                            assetPromises.push(...assetPromisesForItem);
                        }
                    });
                }

                const assets = await Promise.all(assetPromises);

                return {
                    assets,
                    hasMore: false,
                    hasError: false,
                    error: null,
                    next: assets.length === 0 ? null : true,
                };
            }
        }

        return emptyResult.data;
    }

    return null;
}

export function useInfiniteRemoteAssetsQuery(
    query: string,
    chain = null
): UseAssetsData {
    //

    const [abortController, setAbortController] = useState(null);

    useEffect(() => {
        const controller = new AbortController();
        setAbortController(controller);

        return () => {
            controller.abort();
        };
    }, []);

    const value = useDebouncedValue(query, 1000);

    const parse = parseQuery(value, chain);

    const params = [
        parse?.blockchain,
        parse?.collection,
        parse?.tokenId,
        parse?.provider,
        parse?.type,
    ];

    const { data, size, error, isLoading, setSize } = useSWRInfinite(
        (index, previousPageData) => {
            return [query, [params, previousPageData, index, abortController]];
        },
        fetcher,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            refreshInterval: 1000_000_000,
        }
    );

    const nextPage = useEventCallback(() => {
        setSize((prevSize) => prevSize + 1);
    }, []);

    let assets = [];
    let next = null;

    for (const item of data || []) {
        //
        if (Array.isArray(item?.assets)) {
            //
            assets = [...assets, ...item.assets];

            next = item?.next || null;
        }
    }

    if (parse == null) return null;

    if (error) {
        return {
            state: "LoadinError",
            data: { hasError: true, hasMore: false, error },
        };
    }

    if (isLoading) {
        return {
            state: "InitialLoading",
        };
    }

    return {
        state: "LoadingSuccess",
        next,
        data: {
            assets,
        },
        nextPage,
    };
}
