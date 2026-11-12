import { nodeEnv } from "@env";
import { openSeaJson } from "./openSeaFetch";
import { OpenSeaChain } from "@uitypes/Asset";
import { ETHEREUM_PAGE_SIZE } from "./ethereumAssets";

async function queryOpenSeaApi(url: string, signal?: AbortSignal) {
    return openSeaJson(url, signal);
}

export async function fetchChainCollection(
    chain: OpenSeaChain,
    collection: string,
    continuation?: string,
    signal?: AbortSignal
) {
    try {
        const params = new URLSearchParams();
        params.set("limit", String(ETHEREUM_PAGE_SIZE));

        if (continuation) {
            params.set("next", continuation);
        }

        const data = await queryOpenSeaApi(
            `https://api.opensea.io/v2/collection/${collection}/nfts?${params.toString()}`,
            signal
        );

        const assets = (data?.nfts || []).map((asset: any) => {
            if (asset?.name === null) {
                asset.name = asset.identifier;
            }

            asset.blockchain = chain;
            asset.marketplace = chain;
            asset.image_preview_url =
                asset.display_image_url || asset.image_url || null;
            asset.asset_contract = {
                address: asset.contract,
            };
            asset.token_id = asset.identifier;
            asset.permalink = asset.opensea_url;
            asset.source = {
                blockchain: chain,
                api: "opensea",
            };

            return asset;
        });

        const next = data?.next;

        return {
            next,
            assets,
            hasMore: !!next,
        };
    } catch (error) {
        return {
            hasError: true,
            error,
        };
    }
}

export async function fetchChainAsset(
    chain: OpenSeaChain,
    address: string,
    tokenID: string,
    signal?: AbortSignal
) {
    try {
        let data = await queryOpenSeaApi(
            `https://api.opensea.io/v2/chain/${chain}/contract/${address}/nfts/${tokenID}`,
            signal
        );

        const asset = data.nft;

        if (asset) {
            asset.marketplace = chain;
            asset.source = {
                blockchain: chain,
                api: "opensea",
            };
            asset.token_id = asset.identifier;
            asset.asset_contract = {
                address: asset.contract,
            };

            return { success: true, asset };
        }

        return { success: false };
    } catch (error) {
        return {
            hasError: true,
            error,
        };
    }
}
