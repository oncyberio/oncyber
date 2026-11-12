import { nodeEnv } from "@env";
import { FetchedAsset } from "@uitypes/Asset";
import { CollectionData } from "@uitypes/experience";

import { Failure, removeDuplicates, Result, Success, toNum } from "./js";
import { extToMime } from "./mimeUtils";
import { getExt, relay } from "./urlUtils";

// The address checks live in a tiny module so that getAddrType (reached from
// every page through UserContext) does not pull in this file.
export {
    isCounterpartyAddress,
    isValidBTCAddress,
} from "./counterpartyAddress";

import { COUNTERPARTY_NS } from "./counterpartyAddress";

// The xchain project list (about 319 KB) is fetched only by the functions
// that read it; each awaits loadNFTData() first.
let NFT_DATA: typeof import("./xchain-projects.json") = null;

let NFT_DATA_PROMISE: Promise<typeof NFT_DATA> = null;

function loadNFTData() {
    if (NFT_DATA_PROMISE == null) {
        NFT_DATA_PROMISE = import("./xchain-projects.json").then((module) => {
            NFT_DATA = (module as any).default || module;
            return NFT_DATA;
        });
    }

    return NFT_DATA_PROMISE;
}

let NFT_CARDS: Record<string, { ext: string; project: string }> = null;

function getNFTCards() {
    if (NFT_CARDS != null) return NFT_CARDS;

    NFT_CARDS = {};

    NFT_DATA.forEach((project) => {
        project.cards.forEach((card) => {
            let a = card.split(".");
            let b = a.slice(0, -1);
            let name = b.join(".");
            let ext = a[a.length - 1];
            NFT_CARDS[name] = { ext, project: project.name };
        });
    });

    return NFT_CARDS;
}

function getAssetCard(asset: string) {
    //
    const nftCards = getNFTCards();

    return nftCards[asset];
}

function getSpecialNFTInfo(asset): Partial<XChainExtInfo> {
    //
    const card = getAssetCard(asset);

    if (card == null) return null;

    let id = `${asset}.${card.ext}`;

    const info: Partial<XChainExtInfo> = {
        asset,
        image: `https://xchain.io/img/cards/${id}`,
    };

    const project = NFT_DATA.find((project) => {
        return project.cards.indexOf(id) >= 0;
    });

    if (project != null) {
        info.website = project.site;
        info.category = project.name;
    }

    return info;
}

interface XChainValue {
    btc: string;
    usd: string;
    xcp: string;
}

interface XChainBaseAsset {
    asset: string;
    asset_longname: string;
    description: string;
}

interface XChainBalanceAsset extends XChainBaseAsset {
    asset: string;
    asset_longname: string;
    description: string;
    estimated_value: XChainValue;
    quantity: string;
}

interface XChainResponse<T> {
    total: number;
    data: Array<T>;
}

interface XChainAsset extends XChainBaseAsset {
    asset_id: number;
    estimated_value: XChainValue;
    divisible: boolean;
    issuer: string;
    locked: boolean;
    owner: string;
    supply: number;
    type: "asset" | "numeric" | "subasset";
}

interface XChainExtInfo {
    asset: string;
    image: string;
    description: string;
    website?: string;

    category?: string;
    subcategory?: string;

    name: string;
    minted_on?: string;
    image_large?: string;
    image_large_hd?: "";
    video?: "";
    audio?: "";
    mimeType?: string;
}

interface XChainIssuance extends XChainBaseAsset {
    divisible: false;
    issuer: string;
    locked: boolean;
    quantity: number;
    source: string;
    status: string;
    timestamp: number;
    transfer: boolean;
}

type XChainFetchAsset = XChainBaseAsset & Partial<XChainAsset>;

interface ExtAssetInfo {
    info: XChainExtInfo;
    asset: XChainFetchAsset;
    needsRefetch?: boolean;
}

const COUNTERPARTY_NS_LENGTH = COUNTERPARTY_NS.length;

export function encodeCounterpartyUser(userName: string) {
    return userName + COUNTERPARTY_NS;
}

export function decodeCounterPartyUser(walletId: string) {
    return walletId.slice(0, walletId.length - COUNTERPARTY_NS_LENGTH);
}

const XCHAIN_PAGE_SIZE = 100;

const IS_SERVER = typeof window === "undefined";

