import { Client, type Room } from "colyseus.js";
import { ARENA_HTTP_URL, ARENA_WS_URL } from "./constants";

/**
 * Asks the room server for a seat. Every join goes through here: a world's
 * room, a game's, and the room a page holds for a framed world.
 */
export async function requestSeat(
    body: object,
    {
        signal,
        unavailable = "Failed to join multiplayer room",
    }: { signal?: AbortSignal; unavailable?: string } = {}
): Promise<{ reservation: any; lobbyGroupCohort?: string }> {
    const response = await fetch(`${ARENA_HTTP_URL}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
    });
    const result = await response.json();
    if (!result?.success) throw new Error(result?.message || unavailable);
    return result;
}

/** Takes the seat a reservation holds. */
export function takeSeat(reservation: any): Promise<Room<any>> {
    return new Client(ARENA_WS_URL).consumeSeatReservation(reservation);
}
