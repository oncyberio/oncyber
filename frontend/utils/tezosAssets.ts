import { Asset } from "@uitypes/Asset";
import { CollectionData } from "@uitypes/experience";

import { Failure, Result, sha1, Success } from "./js";
import {
    ipfsCID,
    ipfsHttpCID,
    ipfsToHttp,
    isIPFS,
    isIPFSHttp,
} from "./urlUtils";

function isTezosContract(x: string) {
    return x?.length === 36 && x.startsWith("KT");
}

const MAX_RETRY_COUNT = 1;
const TEZOS_PAGE_SIZE = 500;

const tokenFields = `
    token_id
    artifact_uri
    thumbnail_uri
    timestamp
    mime
    name
    description
    display_uri
    supply
    creators(limit: 2) {
        creator_address
        holder {
            address
            logo
            tzdomain
            alias
            twitter
        }
    }
    holders(limit: 5, order_by: {quantity: desc}) {
        holder {
            address
            logo
            tzdomain
            alias
            twitter
        }
        quantity
    }
    fa {
        contract
        name
        path
        logo
    }
    pk
`;

const orderInfoFields = `
    listings(where: {status: {_eq: "active"}, amount: {_gte: 1}}, order_by: {price: asc}) {
        id
        amount
        price
        seller_address
        timestamp
        expiry
        status
    }
    offers(where: {status: {_eq: "active"}}, order_by: { price: desc }) {
        id
        price
        buyer_address
        timestamp
        expiry
        status
    }
    royalties {
        receiver_address
        amount
        decimals
    }
`;

const objktByCreatorQuery = (
    offset: number
) => `query collectorGallery($address: String!) {
    token_creator(where: {creator_address: {_eq: $address}}, order_by: {token: {token_id: desc}}, limit: ${TEZOS_PAGE_SIZE}, offset: ${offset}) {
        token {
            ${tokenFields}
        }
    }
}`;

const objktByOwnerQuery = (
    offset: number
) => `query collectorGallery($address: String!) {
    token_holder(where: {quantity: {_gt: "0"}, holder_address: {_eq: $address}}, order_by: {token: {token_id: desc}}, limit: ${TEZOS_PAGE_SIZE}, offset: ${offset}) {
        token {
            ${tokenFields}
        }
    }
}`;

const objktByIdQuery = (collection: string, id: string) => {
    const faField = isTezosContract(collection) ? "contract" : "path";
    return `query tokenById($collection: String!, $id: String!) {
        token(where: {token_id: {_eq: $id}, fa: {${faField}: {_eq: $collection}}}) {
            ${tokenFields}
            ${orderInfoFields}
        }
      }`;
};

const priceDataByIdQuery = (
    collection: string,
    id: string,
    types: string[]
) => {
    const faField = isTezosContract(collection) ? "contract" : "path";
    return `query priceDataById($collection: String!, $id: String!, $types: [marketplace_event_type]!) {
        event(where: {marketplace_event_type: {_in: $types}, fa: {${faField}: {_eq: $collection }}, token: {token_id: {_eq: $id }}}) {
            marketplace_event_type
            amount
            price
            recipient_address
            creator_address
            timestamp
        }
      }`;
};

function isNotTezosDomain(token) {
    return !(token?.fa?.path === "tezosdomains");
}

async function queryTezosApi(payload: object, signal?: AbortSignal) {
    let response = await fetch("https://data.objkt.com/v3/graphql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            // mode: "no-cors",
        },
        signal,
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        console.error("wow an error happened while fetching tezos assets.");
        throw new Error("API Client Error");
    }
    const result = await response.json();
    if (result?.data) return result;
    else {
        const serverMsg =
            result?.error?.message ||
            result?.errors?.[0]?.message ||
            "Server error";
        throw new Error(serverMsg);
    }
}

export async function fetchOwnedTezosAssets(account: string, page = 0) {
    try {
        let offset = page * TEZOS_PAGE_SIZE;
        let result = await queryTezosApi({
            query: objktByOwnerQuery(offset),
            variables: {
                address: account,
            },
        });

        let rawAssets = result.data?.token_holder;
        return {
            assets: await Promise.all(
                rawAssets
                    ?.filter(({ token }) => isNotTezosDomain(token))
                    .map?.(({ token }) =>
                        formatTezosAsset(token, account, null)
                    )
            ),
            hasMore: rawAssets?.length === TEZOS_PAGE_SIZE,
        };
    } catch (error) {
        console.error(`Got a server error while querying owned assets`, error);
        return {
            hasError: true,
            error,
        };
    }
}

async function fetchTezosPage(address: string, page: number, retryCount = 0) {
    let offset = page * TEZOS_PAGE_SIZE;
    try {
        let result = await queryTezosApi({
            query: objktByCreatorQuery(offset),
            variables: {
                address,
            },
        });
        return result.data?.token_creator;
    } catch (err) {
        if (retryCount >= MAX_RETRY_COUNT) throw err;
        await fetchTezosPage(address, page, retryCount + 1);
    }
}

