import { result } from "lodash";
import { off } from "process";
import { nodeEnv } from "../env";

const MAX_RETRY_COUNT = 1;
const PAGE_SIZE = 30;

const NIFTY_NS = "@niftygateway";
const NIFTY_NS_LENGTH = NIFTY_NS.length;

let nifty_api = nodeEnv.NIFTYGATEWAY_API_V1;

export function encodeNiftyUser(userName: string) {
    return userName + NIFTY_NS;
}

export function decodeNiftyUser(walletId: string) {
    return walletId.slice(0, walletId.length - NIFTY_NS_LENGTH);
}

export function isNiftyAddress(walletId: string) {
    return walletId?.endsWith(NIFTY_NS);
}

function jsonResponse(response: Response) {
    if (response.status >= 400 && response.status <= 499) {
        console.log(
            "wow an error happened while fetching NiftyGateway assets."
        );
        throw new Error("API Client Error");
    }
    return response.json();
}

interface NiftyResult {
    contractAddress: string;
    tokenId: string;
}

async function fetchOpenSeaAssets(results: NiftyResult[]) {
    if (results.length === 0) return [];

    let osParams = new URLSearchParams();
    results.forEach((it) => {
        osParams.append("asset_contract_addresses", it.contractAddress);
    });
    results.forEach((it) => {
        osParams.append("token_ids", it.tokenId);
    });
    osParams.set("offset", "0");
    osParams.set("limit", String(PAGE_SIZE));

    let osUrl = `${nodeEnv.OPENSEA_API}/assets?${osParams.toString()}`;

    const data = await fetch(osUrl, {
        headers: {
            "X-API-KEY": nodeEnv.OPENSEA_X_API_KEY,
        },
    }).then(jsonResponse);
    return data?.assets;
}

export async function fetchOwnedNiftyAssets(userId: string, page = 0) {
    try {
        let offset = PAGE_SIZE * page;
        let niftyUserId = decodeNiftyUser(userId);
        const response = await fetch(
            `${nifty_api}/users/${niftyUserId}/nifties/?offset=${offset}&limit=${PAGE_SIZE}`
        ).then(jsonResponse);

        let assets = await fetchOpenSeaAssets(response.results);

        return {
            assets,
            hasMore: response.results.length === PAGE_SIZE,
        };
    } catch (error) {
        return {
            hasError: true,
            error,
        };
    }
}

async function fetchCreaedNiftyPage(userId: string, page = 0) {
    let offset = PAGE_SIZE * page;
    let niftyUserId = decodeNiftyUser(userId);
    const response = await fetch(
        `${nifty_api}/creators/${niftyUserId}/collectors/?offset=${offset}&limit=${PAGE_SIZE}`
    ).then(jsonResponse);

    let assets = await fetchOpenSeaAssets(response.results);

    return {
        assets,
        hasMore: response.results.length === PAGE_SIZE,
    };
}

export async function fetchCreatedNiftyAssets(creatorId: string) {
    let hasMore = true;
    let page = 0;
    let assets = [];
    let hasError, error;

    try {
        while (hasMore) {
            let result = await fetchCreaedNiftyPage(creatorId, page);
            hasMore = result.hasMore;
            if (result.assets != null) {
                assets = assets.concat(result.assets);
                page++;
            }
        }
    } catch (err) {
        console.error(err);
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
