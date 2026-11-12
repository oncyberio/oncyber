import { LobbyFlash, readLobbyFlash } from "../../../protocol/lobby-flash";

/** v1 deliberately has no Colyseus all-player Schema. Positions are metres inbound, cm outbound. */
export const LOBBY_PROTOCOL = 1;
export const TICK_RATE = 20;
export const AOI_LIMIT = 128;
export const VOICE_LIMIT = 8;
export const CANDIDATE_LIMIT = 384;
export const AOI_RADIUS = 48;
export const VOICE_RADIUS = 12;
export const VOICE_EXIT_RADIUS = 14;
/** Admin-selected lobby speakers stream one-way to their nearest listeners, beyond proximity range. */
export const STAGE_SPEAKER_LIMIT = 5;
export const STAGE_LISTENER_LIMIT = 50;
export type Move = [number, number, number, number, number, number, boolean];
export type Pose = [string, number, number, number, number, number, number];
export interface Profile {
    sessionId: string;
    partyIdentity?: string;
    userId: string;
    username: string;
    avatar: string;
    VRM: string;
    scale: number;
    flash?: LobbyFlash | null;
    /** Set only from a verified lobby identity proof or an owner grant. */
    role?: "owner" | "admin";
}
export function boundedString(value: unknown, max: number, fallback = ""): string {
    return typeof value === "string" ? value.slice(0, max) : fallback;
}
export function profile(sessionId: string, options: any, verifiedPartyIdentity?: string, trustedFlash?: LobbyFlash | null): Profile {
    const url = (v: unknown) => (typeof v === "string" && /^(https?:\/\/|\/)/.test(v) && v.length <= 2048 ? v : "");
    return { sessionId, ...(trustedFlash !== undefined ? { flash: readLobbyFlash(trustedFlash) } : {}), ...(verifiedPartyIdentity ? { partyIdentity: verifiedPartyIdentity } : {}), userId: boundedString(options?.userId, 128, sessionId), username: boundedString(options?.username, 40, "Guest"), avatar: url(options?.avatar), VRM: url(options?.VRM), scale: typeof options?.scale === "number" && Number.isFinite(options.scale) ? Math.min(2, Math.max(0.5, options.scale)) : 1 };
}
export function configuredCapacity(): number {
    const n = Number(process.env.LOBBY_MAX_CLIENTS);
    return Number.isFinite(n) && n >= 2 ? Math.min(2048, Math.floor(n)) : 512;
}
export function configuredRegion(requested?: unknown): string {
    const regions = (process.env.LOBBY_REGIONS || "local")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const region = requested == null ? regions[0] : requested;
    if (typeof region !== "string" || !regions.includes(region)) throw new Error("Unsupported lobby region");
    return region;
}

export const configuredLabel = () => boundedString(process.env.LOBBY_LABEL, 128, "oncyber-lobby-v1") || "oncyber-lobby-v1";
