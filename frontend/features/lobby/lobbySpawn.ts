import type { LobbyPose } from "./LobbyConnection";

/** Centre of the lobby's arrival area, in front of the default camera. */
export const LOBBY_SPAWN_CENTER = { x: 0, z: 4 };

/**
 * A spot in a ring around the arrival centre so people who join together
 * don't stack on one point. The facing varies a little but stays toward the
 * default camera view.
 */
export function randomLobbySpawn(
    random: () => number = Math.random
): LobbyPose {
    const angle = random() * Math.PI * 2;
    // sqrt keeps the ring evenly filled instead of crowding its inner edge.
    const radius = 0.8 + Math.sqrt(random()) * 1.8;
    return {
        x: LOBBY_SPAWN_CENTER.x + Math.cos(angle) * radius,
        y: 0,
        z: LOBBY_SPAWN_CENTER.z + Math.sin(angle) * radius,
        rotation: (random() - 0.5) * 0.7,
    };
}
