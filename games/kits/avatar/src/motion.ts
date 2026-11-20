/**
 * Which lobby clip an avatar plays, as plain numbers. No renderer here, so a
 * game's simulation and its tests can use it.
 */

/** The lobby's locomotion clips (motion/locomotion.json). */
export const LOCOMOTION = ["IDLE", "WALK", "RUN", "JUMP", "WAVING"] as const;
/**
 * Every lobby emote, in a fixed order: an emote's place in this list is its
 * number on the wire, so two games that ship different subsets still agree.
 */
export const EMOTE_ORDER = [
    "CHAABI",
    "CHAABI2",
    "CRIP",
    "DEATH",
    "FLOORSITTING",
    "FLY",
    "HIPHOP",
    "MOONWALK",
    "PRAYING",
    "SEXY",
    "SHUFFLING",
    "SITTALKING",
    "SITTING",
    "TECHNO",
    "WANNAROCK",
] as const;

export interface Motion {
    /** Ground speed in metres a second. */
    speed?: number;
    /** Off the ground. */
    air?: boolean;
    wave?: boolean;
    /** A lobby emote name; plays until it is cleared. */
    emote?: string;
}

const EMOTE_BASE = 8;

/** The `a` field of a room pose (0..31) for this motion. */
export function poseCode(motion: Motion): number {
    const emote = EMOTE_ORDER.indexOf(
        motion.emote as (typeof EMOTE_ORDER)[number]
    );
    if (emote >= 0) return EMOTE_BASE + emote;
    if (motion.air) return 3;
    if (motion.wave) return 4;
    const speed = motion.speed ?? 0;
    return speed < 0.3 ? 0 : speed < 2.8 ? 1 : 2;
}

/** A room pose's `a` back into a motion. Unknown codes stand idle. */
export function readPoseCode(a: unknown, speed = 0): Motion {
    const code = typeof a === "number" && Number.isInteger(a) ? a : 0;
    if (code >= EMOTE_BASE && code < EMOTE_BASE + EMOTE_ORDER.length)
        return { emote: EMOTE_ORDER[code - EMOTE_BASE], speed: 0 };
    if (code === 3) return { air: true, speed };
    if (code === 4) return { wave: true, speed: 0 };
    // Walk and run carry no speed on the wire: use the measured one, or a
    // typical one when the pose hasn't moved yet.
    if (code === 1) return { speed: Math.min(2.7, Math.max(1.5, speed)) };
    if (code === 2) return { speed: Math.max(3.4, speed) };
    return { speed: 0 };
}

/** Clip weights to blend toward. They sum to one. */
export function clipWeights(
    motion: Motion,
    hasEmote = true
): Record<string, number> {
    if (motion.emote && hasEmote) return { [motion.emote]: 1 };
    if (motion.air) return { JUMP: 1 };
    if (motion.wave) return { WAVING: 1 };
    const speed = motion.speed ?? 0;
    if (speed < 0.3) return { IDLE: 1 };
    if (speed < 2.8) {
        const k = Math.min(1, (speed - 0.3) / 1.2);
        return { WALK: k, IDLE: 1 - k };
    }
    const k = Math.min(1, (speed - 2.8) / 1.5);
    return { RUN: k, WALK: 1 - k };
}

/** Play locomotion at the speed of travel so feet don't slide. */
export function clipRate(name: string, speed: number): number {
    if (name === "WALK") return Math.max(0.6, speed / 1.5);
    if (name === "RUN") return Math.max(0.7, speed / 5);
    return 1;
}