export async function fetchCreatedTezosAssets(creatorId: string) {
    let hasMore = true;
    let page = 0;
    let assets = [];
    let hasError, error;

    try {
        while (hasMore) {
            let tokens = await fetchTezosPage(creatorId, page);
            hasMore = tokens?.length >= TEZOS_PAGE_SIZE;
            if (tokens != null) {
                const newAssets = await Promise.all(
                    tokens
                        .filter(({ token }) => isNotTezosDomain(token))
                        .map(({ token }) =>
                            formatTezosAsset(token, null, creatorId)
                        )
                );
                assets = assets.concat(newAssets);
                page++;
            }
        }
    } catch (err) {
        console.error(`Got a server error while querying created assets`, err);
        hasError = true;
        error = err.message;
    }

    return {
        hasError,
        error,
        assets,
        hasMore: false,
    };
}

export async function fetchTezosAssetById(
    owner: string,
    collection: string,
    id: string,
    signal?: AbortSignal
) {
    try {
        let result = await queryTezosApi(
            {
                query: objktByIdQuery(collection, id),
                variables: {
                    collection,
                    id,
                },
            },
            signal
        );
        if (!result?.data?.token?.length) return;
        let rawAsset = result.data.token[0];
        return {
            success: true,
            asset: await formatTezosAsset(rawAsset, owner, null),
        };
    } catch (error) {
        console.error(error);
        return {
            success: false,
            error,
        };
    }
}

export async function fetchEventsById(
    collection: string,
    id: string,
    types: string[]
) {
    try {
        let result = await queryTezosApi({
            query: priceDataByIdQuery(collection, id, types),
            variables: {
                collection,
                id,
                types,
            },
        });
        return {
            success: true,
            value: result?.data?.event,
        };
    } catch (error) {
        console.error(error);
        return {
            success: false,
            error: error.message || "Failed to fetch price data",
        };
    }
}

export async function isOwnerOfTezosNft(
    owner: string,
    { slug, address }: { slug?: string; address?: string }
): Promise<Result<boolean>> {
    //

    let variables: Record<string, string> = {
        owner,
        address,
    };

    const query = `query nftOwnership($owner: String!, $address: String) {
        token_holder(
            limit: 1,
            where: {
                quantity: {_gt: "0"},
                holder_address: {_eq: $owner},
                token: {
                    fa_contract:  { _eq: $address }
                }
            }
        ) {
            token {
                name
                fa {
                    name
                }
                fa_contract
            }
        }
    }`;

    try {
        let result = await queryTezosApi({
            query,
            variables,
        });
        return Success(result?.data?.token_holder?.length > 0);
    } catch (error) {
        console.error(error);
        return Failure(
            error.message || "Failed to fetch ownership data from objkt"
        );
    }
}

export async function fetchTezosCollectionAssets(
    slug: string,
    offset: number,
    signal?: AbortSignal
) {
    const limit = 20;

    let variables = {
        collection: slug,
        offset: limit * offset,
        limit,
    };

    let condition = "";

    if (isTezosContract(slug)) {
        condition = `contract: {_ilike: $collection}`;
    } else {
        condition = `path: {_ilike: $collection}`;
    }

    const query = `query collection($collection: String, $offset: Int, $limit: Int) {
        fa(where: { ${condition} }) {
            contract
            name
            path
            logo
    		tokens(limit: $limit, offset: $offset) {
             ${tokenFields}
             ${orderInfoFields}
    		}
        }
    }`;

    try {
        let result = await queryTezosApi(
            {
                query,
                variables,
            },
            signal
        );

        const fas = result.data.fa;

        if (fas) {
            let collections: CollectionData[] = fas.map((fa) => {
                return {
                    slug: fa.path || fa.name,
                    name: fa.name,
                    image: fa.logo ? collectionLogoIPFSToCDN(fa.logo) : null,
                    address: fa.contract,
                    blockchain: "tezos",
                    assets: fa.tokens,
                };
            });

            return Success(collections);
        } else {
            return Failure("No match found");
        }
    } catch (error) {
        console.error(error);
        return Failure(
            error.message || "Failed to fetch ownership data from objkt"
        );
    }
}

export async function fetchTezosCollection(
    slug: string
): Promise<Result<CollectionData[]>> {
    //

    let variables = {
        collection: slug,
    };

    let condition = "";

    if (isTezosContract(slug)) {
        condition = `contract: {_ilike: $collection}`;
    } else {
        condition = `path: {_ilike: $collection}`;
    }

    const query = `query collection($collection: String) {
        fa(where: { ${condition} }) {
            contract
            name
            path
            logo
        }
    }`;

    try {
        let result = await queryTezosApi({
            query,
            variables,
        });

        const fas = result.data.fa;

        if (fas) {
            let collections: CollectionData[] = fas.map(formatTezosFa);

            return Success(collections);
        } else {
            return Failure("No match found");
        }
    } catch (error) {
        console.error(error);
        return Failure(
            error.message || "Failed to fetch ownership data from objkt"
        );
    }
}

