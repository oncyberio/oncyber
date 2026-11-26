import { useEffect, useState } from "react";
import { ARENA_HTTP_URL } from "@utils/arena/constants";
import type { GameEntry } from "./catalog";
import { isPartyId } from "./gamePartyJoin";

/**
 * Who is playing a game right now, read from the room list the realtime
 * server already publishes (`/getRooms`): each room's label and how many
 * people are in it. A game's players are in its shared room (`game.room`,
 * or the `socialRoom` of a game with no multiplayer of its own) or
 * in a party's room (`oncyber-<id>-party-<party id>`). Counts only: names
 * live in the room's state, which only people inside it receive.
 */
export interface GamePresence {
    /** Everyone in the game: the shared room and every party. */
    playing: number;
    /** Party rooms with someone in them. */
    parties: Array<{ id: string; playing: number }>;
}

type PresenceGame = Pick<GameEntry, "id" | "room" | "socialRoom">;

const REFRESH_MS = 30_000;
const partyPrefix = (gameId: string) => `oncyber-${gameId}-party-`;

/** Presence per game id from a `/getRooms` listing; malformed rows drop out. */
export function readGamePresence(
    rooms: unknown,
    games: PresenceGame[]
): Record<string, GamePresence> {
    const presence: Record<string, GamePresence> = {};
    for (const game of games) presence[game.id] = { playing: 0, parties: [] };
    if (!Array.isArray(rooms)) return presence;
    for (const room of rooms) {
        const label = room?.metadata?.spaceId;
        const clients = Math.floor(Number(room?.clients));
        if (typeof label !== "string" || !(clients > 0) || clients > 10_000)
            continue;
        for (const game of games) {
            const entry = presence[game.id];
            const shared = game.room ?? game.socialRoom;
            if (shared && label === shared) {
                entry.playing += clients;
            } else if (label.startsWith(partyPrefix(game.id))) {
                const id = label.slice(partyPrefix(game.id).length);
                if (!isPartyId(id)) continue;
                entry.playing += clients;
                const party = entry.parties.find((p) => p.id === id);
                if (party) party.playing += clients;
                else entry.parties.push({ id, playing: clients });
            } else continue;
            break;
        }
    }
    return presence;
}

/** "3 playing now", or "" when nobody is. */
export function playingLabel(presence: GamePresence | undefined): string {
    return presence?.playing ? `${presence.playing} playing now` : "";
}

/**
 * The visitor's own party in this game, if it is there now: the first live
 * party room whose id is one the visitor holds (their groups' trips, or a
 * party this tab played with). Other people's parties are never offered.
 */
export function joinableParty(
    presence: GamePresence | undefined,
    ownPartyIds: readonly string[]
): { id: string; playing: number } | null {
    if (!presence) return null;
    const own = new Set(ownPartyIds);
    return presence.parties.find((party) => own.has(party.id)) ?? null;
}

export async function fetchGamePresence(
    games: PresenceGame[],
    signal?: AbortSignal
): Promise<Record<string, GamePresence> | null> {
    const response = await fetch(`${ARENA_HTTP_URL}/getRooms`, {
        signal,
        cache: "no-store",
        credentials: "omit",
    });
    const list = await response.json();
    return list?.success ? readGamePresence(list.rooms, games) : null;
}

/** Presence for these games while `enabled`, refreshed every 30 seconds. */
export function useGamePresence(games: PresenceGame[], enabled = true) {
    const [presence, setPresence] = useState<Record<
        string,
        GamePresence
    > | null>(null);
    const key = games
        .map((game) => `${game.id}:${game.room ?? game.socialRoom ?? ""}`)
        .join("|");
    useEffect(() => {
        if (!enabled || !games.length || typeof fetch !== "function") return;
        let controller: AbortController | null = null;
        const refresh = () => {
            if (document.hidden) return;
            controller?.abort();
            const current = (controller = new AbortController());
            fetchGamePresence(games, current.signal)
                .then((value) => {
                    if (!current.signal.aborted) setPresence(value);
                })
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, key]);
    return presence;
}
