import { useDebouncedValue } from "@components/hooks/usDebouncedValue";
import { AssetsData, UseAssetsData } from "@components/hooks/useAssets";
import type { WalletConnection } from "@dapp/connect";
import {
    fetchEthAssetsByQuery,
    fetchEthereumAssetById,
} from "@utils/ethereumAssets";
import { formatAsset } from "@utils/formatAssets";
import { isEthereumAddress } from "@utils/getAddrType";
import useSWR from "swr";

const emptyResult: UseAssetsData = {
    state: "LoadingSuccess",
    data: { assets: [], hasMore: false },
};

const OS_ASSET_PREFIX = "https://opensea.io/assets/ethereum/";

const OS_COLLECTION_PREFIX = "https://opensea.io/collection/";

export function parseQuery(id: string): {
    blockchain: WalletConnection["type"];
    collection: string;
    tokenId: string;
} {
    //
    if (!id) return null;

    if (id.startsWith(OS_COLLECTION_PREFIX)) {
        const collection = id.slice(OS_COLLECTION_PREFIX.length);

        return { blockchain: "ethereum", collection, tokenId: null };
    }

    if (id.startsWith(OS_ASSET_PREFIX)) {
        id = id.slice(OS_ASSET_PREFIX.length);
    }

    const ps = id.split("/");
    if (ps.length === 0) return null;

    if (!isEthereumAddress(ps[0])) return null;

    return { blockchain: "ethereum", collection: ps[0], tokenId: ps[1] };
}

async function fetcher([blockchain, addr, tokenId]: [
    WalletConnection["type"],
    string,
    string
]) {
    //
    // console.log("swr", status, walletId, addr, tokenId);
    if (!addr) return null;

    if (blockchain === "ethereum") {
        if (tokenId) {
            const data = await fetchEthereumAssetById(addr, tokenId);

            if (data.success) {
                const asset = formatAsset(data.asset);
                // @ts-ignore
                asset.needsEthRecheck = true;
                const res: AssetsData = {
                    assets: [asset],
                    hasMore: false,
                };

                return res;
            }
        } else {
            const data = await fetchEthAssetsByQuery({
                collection: addr,
                tokenIds: tokenId ? [tokenId] : [],
            });

            if (data?.assets) {
                data.assets = data.assets.map((it) => {
                    const asset = formatAsset(it);

                    // @ts-ignore
                    asset.needsEthRecheck = true;

                    return asset;
                });

                return data;
            }
        }

        return emptyResult.data;
    }

    // if (!result.success) throw new Error("Failed to fetch asset");

    // return result.asset;
    return null;
}

export function useRemoteAssetsQuery(query: string): UseAssetsData {
    //

    const value = useDebouncedValue(query, 1000);

    const parse = parseQuery(value);

    const { data, error, isLoading } = useSWR(
        //
        [parse?.blockchain, parse?.collection, parse?.tokenId],
        fetcher,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            refreshInterval: 1000_000_000,
        }
    );

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
        data,
    };
}
