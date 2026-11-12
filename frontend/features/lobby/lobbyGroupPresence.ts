import type { LobbyGroupLocation } from "../../../multiplayer/protocol/lobby-groups";
import { readGroupLocation } from "../../../multiplayer/protocol/group-location";
import type {
    LobbyDestination,
    LobbyDestinationPhase,
} from "./lobbyJourneyProtocol";

/** Presence follows the visible destination independently of its coordinate room. */
export function lobbyGroupPresence(
    phase: LobbyDestinationPhase,
    destination: LobbyDestination | null,
    travelling: boolean
) {
    const present = !["revealing", "entered", "returning"].includes(phase);
    const state: LobbyGroupLocation["state"] =
        phase === "returning"
            ? "travelling"
            : !present
            ? "space"
            : travelling
            ? "travelling"
            : "lobby";
    let location: LobbyGroupLocation = { state };
    if (destination && state !== "lobby" && phase !== "returning") {
        // The iframe attempt/cohort/gating query is private transport context.
        const href = destination.href.split(/[?#]/, 1)[0];
        location =
            readGroupLocation({
                state,
                destination: {
                    id: destination.id,
                    title: destination.title.slice(0, 80),
                    href,
                },
            }) || location;
    }
    return { present, location };
}
export function groupLocationLabel(location?: LobbyGroupLocation) {
    if (!location) return "";
    if (location.state === "lobby") return "In lobby";
    if (location.state === "travelling")
        return location.destination
            ? `Travelling to ${location.destination.title}`
            : "Travelling";
    return location.destination
        ? `In ${location.destination.title}`
        : "In a world";
}
