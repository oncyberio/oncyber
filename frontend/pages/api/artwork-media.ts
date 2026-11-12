import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { nodeEnv } from "@env";
import { openSeaMedia } from "@utils/media/recovery";

const cache = new Map<string, { expires: number; media: any }>();
const pending = new Map<string, Promise<any>>();

export default async function artworkMedia(
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
        !["ethereum", "polygon", "base", "arbitrum", "optimism"].includes(
            chain
        ) ||
        typeof contract !== "string" ||
        !/^0x[a-fA-F0-9]{40}$/.test(contract) ||
        typeof token !== "string" ||
        !/^\d{1,78}$/.test(token)
    )
        return res.status(400).json({ error: "Invalid NFT identity" });

    const providerChain = chain === "polygon" ? "matic" : chain;
    const id = `${chain}/${contract.toLowerCase()}/${token}`;
    try {
        let media = cache.get(id);
        if (!media || media.expires <= Date.now()) {
            if (!pending.has(id)) {
                if (pending.size >= 8) {
                    res.setHeader("Retry-After", "5");
                    return res.status(503).json({ error: "Recovery busy" });
                }
                pending.set(
                    id,
                    (async () => {
                        try {
                            // Fixed provider endpoint, never fetch a caller-supplied URL.
                            const result = await axios.get(
                                `https://api.opensea.io/api/v2/chain/${providerChain}/contract/${contract}/nfts/${token}`,
                                {
                                    headers: {
                                        "x-api-key":
                                            process.env.OPENSEA_X_API_KEY ||
                                            nodeEnv.OPENSEA_X_API_KEY,
                                    },
                                    timeout: 10000,
                                    maxContentLength: 2 * 1024 * 1024,
                                    maxRedirects: 0,
                                }
                            );
                            return openSeaMedia(result.data?.nft);
                        } catch (error) {
                            if (error.response?.status === 404) return {};
                            throw error;
                        }
                    })()
                );
            }
            const result = await pending.get(id);
            media = {
                media: result,
                expires:
                    Date.now() +
                    (result.image || result.animation ? 86400000 : 300000),
            };
            if (cache.size >= 1000) cache.delete(cache.keys().next().value);
            cache.set(id, media);
        }
        const found = media.media.image || media.media.animation;
        res.setHeader(
            "Cache-Control",
            `public, s-maxage=${found ? 86400 : 300}`
        );
        return res.status(found ? 200 : 404).json(media.media);
    } catch {
        // Provider outages are not proof an artwork was deleted.
        res.setHeader("Cache-Control", "no-store");
        return res.status(503).json({ error: "Media recovery unavailable" });
    } finally {
        pending.delete(id);
    }
}
