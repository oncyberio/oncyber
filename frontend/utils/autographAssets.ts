// Only getAddress: importing "ethers" put all of it (providers, contracts,
// wallets) on every page through UserContext. @ethersproject/address is the
// package ethers itself re-exports it from (same 5.8.0 release).
import { getAddress } from "@ethersproject/address";
import { IPFS, ipfsCID, isIPFS } from "./urlUtils";

interface AutographCustomData {
    autographId: string;
}

const MAX_RETRY_COUNT = 1;
const PAGE_SIZE = 50;

const API_PATH = "https://api.autograph.io/v1/api";

type Chain = "matic" | "klaytn";

let idMap: Record<string, string> = {};

export async function getAutographWalletId(walletId: string) {
    let headers = {
        method: "HEAD",
    };

    try {
        const key = walletId.toLowerCase();

        let autographId = idMap[key];

        if (autographId) return autographId;

        let response = await fetch(
            `${API_PATH}/users/profile/nfts?skip=${0}&limit=${1}&address=${walletId}`,
            headers
        );

        if (response.ok) {
            autographId = walletId;
        } else {
            let checksumAddr = getAddress(walletId);

            response = await fetch(
                `${API_PATH}/users/profile/nfts?skip=${0}&limit=${1}&address=${checksumAddr}`,
                headers
            );

            if (response.ok) {
                autographId = checksumAddr;
            }
        }

        if (autographId) {
            idMap[key] = autographId;
        }

        //

        return autographId || null;
    } catch (err) {
        console.error("[isAutographUser]", err);
        return null;
    }
}

export async function isAutographUser(walletId: string) {
   try {
        const id = await getAutographWalletId(walletId);
        return id != null;
   } catch (error) {
        return null;
   }
}

async function queryAutographApi(url: string) {
    const response = await fetch(url, {
        headers: {
            Accept: "application/json",
        },
    });
    if (!response.ok) {
        throw new Error(
            `API Client Error: ${response.status} ${response.statusText}`
        );
    }
    return response.json();
}

export async function fetchOwnedAutographAssets(userId: string, page = 0) {
    const autographId = await getAutographWalletId(userId);
    try {
        let offset = page * PAGE_SIZE;
        let { data, metadata } = await queryAutographApi(
            `${API_PATH}/users/profile/nfts?skip=${offset}&limit=${PAGE_SIZE}&address=${autographId}`
        );

        return {
            assets: data.map((asset, i) => formatAutographAsset(asset, userId)),
            hasMore: metadata.page < metadata.pages,
        };
    } catch (error) {
        console.error(error);
        return {
            hasError: true,
            error,
        };
    }
}

export async function fetchCreatedAutographAssets(creatorId: string) {
    var assets = [];

    return {
        hasError: true,
        error: `Can't yet fetch created assets for autograph`,
        assets: [],
        hasMore: false,
    };
}

export async function fetchAutographAssetById(
    owner: string,
    address: string,
    tokenId: string,
    customData: AutographCustomData
) {
    try {
        const result = await queryAutographApi(
            `${API_PATH}/nfteditions/${customData.autographId}/details`
        );
        return {
            success: true,
            asset: formatAutographAsset(result, owner),
        };
    } catch (error) {
        return { success: false };
    }
}

function preporcessUrl(url: string) {
    if (url == null || !isIPFS(url)) return url;
    return IPFS.autograph(ipfsCID(url));
}

function formatAutographAsset(asset: any, userId: string) {
    const { metadata } = asset;

    let image_url = metadata.image || metadata.http_image || null;
    let animation_url =
        metadata.animation_url || metadata.http_animation_url || null;

    image_url = preporcessUrl(image_url);
    animation_url = preporcessUrl(animation_url);

    const payload = {
        image_preview_url: image_url,
        image_url,
        image_original_url: image_url,
        sell_orders: [],
        top_bid: {},
        animation_url,
        animation_original_url: animation_url,
        name: metadata.name ?? "",
        description: metadata.description ?? null,
        external_link: metadata.external_url ?? null,
        permalink: metadata.external_url ?? null,
        asset_contract: { address: asset.contractAddress ?? null },
        token_id: asset.tokenId,
        owner: {
            address: userId || "",
            user: {
                profile_img_url: "/images/avatar.png",
                username: asset.ownerUsername || "",
            },
        },
        creator: {
            address: `${metadata.autograph_id}@autograph`,
            user: {
                username: metadata.creator?.name || "",
                profile_img_url: "/images/avatar.png",
            },
        },
        collection: {
            id: metadata.nft_collection?.autograph_id ?? null,
            name: metadata.nft_collection?.name ?? "",
            external_url: metadata.nft_collection?.external_url || "",
        },
        isOwned: true,
        blockchain: "ethereum",
        marketplace: "autograph",
        account_base_url: "https://autograph.io/details/",
        supply: metadata.edition_count,
        needsRefetch: false,
        customData: { autographId: asset._id },
    };
    return payload;
}
