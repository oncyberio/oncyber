import { ARENA_HTTP_URL, ARENA_WS_URL } from "@utils/arena/constants";

export interface LobbyEndpoint {
    id: string;
    httpUrl: string;
    wsUrl: string;
    latencyMs?: number;
    /** Explicitly opt in to the shared world transport; old endpoints keep v1. */
    protocol?: 1 | 2;
}

const fallback: LobbyEndpoint = {
    id: "default",
    httpUrl: ARENA_HTTP_URL,
    wsUrl: ARENA_WS_URL,
};
let cached: { endpoint: LobbyEndpoint; expires: number; config: string };

export function parseLobbyEndpoints(config: string): LobbyEndpoint[] {
    try {
        const entries = JSON.parse(config);
        if (!Array.isArray(entries)) return [];
        const seen = new Set<string>();
        return entries.slice(0, 8).flatMap((entry) => {
            if (
                !entry ||
                typeof entry.id !== "string" ||
                !/^[a-z0-9-]{1,32}$/i.test(entry.id) ||
                (entry.protocol !== undefined &&
                    entry.protocol !== 1 &&
                    entry.protocol !== 2) ||
                typeof entry.httpUrl !== "string"
            )
                return [];
            const http = new URL(entry.httpUrl);
            const local = ["localhost", "127.0.0.1", "[::1]"].includes(
                http.hostname
            );
            if (
                http.username ||
                http.password ||
                http.search ||
                http.hash ||
                (http.protocol !== "https:" &&
                    !(local && http.protocol === "http:"))
            )
                return [];
            const httpUrl = http.href.replace(/\/$/, "");
            const ws = new URL(entry.wsUrl || httpUrl.replace(/^http/, "ws"));
            if (
                ws.username ||
                ws.password ||
                ws.search ||
                ws.hash ||
                (ws.protocol !== "wss:" &&
                    !(
                        local &&
                        ws.protocol === "ws:" &&
                        ws.hostname === http.hostname
                    ))
            )
                return [];
            if (seen.has(entry.id)) return [];
            seen.add(entry.id);
            return [
                {
                    id: entry.id,
                    httpUrl,
                    wsUrl: ws.href.replace(/\/$/, ""),
                    ...(entry.protocol ? { protocol: entry.protocol } : {}),
                },
            ];
        });
    } catch {
        return [];
    }
}

/** Only deployment-owned endpoints may receive identity or matchmaking traffic. */
export async function selectLobbyEndpoint(
    signal: AbortSignal,
    config = process.env.NEXT_PUBLIC_LOBBY_REGIONS || ""
): Promise<LobbyEndpoint> {
    if (signal.aborted) throw new Error("Lobby connection cancelled.");
    if (cached?.config === config && cached.expires > Date.now())
        return cached.endpoint;
    const endpoints = parseLobbyEndpoints(config);
    if (!endpoints.length) {
        if (!config.trim()) return fallback;
        throw new Error("No valid lobby regions are configured.");
    }
    const pinned = process.env.NEXT_PUBLIC_LOBBY_REGION;
    const choices = pinned
        ? endpoints.filter((endpoint) => endpoint.id === pinned)
        : endpoints;
    const results = await Promise.all(
        choices.map(async (endpoint) => {
            const controller = new AbortController();
            const abort = () => controller.abort();
            signal.addEventListener("abort", abort, { once: true });
            const timer = setTimeout(abort, 1500);
            try {
                let latencyMs = Infinity;
                for (let attempt = 0; attempt < 2; attempt++) {
                    const start = performance.now();
                    const response = await fetch(
                        `${endpoint.httpUrl}/lobby/health`,
                        {
                            signal: controller.signal,
                            cache: "no-store",
                            credentials: "omit",
                        }
                    );
                    const payload = response.ok && (await response.json());
                    if (payload?.lobbyProtocol !== (endpoint.protocol || 1))
                        return null;
                    latencyMs = Math.min(latencyMs, performance.now() - start);
                }
                return { ...endpoint, latencyMs };
            } catch {
                return null;
            } finally {
                clearTimeout(timer);
                signal.removeEventListener("abort", abort);
            }
        })
    );
    if (signal.aborted) throw new Error("Lobby connection cancelled.");
    const available = results
        .filter(Boolean)
        .sort((a, b) => a.latencyMs - b.latencyMs);
    // Configuring regional v1 infrastructure is an explicit opt-in: if it is
    // down, retry it instead of silently splitting the party into a legacy room.
    if (!available.length) throw new Error("No lobby region is reachable.");
    const endpoint = available[0];
    cached = { endpoint, config, expires: Date.now() + 5 * 60_000 };
    return endpoint;
}

export function invalidateLobbyEndpoint() {
    cached = undefined;
}
