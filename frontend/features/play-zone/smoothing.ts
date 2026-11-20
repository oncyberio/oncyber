/**
 * The server sends where things are 20 times a second; the screen draws 60
 * or more. Each drawn pose eases towards the last one received, so things
 * glide between updates instead of stepping.
 *
 * Poses are seven numbers a body: x y z, then the rotation x y z w.
 */

/** How quickly a drawn pose closes on its target, per second. */
export const POSITION_RATE = 18;
export const ROTATION_RATE = 22;
/** A jump this long is a serve or a respawn, not motion: show it at once. */
export const SNAP_DISTANCE = 2;

/**
 * Moves `shown` towards `target` by `seconds` of easing. Bodies never heard
 * about (`known[i]` is 0) are left alone.
 */
export function smoothPoses(
    shown: Float32Array,
    target: Float32Array,
    known: Uint8Array,
    seconds: number
) {
    const move = 1 - Math.exp(-POSITION_RATE * seconds);
    const turn = 1 - Math.exp(-ROTATION_RATE * seconds);
    for (let i = 0; i < known.length; i++) {
        if (!known[i]) continue;
        const p = i * 7;
        const dx = target[p] - shown[p],
            dy = target[p + 1] - shown[p + 1],
            dz = target[p + 2] - shown[p + 2];
        if (
            known[i] === 1 ||
            dx * dx + dy * dy + dz * dz > SNAP_DISTANCE * SNAP_DISTANCE
        ) {
            // First sight, or a jump: no easing from wherever it was.
            shown.set(target.subarray(p, p + 7), p);
            known[i] = 2;
            continue;
        }
        shown[p] += dx * move;
        shown[p + 1] += dy * move;
        shown[p + 2] += dz * move;
        // q and -q are the same rotation; ease along the shorter way.
        let dot = 0;
        for (let k = 3; k < 7; k++) dot += shown[p + k] * target[p + k];
        const sign = dot < 0 ? -1 : 1;
        let length = 0;
        for (let k = 3; k < 7; k++) {
            shown[p + k] += (target[p + k] * sign - shown[p + k]) * turn;
            length += shown[p + k] * shown[p + k];
        }
        length = Math.sqrt(length) || 1;
        for (let k = 3; k < 7; k++) shown[p + k] /= length;
    }
}