async function getJSON(url: string) {
    const headers = {
        Accept: "application/json",
    };

    if (IS_SERVER) {
        headers["Origin"] = "https://oncyber.io";
    }

    const response = await fetch(url, {
        headers,
    });

    if (
        !response.ok ||
        !response.headers
            .get("Content-Type")
            ?.toLowerCase()
            .startsWith("application/json")
    ) {
        throw new Error(
            `API Client Error: ${response.status} ${response.statusText}`
        );
    }
    return response.json();
}

async function queryXChainApi(url: string) {
    return getJSON(`${nodeEnv.XCHAIN_API}/${url}`);
}

function ensureHTTPPefix(s: string) {
    // per https://counterparty.io/docs/enhanced_asset_info/
    // assume http:// if no http(s) prefix
    if (!s.startsWith("http://") && !s.startsWith("https://")) {
        s = "http://" + s;
    }
    return s;
}

function getInlineAssetInfo(asset: XChainBaseAsset): XChainExtInfo {
    let [url, description] = asset.description.split(";");

    const ext = getExt(url);

    if (ext == null) return null;

    const mimeType = extToMime[ext];

    if (!mimeType?.startsWith("image")) return null;

    url = ensureHTTPPefix(url);

    return {
        asset: asset.asset,
        image: url,
        description,
        name: asset.asset_longname || asset.asset,
        mimeType,
    };
}

async function getAssetInfo(
    asset: XChainBaseAsset,
    quikReturn: boolean
): Promise<XChainExtInfo> {
    //

    await loadNFTData();

    let specNFTInfo = getSpecialNFTInfo(asset.asset);

    if (specNFTInfo) {
        // @ts-ignore
        specNFTInfo = {
            ...specNFTInfo,
            asset: asset.asset,
            description: asset.description,
            name: asset.asset,
        };
    }

    //@ts-ignore
    if (quikReturn && specNFTInfo) return specNFTInfo;

    if (!asset.description && !specNFTInfo) return null;

    /**
     * could be a url like
     *
     *      https://easyasset.art/j/uinvob/BPBC.json
     *
     * or inline
     *
     *      imgur/4lP1Ypi.png;EMPEROR OF ANTARCTICA
     *      imgur.com/sJYny4M.jpggetAssetInfo
     */

    if (!asset.description.endsWith(".json") && !specNFTInfo) {
        asset.description = ensureHTTPPefix(asset.description);
        return getInlineAssetInfo(asset);
    }

    let info = null;

    if (asset.description.endsWith(".json")) {
        asset.description = ensureHTTPPefix(asset.description);
        info = await getJSON(relay(asset.description)).catch((err) => {
            console.error("xchain/getAssetInfo", asset.description, err);
            return null;
        });
    }

    if (specNFTInfo?.image && info?.image) {
        delete info?.image;
    }

    return {
        ...(specNFTInfo || {}),
        ...(info || {}),
    };
}

async function fetchExtendedInfo(
    data: Array<XChainFetchAsset>
): Promise<FetchedAsset[]> {
    // 2- for each non divisble asset, query extended info
    let extendedInfo = await Promise.all(
        data.map((asset) => getAssetInfo(asset, true))
    );

    let rawAssets = extendedInfo
        .filter((it) => it?.image != null)
        .map((info, i) => {
            return {
                asset: data[i],
                info,
                needsRefetch: true,
            };
        });

    return rawAssets.map(formatXChainAsset);
}

export async function fetchOwnedCounterpartyAssets(owner: string, page = 0) {
    //
    owner = decodeCounterPartyUser(owner);

    try {
        // 1 based
        page++;

        // 1- fetch assets balances
        const result: XChainResponse<XChainBalanceAsset> = await queryXChainApi(
            `balances/${owner}/${page}/${XCHAIN_PAGE_SIZE}`
        );

        const assets = await fetchExtendedInfo(result.data);

        return {
            assets,
            hasMore: result.total > page * XCHAIN_PAGE_SIZE,
        };
    } catch (error) {
        console.error(error);
        return {
            hasError: true,
            error,
        };
    }
}

export async function fetchCreatedCounterpartyAssets(
    creator: string,
    page = 0
) {
    page++;

    creator = decodeCounterPartyUser(creator);

    try {
        let result: XChainResponse<XChainIssuance> = await queryXChainApi(
            `issuances/${creator}/${page}/${XCHAIN_PAGE_SIZE}`
        );

        let issuances = removeDuplicates(result.data, "asset");

        const assets = await fetchExtendedInfo(issuances);

        return {
            assets,
            hasMore: result.total > page * XCHAIN_PAGE_SIZE,
        };
    } catch (error) {
        console.error(error);
        return {
            hasError: true,
            error,
        };
    }
}