export async function fetchTezosUserCollections(
    owner: string
): Promise<Result<CollectionData[]>> {
    //

    const variables = { owner };

    const query = `query userCollections($owner: String!) {
        token_holder(
            where: {
                quantity: {_gt: "0"},
                holder_address: {_eq: $owner},
            }
        ) {
            token {
                fa {
                    contract
                    name
                    path
                    logo
                }
            }
        }
    }`;

    try {
        let result = await queryTezosApi({
            query,
            variables,
        });

        let fas = result?.data?.token_holder?.map((th) => th.token.fa);

        if (Array.isArray(fas)) {
            const collections = fas.map(formatTezosFa);
            return Success(collections);
        }
        return Success([]);
    } catch (error) {
        console.error(error);
        return Failure(
            error.message || "Failed to fetch ownership data from objkt"
        );
    }
}

function formatTezosFa(fa): CollectionData {
    const c: CollectionData = {
        slug: fa.path || fa.name,
        name: fa.name,
        image: fa.logo ? collectionLogoIPFSToCDN(fa.logo) : null,
        address: fa.contract,
        blockchain: "tezos",
    };
    return c;
}

function formatHolder(holder) {
    return {
        address: holder.address,
        user: {
            username: holder.alias || holder.tzdomain || "",
            profile_img_url:
                holder.logo ||
                `https://services.tzkt.io/v1/avatars2/${
                    holder.tzdomain || holder.alias
                }`,
        },
    };
}

export async function formatTezosAsset(asset, ownerId, creatorId) {
    let animation_original_url: string;
    let image_original_url: string;
    let animation_url: string;
    let image_url: string;

    let original_mime_type = asset.mime;

    let display_uri = ipfsToHttp(
        asset.display_uri ||
            (asset.mime?.includes("image") && asset.artifact_uri) ||
            asset.thumbnail_uri
    );

    let image_preview_url = await objkCDNUrlV2(asset, "thumb", display_uri);

    if (
        asset.mime?.includes("video") ||
        asset.mime?.includes("audio") ||
        asset.mime?.includes("model") ||
        asset.mime === "application/x-directory"
    ) {
        animation_original_url = ipfsToHttp(asset.artifact_uri);
        animation_url = await objkCDNUrlV2(
            asset,
            "artifact",
            animation_original_url
        );
        image_url = await objkCDNUrlV2(asset, "display", display_uri);
        image_original_url = display_uri;
    } else {
        animation_original_url = null;
        animation_url = null;
        image_original_url = ipfsToHttp(asset.artifact_uri);
        image_url = await objkCDNUrlV2(asset, "artifact", image_original_url);
    }

    if (asset?.mime === "application/x-directory") {
        asset.mime = null;
    }

    let collection = asset.fa;

    let collectionLogo = collection?.logo;
    if (collectionLogo?.startsWith("ipfs://")) {
        collectionLogo = ipfsToHttp(collection?.logo);
    } else if (collectionLogo?.startsWith("assets/logo")) {
        collectionLogo = `https://objkt.com/${collection?.logo}`;
    }

    let collectionBase = collection.path || collection.contract;
    let assetLink = `https://objkt.com/asset/${collectionBase}/${asset.token_id}`;
    let collectionLink = `https://objkt.com/collection/${collectionBase}`;

    let creatorData;

    if (creatorId) {
        creatorData = asset.creators?.find(
            (it) => it.creator_address === creatorId
        )?.holder;
    } else {
        // Should modify the Asset interface/UI to accomodate multiple creators
        creatorData = asset.creators[0]?.holder;
    }

    let creator = creatorData ? formatHolder(creatorData) : {};

    let ownerships = asset.holders?.map((it) => {
        return {
            owner: formatHolder(it.holder),
            quantity: it.quantity,
        };
    });

    const description = asset.description || "";

    asset.description =
        description.length > 100
            ? description.substring(0, 100) + "..."
            : description;

    const payload = {
        image_preview_url,
        image_original_preview_url: display_uri,
        image_url,
        image_original_url,
        sell_orders: asset.listings,
        buy_orders: asset.offers,
        top_bid: {},
        animation_url,
        animation_original_url,
        name: asset.name,
        description: asset.description,
        external_link: assetLink,
        permalink: assetLink,
        asset_contract: { address: collection.contract },
        contract_address: collection.contract,
        token_id: asset.token_id,
        owner: {
            address: ownerId,
            user: {
                profile_img_url: `https://services.tzkt.io/v1/avatars2/${ownerId}`,
            },
        },
        creator,
        ownerships,
        collection: {
            name: collection?.name,
            image_url: collectionLogo,
            external_url: collectionLink,
            address: collection?.contract,
        },
        isOwned: ownerId ? true : false,
        blockchain: "tezos",
        marketplace: "objkt",
        account_base_url: "https://objkt.com/profile",
        original_mime_type,
        mimeType: asset.mime,
        mime_type: asset.mime,
        supply: asset.supply,
        needsRefetch: asset?.needsRefetch,
        raw_asset: asset,
        provider: "Objkt",
        token_address: collection?.contract,
    };
    return payload;
}

