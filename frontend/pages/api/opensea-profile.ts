import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { nodeEnv } from "@env";

type Profile = { profile_image_url: string | null };
const cache = new Map<string, { until: number; profile: Profile }>();
const pending = new Map<string, Promise<Profile>>();

function profileImage(value: unknown): string | null {
    if (typeof value !== "string" || value.length > 2048) return null;
    try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password
            ? url.href
            : null;
    } catch {
        return null;
    }
}

export default async function openSeaProfile(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).end();
    }
    const { address } = req.query;
    if (typeof address !== "string" || !/^0x[a-f\d]{40}$/i.test(address)) {
        return res.status(400).json({ error: "Invalid account address" });
    }
    const id = address.toLowerCase();
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
                        .json({ error: "Profile temporarily unavailable" });
                }
                request = (async () => {
                    try {
                        const result = await axios.get(
                            `https://api.opensea.io/api/v2/accounts/${id}`,
                            {
                                headers: {
                                    "x-api-key":
                                        process.env.OPENSEA_X_API_KEY ||
                                        nodeEnv.OPENSEA_X_API_KEY,
                                },
                                timeout: 10000,
                                maxContentLength: 256 * 1024,
                                maxRedirects: 0,
                            }
                        );
                        return {
                            profile_image_url: profileImage(
                                result.data?.profile_image_url
                            ),
                        };
                    } catch (error) {
                        if (error.response?.status === 404)
                            return { profile_image_url: null };
                        throw error;
                    }
                })();
                pending.set(id, request);
            }
            try {
                const profile = await request;
                entry = { until: Date.now() + 3600000, profile };
                if (cache.size >= 1000) cache.delete(cache.keys().next().value);
                cache.set(id, entry);
            } finally {
                if (pending.get(id) === request) pending.delete(id);
            }
        }
        res.setHeader(
            "Cache-Control",
            "public, s-maxage=3600, stale-while-revalidate=86400"
        );
        return res.status(200).json(entry.profile);
    } catch {
        res.setHeader("Cache-Control", "no-store");
        return res
            .status(503)
            .json({ error: "Profile temporarily unavailable" });
    }
}
