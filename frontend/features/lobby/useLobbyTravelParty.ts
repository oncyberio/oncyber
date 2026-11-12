import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LobbyPlayer } from "./LobbyConnection";
import type { LobbyDestination } from "./lobbyJourneyProtocol";

export interface LobbyTravelParty {
    partyId?: string;
    isLeader: boolean;
    identityAvailable?: boolean;
    selfIdentity?: string;
    memberIds: string[];
    destination?: { experienceId: string; url: string; instanceId: string; revision?: number; unavailableAt?: number };
}
const EMPTY: LobbyTravelParty = { memberIds: [], isLeader: false };
const valid = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);

/** One rendered avatar per authenticated member, plus self. Names and raw userId are ignored. */
export function retainedLobbyPartyIds(players: LobbyPlayer[], party: LobbyTravelParty): string[] {
    const result = players.filter(player => player.isLocal).map(player => player.id);
    const expected = new Set(party.memberIds.filter(valid).slice(0, 8));
    if (party.selfIdentity) expected.delete(party.selfIdentity);
    for (const player of players) {
        if (player.isLocal || !valid(player.partyIdentity) || !expected.has(player.partyIdentity)) continue;
        result.push(player.id); expected.delete(player.partyIdentity);
    }
    return result;
}
function checkedParty(body: any): LobbyTravelParty {
    if (!body || !Array.isArray(body.memberIds) || body.memberIds.length > 8 || !body.memberIds.every(valid) || typeof body.isLeader !== "boolean") throw new Error("Party membership is unavailable.");
    if (body.partyId && (typeof body.partyId !== "string" || !body.partyId || body.partyId.length > 128)) throw new Error("Party membership is unavailable.");
    if (body.destination && (typeof body.destination.experienceId !== "string" || !body.destination.experienceId ||
        body.destination.url !== `/s@${encodeURIComponent(body.destination.experienceId)}` || typeof body.destination.instanceId !== "string")) throw new Error("The party's world is unavailable.");
    return body;
}
async function request(path: string, options: RequestInit, timeout: number) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try { return await fetch(path, { ...options, signal: controller.signal }); }
    finally { clearTimeout(timer); }
}
async function readParty(): Promise<LobbyTravelParty> {
    const response = await request("/api/social/lobby-party", { credentials: "same-origin", cache: "no-store" }, 8000);
    if (!response.ok) throw new Error("Party membership is unavailable. Try again before travelling together.");
    return checkedParty(await response.json());
}
const selectedMatches = (party: LobbyTravelParty, destination: LobbyDestination) =>
    !!party.destination && !party.destination.unavailableAt && destination.href.replace(/\/$/, "") === party.destination.url;

/** No party means ordinary solo selection. Group admission precedes preparing a destination frame. */
export async function prepareLobbyPartyTravel(selected: LobbyDestination, party: LobbyTravelParty, move: (experienceId: string) => Promise<LobbyTravelParty>): Promise<LobbyDestination> {
    if (!party.partyId) return selected;
    if (selectedMatches(party, selected)) return { ...selected, id: party.destination.experienceId, href: party.destination.url };
    if (!party.isLeader) throw new Error("Your party leader chooses the shared world. Follow the party's current world or leave the party first.");
    if (!/^\/[a-z0-9@_-]+\/?$/i.test(selected.href)) throw new Error("This world does not support travelling together yet.");
    const next = await move(selected.href.replace(/^\/|\/$/g, ""));
    if (!next.partyId || next.partyId !== party.partyId || !next.destination || next.destination.unavailableAt) throw new Error("The party could not reserve this world. You are still in the lobby.");
    return { ...selected, id: next.destination.experienceId, href: next.destination.url };
}

export default function useLobbyTravelParty({ enabled, players, identityKey }: { enabled: boolean; players: LobbyPlayer[]; identityKey?: string }) {
    const [party, setParty] = useState<LobbyTravelParty>(EMPTY);
    const [status, setStatus] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
    const generation = useRef(0);
    const accountGeneration = useRef(0);
    const previousIdentity = useRef(identityKey);
    if (previousIdentity.current !== identityKey) { previousIdentity.current = identityKey; accountGeneration.current++; }
    const loadedIdentity = useRef(identityKey);
    const active = useRef(enabled); active.current = enabled;
    const refresh = useCallback(async () => {
        if (!active.current) return EMPTY;
        const current = ++generation.current;
        const account = accountGeneration.current;
        try {
            const next = await readParty();
            if (!active.current || current !== generation.current || account !== accountGeneration.current) throw new Error("Party membership changed. Select the world again.");
            setParty(next); loadedIdentity.current = previousIdentity.current; setStatus("ready");
            return next;
        } catch (error) {
            if (active.current && current === generation.current && account === accountGeneration.current) { setParty(EMPTY); setStatus("unavailable"); }
            throw error;
        }
    }, []);
    useEffect(() => {
        generation.current++; accountGeneration.current++; setParty(EMPTY); setStatus(enabled ? "loading" : "idle");
        if (!enabled) return;
        let stopped = false, timer: ReturnType<typeof setTimeout>;
        const poll = async () => { await refresh().catch(() => {}); if (!stopped) timer = setTimeout(poll, 5000); };
        void poll();
        return () => { stopped = true; generation.current++; clearTimeout(timer); };
    }, [enabled, identityKey, refresh]);
    const prepareTravel = useCallback(async (selected: LobbyDestination) => {
        if (!active.current) return selected;
        const account = accountGeneration.current;
        const stillCurrent = () => { if (!active.current || account !== accountGeneration.current) throw new Error("Your account changed. Select the world again."); };
        const current = await refresh();
        stillCurrent();
        return prepareLobbyPartyTravel(selected, current, async experienceId => {
            const response = await request("/api/social/parties", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
                body: JSON.stringify({ action: "move", experienceId, requestId: crypto.randomUUID() }) }, 20000);
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(body.error === "PARTY_DESTINATION_UNSUPPORTED" ? "This world does not support travelling together yet." : "The party could not reserve this world. Try again from the lobby.");
            stillCurrent();
            const updated = await refresh(); stillCurrent(); return updated;
        });
    }, [refresh]);
    const visibleParty = enabled && loadedIdentity.current === identityKey ? party : EMPTY;
    const partyIds = useMemo(() => retainedLobbyPartyIds(players, visibleParty), [players, visibleParty]);
    return { partyIds, status, partyId: visibleParty.partyId, isLeader: visibleParty.isLeader, destination: visibleParty.destination, identityAvailable: visibleParty.identityAvailable, refresh, prepareTravel };
}
