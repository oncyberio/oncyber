import { CollectionData } from "@uitypes/experience";
import { openSeaJson } from "./openSeaFetch";
import { nodeEnv } from "../env";
import { isEthereumAddress } from "./getAddrType";
import { delay, Failure, Result, Success } from "./js";

const MAX_RETRY_COUNT = 1;
export const ETHEREUM_PAGE_SIZE = 50;
const EVENTS_PAGE_SIZE = 50;

export const RESERVOIR_NETWORK = {
    ethereum: "https://api.reservoir.tools",
    arbitrum: "https://api-arbitrum.reservoir.tools",
    avalanche: "https://api-avalanche.reservoir.tools",
    matic: "https://api-polygon.reservoir.tools",
    base: "https://api-base.reservoir.tools",
    bsc: "https://api-bsc.reservoir.tools",
    zora: "https://api-zora.reservoir.tools",
    sepolia: "https://api-sepolia.reservoir.tools",
    optimism: "https://api-optimism.reservoir.tools",
};

async function queryOpenSeaApi(url: string, signal?: AbortSignal) {
    // throttle
    await delay(300);
    try {
        return await openSeaJson(url, signal);
    } catch (error) {
        console.error(error);
    }
}

export async function queryReservoirApi(
    url: string,
    chain?: string,
    signal?: AbortSignal
) {
    const baseurl = !chain
        ? nodeEnv.RESERVOIR_API
        : RESERVOIR_NETWORK[chain] ?? nodeEnv.RESERVOIR_API;

    const queryUrl = `${baseurl}/${url}`;

    try {
        const response = await fetch(queryUrl, {
            headers: {
                "x-api-key": nodeEnv.RESERVOIR_API_KEY,
                Accept: "application/json",
            },
            signal,
        });

        if (!response.ok) {
            throw new Error(
                `API Client Error: ${response.status} ${response.statusText}`
            );
        }

        return response.json();
    } catch (error) {
        console.error(error);
    }
}

export async function fetchOwnedEthereumAssets(userId: string, next?: string) {
    try {
        // Reservoir's hosted API (the previous provider here) was shut
        // down — owned tokens now come from OpenSea v2, like the other
        // chains (see fetchOwnedChainAssets in polygonAssets)
        let url = `chain/ethereum/account/${userId}/nfts?limit=${ETHEREUM_PAGE_SIZE}`;

        if (next) {
            url += `&next=${encodeURIComponent(next)}`;
        }

        const data = await queryOpenSeaApi(url);

        if (data == null) {
            throw new Error("Failed to fetch owned assets from OpenSea");
        }

        const assets = (data.nfts || []).map((asset) => {
            asset.token_id = asset.identifier;
            asset.asset_contract = { address: asset.contract };
            asset.image_preview_url =
                asset.display_image_url || asset.image_url;
            asset.animation_url =
                asset.animation_url || asset.display_animation_url;
            asset.source = {
                blockchain: "ethereum",
                api: "opensea",
            };
            return asset;
        });

        return {
            assets,
            hasMore: data.next,
        };
    } catch (error) {
        return {
            hasError: true,
            error,
        };
    }
}

async function fetchEvents(creatorId: string, cursor: string, retryCount = 0) {
    try {
        let params = new URLSearchParams();

        if (cursor) {
            params.set("next", cursor);
        }

        params.set("event_type", "transfer");

        params.set("limit", String(EVENTS_PAGE_SIZE));

        const data = await queryOpenSeaApi(
            `events/accounts/${creatorId}?${params}`
        );

        return data;
    } catch (err) {
        if (retryCount >= MAX_RETRY_COUNT) throw err;
        await fetchEvents(creatorId, cursor, retryCount + 1);
    }
}

export async function fetchCreatedEthereumAssets(creatorId) {
    var assets = [];
    let events = [];
    let data = null;
    let hasError = false;
    let error;

    try {
        do {
            data = await fetchEvents(creatorId, data?.next);
            if (data?.asset_events != null) {
                events = events.concat(data.asset_events);
            }
        } while (data?.next);
    } catch (err) {
        console.error(err);
        hasError = true;
        error = err.message;
    }

    events.forEach((e, i) => {
        var url_extension =
            e?.asset?.asset_contract?.address + "/" + e?.asset?.token_id;
        const wasMinted =
            e?.event_type == "transfer" &&
            e?.from_account?.user?.username == "NullAddress";
        if (e?.asset && !assets.includes(url_extension) && wasMinted) {
            e.asset.needsRefetch = true;
            assets.push(e?.asset);
        }
    });

    return {
        hasError,
        error,
        assets,
        hasMore: false,
    };
}

