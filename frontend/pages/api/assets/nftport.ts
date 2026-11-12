import { corsMiddleware } from "../../../utils/middlewares/corsMiddleware";

const PAGE_SIZE = 50;

type NFTPortReq =
    | { type: "byOwner"; owner: string }
    | { type: "byCreator"; creator: string }
    | { type: "byId"; owner: string; address: string; tokenId: string };

const API_PATH = "https://api.nftport.xyz/v0";
const NFTPORT_API_KEY = process.env.NFTPORT_API_KEY;

export default async (req, res) => {
    await corsMiddleware(req, res);

    let params = req.query as NFTPortReq;

    let result;
    if (params.type === "byOwner") {
        result = await fetchOwnedNftPortAssets(params.owner);
    } else if (params.type === "byCreator") {
        result = await fetchCreatedNftPortAssets(params.creator);
    } else if (params.type === "byId") {
        result = await fetchNftPortAssetById(
            params.owner,
            params.address,
            params.tokenId
        );
    } else {
        return res
            .status(400)
            .json({ hasError: true, error: "Invalid request" });
    }

    if (result.hasError) {
        return res.status(404).json(result);
    } else {
        return res.json(result);
    }
};

async function queryNftPortApi(url: string) {
    const response = await fetch(url, {
        headers: {
            Authorization: NFTPORT_API_KEY,
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

export async function fetchNftPortAssets(
    userId: string,
    status: "owned" | "created"
) {
    try {
        let data, continuation;
        let assets = [];
        let owner = "",
            creator = "";
        if (status === "created") {
            creator = userId;
        } else if (status === "owned") {
            owner = userId;
        }
        do {
            data = await queryNftPortApi(
                `${API_PATH}/accounts/${
                    status === "created" ? "creators/" : ""
                }${userId}?chain=ethereum&include=metadata&page_size=${PAGE_SIZE}${
                    continuation ? `&continuation=${continuation}` : ""
                }`
            );
            continuation = data.continuation;
            if (data.response === "OK") {
                assets = assets.concat(
                    data?.nfts
                        .map((asset) =>
                            formatNftPortAsset(
                                asset,
                                null,
                                owner,
                                creator,
                                process.env.NODE_ENV === "development"
                                    ? {
                                          rawAsset: asset,
                                      }
                                    : null
                            )
                        )
                        .filter((it) => it != null)
                );
            }
        } while (continuation);
        return {
            assets,
            hasMore: false,
        };
    } catch (error) {
        console.error("Error fetching NftPort assets", error);
        return {
            hasError: true,
            error,
        };
    }
}

export async function fetchOwnedNftPortAssets(userId: string) {
    return fetchNftPortAssets(userId, "owned");
}

export async function fetchCreatedNftPortAssets(creatorId: string) {
    return fetchNftPortAssets(creatorId, "created");
}

export async function fetchNftPortAssetById(
    owner: string,
    address: string,
    tokenId: string
) {
    let data = await queryNftPortApi(
        `${API_PATH}/nfts/${address}/${tokenId}?chain=ethereum`
    );

    if (data.response === "OK") {
        return {
            success: true,
            asset: formatNftPortAsset(data.nft, data.contract, owner, ""),
        };
    }
    return { success: false };
}

const IPFS_PREF = "ipfs://";
const IPFS_IPFS_PREF = "ipfs://ipfs/";

function isIpfsHash(x: string) {
    // Should be enough, as this is the last resort
    return x?.length === 46;
}

function ipfsToHttp(url: string) {
    if (url?.startsWith(IPFS_IPFS_PREF)) {
        return `https://ipfs.io/ipfs/${url.slice(IPFS_IPFS_PREF.length)}`;
    } else if (url?.startsWith(IPFS_PREF)) {
        return `https://ipfs.io/${url.slice(IPFS_PREF.length)}`;
    } else if (url?.startsWith("https://") || url?.startsWith("http://")) {
        return url;
    } else if (isIpfsHash(url)) {
        return `https://ipfs.io/ipfs/${url}`;
    } else {
        return null;
    }
}

const videoExts = [".mov", ".mp4", ".avi"];

function isVideoExt(url: string) {
    if (!url) return false;
    return videoExts.some((ext) => url.endsWith(ext));
}

function formatNftPortAsset(
    asset,
    contract,
    userId: string,
    creatorId: string,
    customData?: any
) {
    let animation_url = ipfsToHttp(asset.metadata.animation_url);
    let image_url = ipfsToHttp(asset.cached_file_url || asset.metadata.image);

    if (animation_url) {
        if (isVideoExt(image_url)) {
            image_url = null;
        }
    } else {
        if (isVideoExt(image_url)) {
            animation_url = image_url;
            image_url = null;
        }
    }

    if (!image_url && !animation_url) return null;

    const metadata = asset.metadata;

    const payload = {
        image_preview_url: image_url,
        image_url,
        image_original_url: image_url,
        sell_orders: [],
        top_bid: {},
        animation_url,
        animation_original_url: animation_url,
        name: asset.name || metadata.name || "",
        description: asset.description || metadata.description || "",
        external_link: metadata.external_url ?? null,
        permalink: metadata.external_url ?? null,
        asset_contract: { address: asset.contract_address ?? null },
        token_id: asset.token_id,
        owner: {
            address: userId || "",
            user: {
                profile_img_url: "/images/avatar.png",
                username: "",
            },
        },
        creator: {
            address: asset.creator_address || creatorId || "",
            user: {
                username: "",
                profile_img_url: "/images/avatar.png",
            },
        },
        collection: {
            name: contract?.name || "",
            external_url: "",
        },
        isOwned: true,
        blockchain: "ethereum",
        marketplace: "nftport",
        account_base_url:
            asset.account_base_url || "https://opensea.io",
        needsRefetch: false,
        customData,
    };
    return payload;
}