export async function fetchCounterPartyAssetById(assetId: string) {
    //

    const result = await queryXChainApi(`asset/${assetId}`);

    console.log("fetchCounterPartyAssetById", assetId, result);

    if (result.error) {
        return {
            success: false,
            error: result.error,
        };
    } else {
        const rawAsset: XChainAsset = result;

        const info = await getAssetInfo(rawAsset, false);

        console.log("fetchCounterPartyAssetById", assetId, info);

        if (info == null) {
            return {
                success: false,
                error: "Unable to get asset info",
            };
        }

        const asset = formatXChainAsset({
            asset: rawAsset,
            info,
            needsRefetch: false,
        });

        return {
            success: true,
            asset,
        };
    }
}

export async function isOwnerOfCounterpartyNft(
    owner: string,
    { slug }: { slug?: string }
): Promise<Result<boolean>> {
    //

    owner = decodeCounterPartyUser(owner);

    let page = 0;
    let hasMore = false;

    try {
        await loadNFTData();

        do {
            // 1 based
            page++;

            // 1- fetch assets balances
            const result: XChainResponse<XChainBalanceAsset> =
                await queryXChainApi(
                    `balances/${owner}/${page}/${XCHAIN_PAGE_SIZE}`
                );

            if (
                result.data.some((it) => {
                    const card = getAssetCard(it.asset);
                    if (card == null) return false;
                    return card.project === slug;
                })
            ) {
                return Success(true);
            }
            hasMore = result.total > page * XCHAIN_PAGE_SIZE;
        } while (hasMore);

        return Success(false);
    } catch (error) {
        console.error(error);
        return Failure(
            error.message || "Failed to get ownership info from xchain"
        );
    }
}

let XCHAIN_COLLECTION_DATA: CollectionData[] = null;

export async function fetchCounterpartyCollections(
    pattern: string
): Promise<Result<CollectionData[]>> {
    if (XCHAIN_COLLECTION_DATA == null) {
        const NFT_DATA = await loadNFTData();

        XCHAIN_COLLECTION_DATA = NFT_DATA.map((it) => {
            const c: CollectionData = {
                slug: it.name,
                name: it.name,
                blockchain: "counterparty",
            };
            return c;
        });
    }

    const matches = XCHAIN_COLLECTION_DATA.filter((it) => {
        return it.name.toLowerCase().includes(pattern.toLowerCase());
    });

    return Success(matches);
}

export async function fetchCounterpartyUserCollections(
    wallet: string
): Promise<Result<CollectionData[]>> {
    // We don't have connected counterparty wallets for now
    return Failure("Not yet");
}

export function formatXChainAsset({
    info,
    asset,
    needsRefetch,
}: ExtAssetInfo): FetchedAsset {
    //
    let name = asset.asset_longname || asset.asset;

    let image_url = info.image_large || info.image;

    // shitty metadata
    if (image_url.startsWith("http://imgur/")) {
        image_url = image_url.replace("http://imgur/", "http://imgur.com/");
    } else if (image_url.startsWith("https://res.indiesquare.me/")) {
        image_url = image_url.replace(
            "https://res.indiesquare.me/",
            "http://res.indiesquare.me/"
        );
    }

    //image_url = image_url.replace("https://", "http://");

    let mime_type,
        animation_url = null;

    if (info.video) {
        animation_url = info.video;
        mime_type = extToMime[getExt(animation_url)];
    } else {
        mime_type = extToMime[getExt(image_url)];
    }

    let external_link =
        info.website || `https://xchain.io/asset/${asset.asset}`;

    const payload = {
        image_preview_url: image_url,
        image_url,
        image_original_url: image_url,
        sell_orders: [],
        top_bid: {},
        animation_url,
        animation_original_url: animation_url,
        name,
        description: asset.description ?? null,
        external_link,
        permalink: external_link,
        asset_contract: {
            address: "counterparty",
        },
        token_id: asset.asset,
        owner: {
            address: asset.owner ? encodeCounterpartyUser(asset.owner) : "",
            user: { profile_img_url: "/images/avatar.png" },
        },
        creator: {
            address: asset.issuer ? encodeCounterpartyUser(asset.issuer) : "",
            user: { profile_img_url: "/images/avatar.png" },
        },
        collection: {
            name: info.category ?? "",
            image_url: "",
            external_url: "",
        },
        isOwned: true,
        blockchain: "counterparty" as const,
        account_base_url: "https://xchain.io/address",
        mime_type,
        supply: toNum(asset.supply, 0),
        needsRefetch,
        provider: "XCP",
    };
    return payload;
}
