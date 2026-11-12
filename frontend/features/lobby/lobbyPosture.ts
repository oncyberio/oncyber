import type { LobbyMotionInput } from "./locomotion";

const clamp = (n: number, limit: number) =>
    Math.max(-limit, Math.min(limit, n));
const finite = (n: number) => (Number.isFinite(n) ? n : 0);

/** Reused offsets in the lobby's forward (-Z) frame. No renderer or allocations. */
export function createLobbyPosture() {
    const pose = { pitch: 0, roll: 0, twist: 0 };
    let previousSpeed: number | undefined;
    return {
        update(dt: number, motion?: LobbyMotionInput) {
            const step = Math.max(0, Math.min(finite(dt), 0.1));
            const speed = Math.max(0, finite(motion?.speed));
            const acceleration =
                step > 0 && previousSpeed !== undefined
                    ? clamp((speed - previousSpeed) / step, 16)
                    : 0;
            previousSpeed = motion ? speed : undefined;
            const enabled =
                motion &&
                motion.grounded &&
                motion.procedural !== false &&
                motion.quality !== "crowd";
            const turn = enabled ? clamp(finite(motion.turnRate), 5) : 0;
            const error = enabled
                ? clamp(finite(motion.headingError), 0.65)
                : 0;
            // Angles stay small: about 5° pitch, 3° bank and 12° torso lead.
            const pitch = enabled ? clamp(acceleration * -0.006, 0.085) : 0;
            const roll = enabled
                ? clamp(turn * 0.012 * Math.min(speed / 2, 1), 0.05)
                : 0;
            const twist = enabled
                ? clamp(error * 0.24 + turn * 0.018, 0.21)
                : 0;
            const ease = 1 - Math.exp(-14 * step);
            pose.pitch += (pitch - pose.pitch) * ease;
            pose.roll += (roll - pose.roll) * ease;
            pose.twist += (twist - pose.twist) * ease;
            return pose;
        },
    };
}