const objktUrlTypes = {
    artifact: "artifact_uri",
    display: "display_uri",
    thumb: "artifact_uri",
};

async function objkCDNUrlV2(
    asset,
    urlType: "artifact" | "display" | "thumb",
    fallback?: string
) {
    const {
        fa: { contract },
        token_id: id,
        mime,
    } = asset;
    if (
        !contract?.length ||
        !id?.length ||
        !(
            mime?.startsWith("image") ||
            mime?.startsWith("video") ||
            mime?.startsWith("audio") ||
            mime === "model/gltf-binary" ||
            mime === "application/x-directory"
        )
    )
        return fallback;

    const baseUrl = `https://assets.objkt.media/file/assets-003`;

    let urlField = objktUrlTypes[urlType];

    let url = asset[urlField];

    if (url == null) return fallback;

    let type: string = urlType;

    if (urlType === "thumb") {
        return `${baseUrl}/${contract}/${id}/thumb288`;
    }

    let urlId: string;

    if (isIPFS(url)) {
        urlId = ipfsCID(url);
    } else {
        urlId = await sha1(url);
    }

    return `${baseUrl}/${urlId}/${type}`;
}

async function encodeObjktUrl(url: string, type: "display" | "artifact") {
    const baseUrl = `https://assets.objkt.media/file/assets-003`;

    let urlId: string;

    if (isIPFSHttp(url)) {
        urlId = ipfsHttpCID(url);
    } else {
        urlId = await sha1(url);
    }

    return `${baseUrl}/${urlId}/${type}`;
}

const oldBaseUrl = "https://assets.objkt.com/file/assets-001";

export function upgradeObjktUrl(
    url: string,
    originalUrl: string,
    type: "artifact" | "display" = "artifact"
) {
    if (url?.startsWith(oldBaseUrl)) {
        return encodeObjktUrl(originalUrl, type);
    }
    return url;
}

function collectionLogoIPFSToCDN(url: string) {
    const cid = ipfsCID(url);

    if (cid) {
        return `https://assets.objkt.media/file/assets-003/${cid}/thumb288`;
    }

    return url;
}

export async function upgradeObjktAsset(asset: Asset) {
    //
    if (asset.mime_type?.startsWith("image")) {
        asset.image_url = await upgradeObjktUrl(
            asset.image_url,
            asset.image_original_url,
            "artifact"
        );
    } else if (
        asset.mime_type?.startsWith("video") ||
        asset.mime_type?.startsWith("model") ||
        asset.mime_type?.startsWith("audio")
    ) {
        asset.animation_url = await upgradeObjktUrl(
            asset.animation_url,
            asset.animation_original_url,
            "artifact"
        );
    }

    if (asset.image_preview_url?.startsWith(oldBaseUrl)) {
        const baseUrl = `https://assets.objkt.media/file/assets-003`;
        const contractAddress = asset.image_preview_url
            .slice(oldBaseUrl.length + 1)
            .split("/")?.[0];

        if (isTezosContract(contractAddress)) {
            asset.image_preview_url = `${baseUrl}/${contractAddress}/${asset.token_id}/thumb288`;
        }
    }

    return asset;
}

// function objkCDNUrl(asset, urlType: "artifact" | "thumb") {
//     const {
//         fa: { contract },
//         token_id: id,
//         mime,
//     } = asset;
//     if (
//         !contract?.length ||
//         !id?.length ||
//         !(
//             mime?.startsWith("image") ||
//             mime?.startsWith("video") ||
//             mime?.startsWith("audio")
//         )
//     )
//         return null;

//     const idLength = id.length;

//     const baseUrl = `https://assets.objkt.com/file/assets-001/${contract}/${
//         id[idLength - 2]?.[0] || "0"
//     }/${id[idLength - 1]?.[0]}/${id}`;

//     if (urlType === "thumb") return `${baseUrl}/thumb288`;
//     if (urlType === "artifact" && mime != null) {
//         const ext = mimetoExt[mime];
//         if (ext) {
//             return `${baseUrl}/artifact.${ext}`;
//         }
//     }
//     return null;
// }
