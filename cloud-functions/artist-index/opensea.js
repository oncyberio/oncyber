const { hash, address, creatorRecord, extractCreators } = require("./core");
const EVM_CHAINS = new Set([
    "ethereum",
    "matic",
    "base",
    "arbitrum",
    "optimism",
    "avalanche",
    "zora",
    "blast",
    "bsc",
    "klaytn",
    "ape_chain",
    "abstract",
    "bera_chain",
    "ronin",
    "sepolia",
]);
const DAY = 86400000;
class OpenSeaError extends Error {
    constructor(status) {
        super(`OpenSea request failed (${status})`);
        this.status = status;
    }
}
function createOpenSea({
    apiKey,
    cache,
    fetchImpl = fetch,
    wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now = Date.now,
    intervalMs = 500,
    deadline = Infinity,
    beforeRequest = () => {},
}) {
    let nextRequest = 0;
    const memory = new Map();
    function remember(key, entry) {
        memory.set(key, entry);
        if (memory.size > 1000) memory.delete(memory.keys().next().value);
    }
    const stats = { requests: 0, cacheHits: 0 };
    async function get(path) {
        const key = hash({ provider: "opensea-v2-artists-media-2", path });
        const local = memory.get(key);
        if (local && local.expiresAt > now()) {
            stats.cacheHits++;
            return local.value;
        }
        const cached = await cache?.get(key);
        if (cached && cached.expiresAt > now()) {
            remember(key, cached);
            stats.cacheHits++;
            return cached.value;
        }
        if (!apiKey)
            throw new Error(
                "OPENSEA_API_KEY is required for creator enrichment"
            );
        let value;
        for (let attempt = 0; attempt < 4; attempt++) {
            if (now() + 15000 >= deadline)
                throw new Error(
                    "Artist indexing time budget reached; retry uses cached results"
                );
            await wait(Math.max(0, nextRequest - now()));
            nextRequest = now() + intervalMs;
            beforeRequest();
            stats.requests++;
            const response = await fetchImpl(
                `https://api.opensea.io/api/v2/${path}`,
                {
                    headers: {
                        "x-api-key": apiKey,
                        Accept: "application/json",
                    },
                    signal: AbortSignal.timeout(12000),
                    redirect: "error",
                }
            );
            if (response.status === 404) {
                value = null;
                break;
            }
            if (
                (response.status === 429 || response.status >= 500) &&
                attempt < 3
            ) {
                const retry = response.headers.get("retry-after");
                const delay =
                    retry && /^\d+(\.\d+)?$/.test(retry)
                        ? Number(retry) * 1000
                        : retry
                        ? Date.parse(retry) - now()
                        : 1000 * 2 ** attempt;
                await response.body?.cancel();
                await wait(Math.min(30000, Math.max(1000, delay || 1000)));
                continue;
            }
            if (!response.ok) {
                await response.body?.cancel();
                throw new OpenSeaError(response.status);
            }
            const body = await response.json();
            if (
                !body ||
                typeof body !== "object" ||
                (path.startsWith("accounts/")
                    ? !address(body.address)
                    : !body.nft || typeof body.nft !== "object")
            ) {
                throw new Error(
                    "OpenSea returned an invalid attribution response"
                );
            }
            // Verify identity before trusting media or creator credits.
            if (!path.startsWith("accounts/")) {
                const match = path.match(
                    /^chain\/[^/]+\/contract\/([^/]+)\/nfts\/([^/]+)$/
                );
                if (
                    match &&
                    ((body.nft.contract &&
                        body.nft.contract.toLowerCase() !== match[1]) ||
                        (body.nft.identifier != null &&
                            String(body.nft.identifier) !==
                                decodeURIComponent(match[2])))
                )
                    throw new Error(
                        "OpenSea returned a different NFT identity"
                    );
            }
            // Retain only attribution and public media links; never owners/orders.

            value = path.startsWith("accounts/")
                ? {
                      address: address(body.address),
                      username:
                          typeof body.username === "string"
                              ? body.username.slice(0, 160)
                              : "",
                      names: (Array.isArray(body.social_media_accounts)
                          ? body.social_media_accounts
                          : []
                      )
                          .filter((s) => ["twitter", "x"].includes(s.platform))
                          .map((s) => s.username)
                          .filter((s) => typeof s === "string")
                          .map((s) => s.slice(0, 160)),
                  }
                : {
                      creators: extractCreators(body.nft, "opensea-creator"),
                      media: Object.fromEntries(
                          [
                              "image_url",
                              "display_image_url",
                              "original_image_url",
                              "animation_url",
                              "display_animation_url",
                              "original_animation_url",
                              "metadata_url",
                          ].flatMap((field) => {
                              const url = body.nft[field];
                              return typeof url === "string" &&
                                  url.length <= 4096 &&
                                  /^(https?:|ipfs:|ar:)/i.test(url)
                                  ? [[field, url]]
                                  : [];
                          })
                      ),
                      collection:
                          typeof body.nft?.collection === "string"
                              ? body.nft.collection.slice(0, 160)
                              : "",
                  };
            break;
        }
        const entry = { value, expiresAt: now() + (value ? 30 * DAY : DAY) };
        remember(key, entry);
        await cache?.set(key, entry);
        return value;
    }
    async function resolve(input) {
        const nft = input.nft;
        const supported =
            nft &&
            EVM_CHAINS.has(nft.chain) &&
            /^0x[a-f\d]{40}$/.test(nft.contract);
        const remote = supported
            ? await get(
                  `chain/${encodeURIComponent(nft.chain)}/contract/${
                      nft.contract
                  }/nfts/${encodeURIComponent(nft.tokenId)}`
              )
            : null;
        const creators = [...(remote?.creators || [])];
        const wallets = [
            ...new Set(
                [...input.creators, ...creators]
                    .map((c) => c.address)
                    .filter((a) => /^0x[a-f\d]{40}$/.test(a))
            ),
        ];
        for (const wallet of wallets) {
            const profile = await get(`accounts/${wallet}`);
            // Never attach a profile returned for a different address.
            if (profile?.address === wallet) {
                const record = creatorRecord(
                    { address: wallet, username: profile.username },
                    "opensea-account"
                );
                if (record) {
                    record.names.push(...profile.names);
                    creators.push(record);
                }
            }
        }
        return {
            creators,
            reason: !supported
                ? "unsupported-or-missing-token-identity"
                : remote
                ? "creator-not-provided"
                : "nft-not-found",
            collection: remote?.collection || "",
        };
    }
    return { resolve, get, stats };
}
module.exports = { createOpenSea, OpenSeaError, EVM_CHAINS };
