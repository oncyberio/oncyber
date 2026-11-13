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
 * Packet entries for the friends, at `spots` (recordingPartyLanding), each
 * turned toward you. `arriveAt` is when each appears (seconds after you
 * have control).
 */
export function recordingPartyPlayers(party, main, spots) {
    return party.map((friend, index) => {
        const spot = spots[index];
        const x = spot.x;
        const z = spot.z;
        return {
            arriveAt: spot.delay,
            positionX: x,
            positionY: spot.y,
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

/** First friend shows up this long after you have control (seconds). */
export const RECORDING_ARRIVAL_FIRST_S = 0.9;

/** Then one more about this often (seconds). */
export const RECORDING_ARRIVAL_EVERY_S = 0.55;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** A small repeatable dice in [0, 1) for friend `index`, roll `roll`. */
function dice(index, roll) {
    const value = Math.sin((index + 1) * 12.9898 + roll * 78.233) * 43758.5453;
    return value - Math.floor(value);
}

/**
 * Where the friends land in a space and when each appears: the way people
 * arrive in any space, at its spawn, a little apart. You land alone; then
 * they show up one at a time around the spawn, in front of you and to the
 * sides (the camera is behind you), each on the floor under its spot and
 * never on the far side of a wall. Spots that fail fall back closer in,
 * and at worst right beside the spawn, so a tight room still works.
 *
 * @param {number} count
 * @param {{ x: number, y: number, z: number }} main your packet position at the spawn
 * @param {{ x: number, z: number }} forward horizontal unit vector you face
 * @param {{
 *   floorAt?: (x: number, z: number, nearY: number) => number | null,
 *   clearPath?: (from: { x: number, z: number }, to: { x: number, z: number }) => boolean,
 * }} [probe] floorAt: the floor height under a point (null when none
 *   nearby); clearPath: nothing solid between two points at chest height.
 *   Without them every spot is accepted at your height.
 * @returns {{ x: number, y: number, z: number, delay: number }[]}
 */
export function recordingPartyLanding(count, main, forward, probe = {}) {
    const floorAt = probe.floorAt || (() => null);
    const clearPath = probe.clearPath || (() => true);
    const ground = floorAt(main.x, main.z, main.y);
    // packet height above the floor, so friends stand as you do
    const lift = ground == null ? 0 : main.y - ground;
    const heading = Math.atan2(forward.x, forward.z);
    const placed = [];
    const MIN_GAP = 0.75;
    const MAX_STEP = 0.9;

    const tryAt = (angle, distance) => {
        const a = heading + angle;
        const x = main.x + Math.sin(a) * distance;
        const z = main.z + Math.cos(a) * distance;
        for (const other of placed)
            if (Math.hypot(other.x - x, other.z - z) < MIN_GAP) return null;
        if (!clearPath({ x: main.x, z: main.z }, { x, z })) return null;
        const floor = floorAt(x, z, main.y);
        if (ground != null) {
            if (floor == null || Math.abs(floor - ground) > MAX_STEP)
                return null;
        }
        return { x, z, y: floor == null ? main.y : floor + lift };
    };

    for (let index = 0; index < count; index++) {
        // spread over the front and sides (±110°), alternating left and right
        const turn = ((index * GOLDEN_ANGLE) % (Math.PI * 2)) / (Math.PI * 2);
        const angle = (turn * 2 - 1) * 1.92 + (dice(index, 1) - 0.5) * 0.2;
        const distance = 1.5 + dice(index, 2) * 1.1;
        let spot = null;
        for (const scale of [1, 0.75, 0.55]) {
            spot = tryAt(angle, distance * scale);
            if (spot) break;
        }
        // another direction at the same distances
        for (let k = 1; !spot && k <= 8; k++) {
            const other = angle + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.45;
            for (const scale of [1, 0.6]) {
                spot = tryAt(other, distance * scale);
                if (spot) break;
            }
        }
        // a tight room: right beside the spawn
        if (!spot) {
            const a = heading + (index % 2 ? 1 : -1) * (0.5 + index * 0.35);
            spot = {
                x: main.x + Math.sin(a) * 0.6,
                z: main.z + Math.cos(a) * 0.6,
                y: main.y,
            };
        }
        placed.push({
            ...spot,
            delay:
                RECORDING_ARRIVAL_FIRST_S +
                index * RECORDING_ARRIVAL_EVERY_S +
                dice(index, 3) * 0.25,
        });
    }
    return placed;
}