export async function fetchEthereumAssetById(
    address: string,
    tokenId: string,
    ownership?: string
) {
    try {
        const params = new URLSearchParams();

        // if (ownership) {
        //     //
        //     params.set("account_address", ownership);
        // }

        const url = `chain/ethereum/contract/${address}/nfts/${tokenId}`;

        const response = await queryOpenSeaApi(url);

        const data = response?.nft;

        if (!data?.identifier) {
            return { success: false };
        }

        // if (data.owner == null) {
        //     data.owner = data.top_ownerships?.[0]?.owner;
        // }

        if (data?.name == null) {
            data.name = data.identifier;
        }

        if (
            data?.animation_url &&
            data.animation_url.startsWith("https://storage.opensea.io/files/")
        ) {
            //
            data.animation_url = data.animation_url.replace(
                "https://storage.opensea.io/",
                "https://openseauserdata.com/"
            );
        }

        data.ownerships = data?.owners?.map((it) => {
            const res = {
                owner: it.owner,
                quantity: +it.quantity,
            };

            return res;
        });

        return { success: true, asset: data };
    } catch (e) {
        console.error(e);
        return { success: false };
    }
}

export async function fetchEthereumNftOwners(address, tokenId) {
    const params = new URLSearchParams();

    params.set("asset_contract_address", address);
    params.set("token_id", tokenId);
    params.set("limit", "1");

    try {
        const res = await queryOpenSeaApi(`asset/${address}/${tokenId}/owners`);

        const data = res.owners?.map((it) => it.owner);

        return { success: true, data };
    } catch (err) {
        console.error(err);
        return { success: false, error: err.message };
    }
}

export async function isOwnerOfEtherumNft(
    owner: string,
    { slug, blockchain = "ethereum" }: { slug?: string; blockchain?: string }
): Promise<Result<boolean>> {
    try {
        // Reservoir (the previous provider here) was shut down — check via
        // OpenSea v2. `slug` is an OpenSea collection slug; callers check
        // on-chain when they have a contract address instead
        const chain = blockchain === "polygon" ? "matic" : blockchain;

        let url = `chain/${chain}/account/${owner}/nfts?limit=1`;

        if (slug) {
            url += `&collection=${slug}`;
        }

        const data = await queryOpenSeaApi(url);

        if (data == null) {
            throw new Error("Failed to query OpenSea");
        }

        return Success(data.nfts?.length > 0);
    } catch (error) {
        return Failure(
            error.message || "Failed to get ownership info from opensea"
        );
    }
}

export async function fetchEthereumCollection(
    slug: string
): Promise<Result<CollectionData[]>> {
    try {
        const data = await queryOpenSeaApi(`collections/${slug}`);

        if (!data.collection) {
            return Success([]);
        }

        return Success([formatCollection(data)]);
    } catch (e) {
        console.error(e);
        return Failure(e.message || "Failed to fetch opensea collection");
    }
}

export async function fetchEthereumUserCollections(
    wallet: string
): Promise<Result<CollectionData[]>> {
    try {
        const params = new URLSearchParams();

        params.set("asset_owner", wallet);

        const data = await queryOpenSeaApi(`collections?${params}`);

        if (!Array.isArray(data)) {
            return Success([]);
        }

        return Success(data.map(formatCollection));
    } catch (e) {
        console.error(e);
        return Failure(e.message || "Failed to fetch opensea collection");
    }
}

function formatCollection(raw): CollectionData {
    //
    const contract = raw.contracts?.[0];

    return {
        slug: raw.collection,
        name: raw.name,
        image: raw.image_url,
        address: contract?.address,
        blockchain: contract?.chain || "ethereum",
        verified: raw.safelist_request_status === "verified",

        // makes owenrship checking fatser
        type: contract?.schema_name,
    };
}

export interface EthFetchAssetsQuery {
    collection: string;
    tokenIds: string[];
    continuation?: string;
    signal?: AbortSignal;
    limit?: string;
    fetchWithLimit?: boolean;
}

async function getAssetsByQuery(query: EthFetchAssetsQuery) {
    const { collection, tokenIds, continuation, limit } = query;

    let count = 0;

    const params = new URLSearchParams();
    if (isEthereumAddress(collection)) {
        params.set("asset_contract_address", collection);
    } else if (collection) {
        params.set("collection", collection);
    }

    if (limit) {
        params.set("limit", limit);
    }

    tokenIds?.forEach((id) => {
        params.append("token_ids", id);
    });

    if (continuation) {
        params.set("cursor", continuation);
    }

    count++;
    const result = await queryOpenSeaApi(`assets?${params}`);

    return result;
}

export async function fetchEthAssetsByQuery(query: EthFetchAssetsQuery) {
    const { collection, tokenIds, continuation, signal, fetchWithLimit } =
        query;

    let assets = [];
    let result;
    let error;
    let hasError = false;

    let count = 0;

    if (!fetchWithLimit) {
        do {
            try {
                result = await getAssetsByQuery({
                    collection,
                    tokenIds,
                    continuation: result?.next,
                    signal,
                });

                const retAssets = result?.assets;

                assets = assets.concat(retAssets);
            } catch (err) {
                error = err;
                hasError = true;
                break;
            }
        } while (result.next && count < 5);
    } else {
        //
        try {
            result = await getAssetsByQuery({
                collection,
                tokenIds,
                continuation,
                signal,
                limit: "20",
            });

            const retAssets = result?.assets;

            assets = assets.concat(retAssets);
        } catch (err) {
            error = err;
            hasError = true;
        }
    }

    return {
        assets,
        hasMore: false,
        hasError,
        error,
        next: result?.next,
    };
}
