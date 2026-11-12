export class NativeCohortError extends Error {}

/** A cohort is a public matchmaking hint, never an admission credential. */
export function readLobbyGroupCohort(value: unknown): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{16,80}$/.test(value)) throw new NativeCohortError("Invalid lobby group cohort.");
    return value;
}
export interface NativeRoomListing {
    roomId: string;
    clients: number;
    maxClients?: number;
    locked?: boolean;
    metadata?: { spaceId?: string; lobbyGroupCohort?: string };
}
/** Once a cohort exists, a full room fails rather than splitting its members. */
export function selectNativeRoom<T extends NativeRoomListing>(rooms: T[], spaceId: string, cohort?: string): T | undefined {
    const matches = rooms.filter(room => room.metadata?.spaceId === spaceId && (room.metadata?.lobbyGroupCohort || undefined) === cohort);
    const available = matches.filter(room => !room.locked && room.clients < (room.maxClients || 500)).sort((a, b) => b.clients - a.clients);
    if (cohort && matches.length && !available.length) throw new NativeCohortError("Your group's destination room is full. The group has not been split.");
    return available[0];
}
