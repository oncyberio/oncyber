// The club's floor plan for a walking visitor: the outer fence, the glass
// and mesh enclosure with its four side doors, and the net. Pure, so the
// tests can run it. Walking itself (pace, jump, camera) is the locomotion
// kit's (docs/games/locomotion.md); the kit has no collisions, so this is
// what its walker's `constrain` calls.
const finite = (value, fallback = 0) =>
    Number.isFinite(value) ? value : fallback;
export const PADEL_VISIT_BOUNDS = Object.freeze({
    left: -12,
    right: 12,
    back: -17.7,
    front: 17.7,
});
// Match the actual padel net/posts, courtside benches and coolers in world.js.
const obstacles = [
    [-5.12, 5.12, -0.12, 0.12], // net and posts
    [-5.08, 5.08, -10.08, -9.92], // back glass
    [-5.08, 5.08, 9.92, 10.08],
    ...[-5, 5].flatMap((x) => [
        [x - 0.08, x + 0.08, -10, -2],
        [x - 0.08, x + 0.08, -0.45, 0.45],
        [x - 0.08, x + 0.08, 2, 10],
    ]), // side glass/mesh; entry doors at .45 < |z| < 2
];
const RADIUS = 0.32;
export function padelPositionAllowed(x, z, radius = RADIUS) {
    if (![x, z, radius].every(Number.isFinite) || radius < 0) return false;
    const b = PADEL_VISIT_BOUNDS;
    return (
        x >= b.left + radius &&
        x <= b.right - radius &&
        z >= b.back + radius &&
        z <= b.front - radius &&
        !obstacles.some(
            ([left, right, back, front]) =>
                x > left - radius &&
                x < right + radius &&
                z > back - radius &&
                z < front + radius
        )
    );
}
export function moveInPadelWorld(x, z, dx, dz, radius = RADIUS) {
    if (![x, z, dx, dz].every(Number.isFinite))
        return { x: finite(x, -7.2), z: finite(z, 11.8) };
    // Small swept steps prevent a slow frame or a jump from tunnelling through a net.
    const steps = Math.max(
        1,
        Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.15)
    );
    dx /= steps;
    dz /= steps;
    for (let step = 0; step < Math.min(steps, 512); step++) {
        if (padelPositionAllowed(x + dx, z, radius)) x += dx;
        if (padelPositionAllowed(x, z + dz, radius)) z += dz;
    }
    return { x, z };
}

/** Where a visitor arrives and returns to after a match: outside the glass. */
export const CLUB_SPAWN = Object.freeze({ x: -7.2, z: 11.8 });

/**
 * `constrain` for the locomotion kit's walker. The kit hands over only the
 * state after a step, so the last whole-step position is remembered here and
 * the move is swept from it: a clamp alone would let a fast step through the
 * 16 cm glass. `walker()` returns the walker (its `state` is the whole-step
 * state; any other object is the extrapolated pose it draws).
 */
export function createClubConstraint(walker) {
    let last = null;
    const constrain = (state) => {
        const whole = walker()?.state;
        const from = state === whole || !whole ? last : whole;
        // Nothing remembered yet (just placed): a legal position stands.
        if (!from && padelPositionAllowed(state.x, state.z)) {
            last = { x: state.x, z: state.z };
            return;
        }
        const base =
            from && padelPositionAllowed(from.x, from.z) ? from : CLUB_SPAWN;
        const next = moveInPadelWorld(
            base.x,
            base.z,
            state.x - base.x,
            state.z - base.z
        );
        state.x = next.x;
        state.z = next.z;
        if (state === whole || !whole) last = { x: next.x, z: next.z };
    };
    /** After `walker.place()`: forget where the walker was. */
    constrain.reset = (position) => {
        last = position ? { x: position.x, z: position.z } : null;
    };
    return constrain;
}
