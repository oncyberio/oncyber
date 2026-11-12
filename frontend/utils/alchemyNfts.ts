// Minimal client for Alchemy's NFT REST API (v2 `getNFTs`).
//
// Replaces `@alch/alchemy-web3`, which pulled in web3 1.x and its
// advisories only to make this one GET request.

export type AlchemyNft = {
    contract?: { address?: string };
    id?: { tokenId?: string };
    balance?: string;
    [key: string]: any;
};

export type GetNftsParams = {
    owner: string;
    contractAddresses?: string[];
    withMetadata?: boolean;
    pageKey?: string;
};

export type GetNftsResponse = {
    ownedNfts: AlchemyNft[];
    pageKey?: string;
    totalCount?: number;
    [key: string]: any;
};

export type AlchemyNftClient = {
    alchemy: { getNfts(params: GetNftsParams): Promise<GetNftsResponse> };
};

const MAX_RETRIES = 3;
const RETRY_INTERVAL_MS = 1000;
const RETRY_JITTER_MS = 250;

/** `https://eth-mainnet.g.alchemy.com/v2/<key>` becomes
 * `https://eth-mainnet.g.alchemy.com/nft/v2/<key>/getNFTs?...`. */
export function getNftsUrl(rpcUrl: string, params: GetNftsParams): string {
    const rpc = new URL(rpcUrl);
    const apiKey = rpc.pathname.split("/").filter(Boolean).pop();
    if (!apiKey) throw new Error("Alchemy RPC URL has no API key");
    const url = new URL(`/nft/v2/${apiKey}/getNFTs`, rpc.origin);
    for (const [key, value] of Object.entries(params)) {
        if (value == null) continue;
        if (Array.isArray(value)) {
            for (const item of value) url.searchParams.append(key, item);
        } else {
            url.searchParams.set(key, String(value));
        }
    }
    return url.toString();
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createAlchemyNftClient(
    rpcUrl: string,
    fetchImpl: typeof fetch = (input, init) => fetch(input, init)
): AlchemyNftClient {
    return {
        alchemy: {
            async getNfts(params) {
                const url = getNftsUrl(rpcUrl, params);
                for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                    const response = await fetchImpl(url);
                    if (response.status === 200) return response.json();
                    if (response.status !== 429) {
                        throw new Error(
                            `${response.status}:${response.statusText}`
                        );
                    }
                    await delay(
                        RETRY_INTERVAL_MS + Math.random() * RETRY_JITTER_MS
                    );
                }
                throw new Error(
                    `Rate limited for ${MAX_RETRIES + 1} consecutive attempts.`
                );
            },
        },
    };
}

/** Token ids come back as hex strings (`0x1f`); callers key by decimal. */
export function hexToDecimalString(hex: string): string {
    return BigInt(hex).toString(10);
}
