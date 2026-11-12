import { useEffect, useState } from "react";
import { selectLobbyEndpoint } from "./lobbyEndpoints";

// Same key LobbyConnection joins with (LOBBY_ROOM); kept here so the landing
// page doesn't pull the realtime client into its bundle.
const LOBBY_ROOM_KEY = "oncyber-lobby-v1";
const REFRESH_MS = 30_000;

/** People currently in the shared lobby, or null while unknown. */
export async function fetchLobbyPopulation(signal: AbortSignal): Promise<number | null> {
    const endpoint = await selectLobbyEndpoint(signal);
    if (endpoint.protocol === 2) {
        // Regional world servers report their population on /lobby/health.
        const health = await fetch(`${endpoint.httpUrl}/lobby/health`, { signal, cache: "no-store", credentials: "omit" }).then((r) => r.json());
        return Number.isFinite(health?.population) ? health.population : null;
    }
    if (endpoint.protocol === 1) return null;
    // Default arena: the lobby is one native room among the listed rooms.
    const list = await fetch(`${endpoint.httpUrl}/getRooms`, { signal, cache: "no-store", credentials: "omit" }).then((r) => r.json());
    if (!list?.success || !Array.isArray(list.rooms)) return null;
    return list.rooms
        .filter((room) => room?.metadata?.spaceId === LOBBY_ROOM_KEY)
        .reduce((sum, room) => sum + (Number(room.clients) || 0), 0);
}

export function useLobbyPopulation(enabled = true) {
    const [population, setPopulation] = useState<number | null>(null);
    useEffect(() => {
        if (!enabled) return;
        let controller: AbortController | null = null;
        const refresh = () => {
            if (document.hidden) return;
            controller?.abort();
            controller = new AbortController();
            const current = controller;
            fetchLobbyPopulation(current.signal)
                .then((value) => { if (!current.signal.aborted) setPopulation(value); })
                .catch(() => {});
        };
        refresh();
        const timer = setInterval(refresh, REFRESH_MS);
        document.addEventListener("visibilitychange", refresh);
        return () => {
            clearInterval(timer);
            document.removeEventListener("visibilitychange", refresh);
            controller?.abort();
        };
    }, [enabled]);
    return population;
}
