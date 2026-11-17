// The realtime backend host (Colyseus rooms for spaces + matchmaking HTTP +
// TURN credentials). NEXT_PUBLIC_ARENA_URL moves it (a bare host or an
// http(s) origin); without it, the GCP VM at arena.oncyber.io.
export function arenaBaseUrl(value: string | undefined) {
    const raw = (value || "").trim();
    if (!raw) return "arena.oncyber.io";
    try {
        const url = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`);
        return url.host;
    } catch {
        return "arena.oncyber.io";
    }
}

export const ARENA_BASE_URL = arenaBaseUrl(process.env.NEXT_PUBLIC_ARENA_URL);

const INSECURE = /^(localhost|127\.)/.test(ARENA_BASE_URL);

export const ARENA_HTTP_URL = `${
    INSECURE ? "http" : "https"
}://${ARENA_BASE_URL}`;

export const ARENA_WS_URL = `${INSECURE ? "ws" : "wss"}://${ARENA_BASE_URL}`;
