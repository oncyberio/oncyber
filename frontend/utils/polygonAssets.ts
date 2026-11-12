import { nodeEnv } from "../env";
import { openSeaJson } from "./openSeaFetch";
import { formatAsset } from "./formatAssets";

const MAX_RETRY_COUNT = 1;
const ETHEREUM_PAGE_SIZE = 50;

const API_PATH = "https://api.opensea.io/api/v2";

type Chain =
    | "matic"
    | "klaytn"
    | "solana"
    | "arbitrum"
    | "bsc"
    | "avalanche"
    | "zora"
    | "base"
    | "optimism"
    | "arbitrum_nova";

async function queryOpenSeaApi(url: string, signal?: AbortSignal) {
    return openSeaJson(url, signal);
}

export async function fetchOwnedChainAssets(
    chain: Chain,
    userId: string,
    page = 0
) {
    try {
        let assets = [];
        let data = await queryOpenSeaApi(
            `https://api.opensea.io/v2/chain/${chain}/account/${userId}/nfts`
        );
        assets = assets.concat(data.nfts);

        while (data.next) {
            try {
                // params.set("owner_address", userId);
                data = await queryOpenSeaApi(
                    `https://api.opensea.io/v2/chain/${chain}/account/${userId}/nfts?next=${data.next}`
                );
                assets = assets.concat(data.nfts);
            } catch (e) {
                console.error("DIDNT GET IT");
                console.error(e);
                break;
            }
        }

        assets.forEach((asset) => {
            asset.marketplace = chain;
            asset.asset_contract = {};
            asset.asset_contract = {
                address: asset.contract,
            };

            asset.token_id = asset.identifier;
            asset.source = {
                blockchain: chain,
                api: "opensea",
            };
        });

        return {
            assets: assets,
            hasMore: false,
        };
    } catch (error) {
        return {
            hasError: true,
            error,
        };
    }
}

export async function fetchCreatedChainAssets(creatorId: string, chain: Chain) {
    var assets = [];

    return {
        hasError: true,
        error: `Can't yet fetch created assets for chain ${chain}`,
        assets: [],
        hasMore: false,
    };
}

export async function fetchChainAssetById(
    chain: Chain,
    owner: string,
    address: string,
    tokenId: string
) {

    try {
        let data = await queryOpenSeaApi(
            `https://api.opensea.io/v2/chain/${chain}/contract/${address}/nfts/${tokenId}`
        );

        const asset = data.nft;

        if (
            asset?.animation_url &&
            asset.animation_url.startsWith("https://storage.opensea.io/files/")
        ) {
            //
            asset.animation_url = asset.animation_url.replace(
                "https://storage.opensea.io/",
                "https://openseauserdata.com/"
            );
        }

        // if (asset?.owners) {
        //     const isOwner = asset.owners.find((_owner) => {
        //         return (
        //             _owner.address?.toLowerCase?.() === owner.toLowerCase?.()
        //         );
        //     });

        //     if (!isOwner) return { success: false };
        // }

        if (asset) {
            asset.marketplace = chain;
            asset.source = {
                blockchain: chain,
                api: "opensea",
            };
            asset.token_id = asset.identifier;
            asset.asset_contract = {};
            asset.asset_contract = {
                address: asset.contract,
            };

            return { success: true, asset };
        }
        return { success: false };
    } catch (e) {
        console.error(e);
        return { success: false };
    }
}
