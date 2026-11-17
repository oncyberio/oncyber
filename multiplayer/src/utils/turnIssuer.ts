import { createTurnCredentials } from "./turnCredentials";

export type TurnResponse = { status: number; body: any };
type Env = Record<string, string | undefined>;
type Fetch = (url: string, init?: any) => Promise<{ ok: boolean; json(): Promise<any> }>;

const clampTtl = (value: unknown) => {
    const requested = Number(value);
    return Math.max(60, Math.min(3600, Number.isFinite(requested) && requested > 0 ? requested : 3600));
};

/** Browser-usable relay URLs. Cloudflare also lists port 53, which browsers
 * time out on; keep 3478/443/5349 and TURNS. */
function relayUrls(urls: unknown): string[] {
    const list = Array.isArray(urls) ? urls : typeof urls === "string" ? [urls] : [];
    return list.filter((url): url is string => typeof url === "string" && /^turns?:/.test(url) && !/:53(\?|$)/.test(url)).slice(0, 8);
}

/**
 * Short-lived TURN credentials for one visitor.
 * - Cloudflare Realtime TURN when CLOUDFLARE_TURN_KEY_ID and
 *   CLOUDFLARE_TURN_API_TOKEN are set (the API token never leaves the server).
 * - Otherwise coturn's shared-secret scheme (TURN_SECRET + TURN_HOST).
 * - Otherwise 404, and the client stays on STUN.
 */
export async function issueTurnCredentials(env: Env = process.env, fetchImpl: Fetch = (globalThis as any).fetch, now = Date.now()): Promise<TurnResponse> {
    const ttl = clampTtl(env.TURN_TTL);
    const keyId = env.CLOUDFLARE_TURN_KEY_ID,
        token = env.CLOUDFLARE_TURN_API_TOKEN;
    if (keyId && token) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        try {
            const response = await fetchImpl(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ ttl }),
                signal: controller.signal,
            });
            if (!response.ok) return { status: 502, body: { success: false } };
            const data = await response.json();
            const servers = Array.isArray(data?.iceServers) ? data.iceServers : data?.iceServers ? [data.iceServers] : [];
            const relay = servers.find((server: any) => typeof server?.username === "string" && typeof server?.credential === "string" && relayUrls(server.urls).length);
            if (!relay) return { status: 502, body: { success: false } };
            return { status: 200, body: { success: true, urls: relayUrls(relay.urls), username: relay.username, credential: relay.credential, ttl, expiresAt: Math.floor(now / 1000) + ttl } };
        } catch {
            return { status: 502, body: { success: false } };
        } finally {
            clearTimeout(timer);
        }
    }
    const secret = env.TURN_SECRET,
        host = env.TURN_HOST;
    if (!secret || !host) return { status: 404, body: { success: false } };
    const { username, credential } = createTurnCredentials(secret, ttl, now);
    return { status: 200, body: { success: true, urls: [`turn:${host}:3478?transport=udp`, `turn:${host}:3478?transport=tcp`], username, credential, ttl, expiresAt: Math.floor(now / 1000) + ttl } };
}
