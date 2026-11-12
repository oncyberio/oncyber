import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { nodeEnv } from "@env";
import { openSeaEvents } from "@utils/artworks/history/events";

// Bounded per-process cache; CDN caches the public, read-only result as well.
const cache = new Map<
    string,
    { until: number; events: ReturnType<typeof openSeaEvents> }
>();
const pending = new Map<string, Promise<ReturnType<typeof openSeaEvents>>>();

export default async function artworkHistory(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).end();
    }
    const { chain, contract, token } = req.query;
    if (
        typeof chain !== "string" ||
        !["ethereum", "polygon"].includes(chain) ||
        typeof contract !== "string" ||
        !/^0x[a-f\d]{40}$/i.test(contract) ||
        typeof token !== "string" ||
        !/^\d{1,78}$/.test(token)
    )
        return res.status(400).json({ error: "Invalid NFT identity" });

    const providerChain = chain === "polygon" ? "matic" : chain;
    const id = `${chain}/${contract.toLowerCase()}/${token}`;
    try {
        let entry = cache.get(id);
        if (!entry || entry.until <= Date.now()) {
            let request = pending.get(id);
            if (!request) {
                if (pending.size >= 8) {
                    res.setHeader("Cache-Control", "no-store");
                    res.setHeader("Retry-After", "5");
                    return res
                        .status(503)
                        .json({ error: "History temporarily unavailable" });
                }
                request = (async () => {
                    const query = new URLSearchParams({ limit: "50" });
                    ["sale", "transfer", "mint", "listing"].forEach((type) =>
                        query.append("event_type", type)
                    );
                    const result = await axios.get(
                        `https://api.opensea.io/api/v2/events/chain/${providerChain}/contract/${contract}/nfts/${token}?${query}`,
                        {
                            headers: {
                                "x-api-key":
                                    process.env.OPENSEA_X_API_KEY ||
                                    nodeEnv.OPENSEA_X_API_KEY,
                            },
                            timeout: 10000,
                            maxContentLength: 4 * 1024 * 1024,
                            maxRedirects: 0,
                        }
                    );
                    return openSeaEvents(result.data?.asset_events);
                })();
                pending.set(id, request);
            }
            try {
                const events = await request;
                entry = { until: Date.now() + 60000, events };
                if (cache.size >= 500) cache.delete(cache.keys().next().value);
                cache.set(id, entry);
            } finally {
                if (pending.get(id) === request) pending.delete(id);
            }
        }
        res.setHeader(
            "Cache-Control",
            "public, s-maxage=60, stale-while-revalidate=300"
        );
        return res.status(200).json({ events: entry.events });
    } catch {
        res.setHeader("Cache-Control", "no-store");
        return res
            .status(503)
            .json({ error: "History temporarily unavailable" });
    }
}
