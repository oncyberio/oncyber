import type { FetchedAsset } from "@uitypes/Asset";

export type MarketplaceId = "opensea" | "objkt" | "magiceden";

export interface MarketplaceLink {
    id: MarketplaceId;
    name: string;
    href: string;
}

type LinkAsset = Pick<
    FetchedAsset,
    | "blockchain"
    | "marketplace"
    | "contract_address"
    | "token_address"
    | "token_id"
    | "openSeaLink"
>;

// Chain slugs OpenSea uses in its item URLs, keyed by the blockchain or
// marketplace value an asset carries. Assets fetched from OpenSea already
// carry OpenSea's own slug as `marketplace`.
const OPENSEA_CHAINS: Record<string, string> = {
    ethereum: "ethereum",
    matic: "matic",
    polygon: "matic",
    base: "base",
    arbitrum: "arbitrum",
    optimism: "optimism",
    zora: "zora",
    klaytn: "klaytn",
    avalanche: "avalanche",
    bsc: "bsc",
    blast: "blast",
    ape_chain: "ape_chain",
    shape: "shape",
    abstract: "abstract",
};

const MARKETPLACE_HOSTS: Record<string, MarketplaceId> = {
    "opensea.io": "opensea",
    "objkt.com": "objkt",
    "magiceden.io": "magiceden",
};

const NAMES: Record<MarketplaceId, string> = {
    opensea: "OpenSea",
    objkt: "objkt",
    magiceden: "Magic Eden",
};

function link(id: MarketplaceId, href: string): MarketplaceLink {
    return { id, name: NAMES[id], href };
}

/** The asset's own permalink, when it already points at a known marketplace. */
function knownPermalink(url?: string): MarketplaceLink | null {
    if (!url) return null;
    try {
        const { protocol, hostname } = new URL(url);
        if (protocol !== "https:") return null;
        const host = hostname.replace(/^www\./, "");
        const id = MARKETPLACE_HOSTS[host];
        return id ? link(id, url) : null;
    } catch {
        return null;
    }
}

/**
 * Where the artwork can be bought or browsed: OpenSea for EVM chains, objkt
 * for Tezos, Magic Eden for Solana. Returns null when there is no marketplace
 * page we can point to (POAPs, Nifty Gateway, Counterparty, uploads).
 */
export function marketplaceLink(
    asset?: LinkAsset | null
): MarketplaceLink | null {
    if (!asset) return null;

    const contract = asset.contract_address || asset.token_address;
    const token = asset.token_id;
    const chain = String(asset.blockchain || "").toLowerCase();
    const market = String(asset.marketplace || "").toLowerCase();

    if (chain === "tezos" || market === "objkt") {
        if (contract && token != null) {
            return link(
                "objkt",
                `https://objkt.com/tokens/${contract}/${encodeURIComponent(
                    token
                )}`
            );
        }
        return knownPermalink(asset.openSeaLink);
    }

    if (chain === "solana") {
        const fromPermalink = knownPermalink(asset.openSeaLink);
        if (fromPermalink) return fromPermalink;
        // Solana assets keep the mint address as their contract.
        return contract
            ? link("magiceden", `https://magiceden.io/item-details/${contract}`)
            : null;
    }

    const osChain = OPENSEA_CHAINS[market] || OPENSEA_CHAINS[chain];
    if (osChain) {
        const fromPermalink = knownPermalink(asset.openSeaLink);
        if (fromPermalink) return fromPermalink;
        if (contract && token != null) {
            return link(
                "opensea",
                `https://opensea.io/assets/${osChain}/${contract}/${encodeURIComponent(
                    token
                )}`
            );
        }
    }

    return null;
}
