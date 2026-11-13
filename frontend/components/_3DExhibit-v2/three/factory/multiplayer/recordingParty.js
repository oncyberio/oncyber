/**
 * Recording only. When a space opens inside the lobby's frame and the lobby
 * staged a crowd for a video (?crowd=N, see features/lobby/recordingCrowd.ts),
 * the friends who travelled with you appear here too: local players, never
 * sent to the room, so other visitors don't see them.
 */

/** The friends the lobby handed over, or null outside a recording. */
export function readRecordingParty() {
    try {
        if (typeof window === "undefined" || window.parent === window)
            return null;
        const list = window.parent.__oncyberRecordingParty;
        return Array.isArray(list) && list.length ? list.slice(0, 16) : null;
    } catch {
        // A cross-origin parent is never a recording.
        return null;
    }
}

/**
 * Packet entries for the friends, standing in a loose arc ahead of `main`
 * along `forward` (a horizontal unit vector), facing back toward you.
 */
export function recordingPartyPlayers(party, main, forward) {
    const count = party.length;
    return party.map((friend, index) => {
        const column = index - (count - 1) / 2;
        const spread = Math.min(0.32, 2.4 / Math.max(1, count));
        const angle = column * spread + (index % 2 ? 0.04 : -0.04);
        const distance = 2.6 + (index % 3) * 0.55;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const dx = forward.x * cos - forward.z * sin;
        const dz = forward.x * sin + forward.z * cos;
        const x = main.x + dx * distance;
        const z = main.z + dz * distance;
        return {
            positionX: x,
            positionY: main.y,
            positionZ: z,
            // Players face -Z at rotation 0; turn each toward you.
            rotation: Math.atan2(main.x - x, main.z - z) + Math.PI,
            scale: main.scale,
            space: main.space,
            userId: `recording-${friend.id}`,
            sessionId: `recording-${friend.id}`,
            avatar: friend.avatar || "",
            username: friend.name || "Guest",
            user_height: main.userHeight,
            paused: false,
            animation: -1,
            floor: true,
            isAdmin: false,
            VRM: friend.vrmUrl || undefined,
            recordingFriend: true,
        };
    });
}

/**
 * Where friend `index` of `count` stands for the trip back: the same line
 * the lobby draws on return (features/lobby/travelPresentation.ts,
 * travelParticipants), so nobody changes place across the cut. `side` is
 * metres to your right, `depth` metres ahead (negative: behind you).
 */
export function recordingPartyLinePlace(index, count) {
    const row = Math.floor(index / 8);
    const inRow = Math.min(8, count - row * 8);
    const column = index - row * 8 - (inRow - 1) / 2 + (row % 2 ? 0.5 : 0);
    return {
        side: column * 1.15,
        depth: -0.9 - Math.abs(column) * 0.18 - row * 1.1,
    };
}
