import { ARENA_HTTP_URL } from "@utils/arena/constants";

// Credentials belong to one deployment/region. An eight-entry LRU prevents
// a long-lived tab visiting several regions from retaining unbounded entries.
const cache = new Map<string, { servers: RTCIceServer[]; expiresAt: number }>();
const MAX_REGIONS = 8;
export async function getTurnIceServers(
    timeoutMs = 2500,
    baseUrl = ARENA_HTTP_URL
): Promise<RTCIceServer[]> {
    const endpoint = baseUrl.replace(/\/$/, "");
    const cached = cache.get(endpoint);
    if (cached && Date.now() < cached.expiresAt - 5 * 60_000) {
        cache.delete(endpoint);
        cache.set(endpoint, cached);
        return cached.servers;
    }
    cache.delete(endpoint);
    if (typeof fetch === "undefined") return [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(`${endpoint}/turnCredentials`, {
            signal: controller.signal,
        });
        // Regions without TURN still work through the existing STUN servers.
        if (!response.ok) return [];
        const data = await response.json();
        if (
            typeof data?.username !== "string" ||
            typeof data?.credential !== "string" ||
            !Array.isArray(data?.urls) ||
            !data.urls.length
        )
            return [];
        const urls = data.urls
            .filter(
                (url: unknown) =>
                    typeof url === "string" && /^turns?:/.test(url)
            )
            .slice(0, 8);
        if (!urls.length) return [];
        const servers: RTCIceServer[] = [
            { urls, username: data.username, credential: data.credential },
        ];
        cache.set(endpoint, {
            servers,
            expiresAt: (parseInt(data.username, 10) || 0) * 1000,
        });
        while (cache.size > MAX_REGIONS)
            cache.delete(cache.keys().next().value);
        return servers;
    } catch {
        return [];
    } finally {
        clearTimeout(timer);
    }
}
