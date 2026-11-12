export const CARD_STAGGER_MS = 55;
export const CARD_EXIT_MS = 180;
export const CARD_ENTER_MS = 300;
export type CardMotion = {
    phase: "idle" | "out" | "in";
    started: number;
    from?: (index: number) => number;
};
export function transitionDuration(phase: "out" | "in", count: number) {
    return (
        (phase === "out" ? CARD_EXIT_MS : CARD_ENTER_MS) +
        CARD_STAGGER_MS * Math.max(0, count - 1)
    );
}
/** One opacity calculation drives both WebGL images and DOM captions. */
export function cardOpacity(motion: CardMotion, now: number, index: number) {
    if (motion.phase === "idle") return 1;
    const duration = motion.phase === "out" ? CARD_EXIT_MS : CARD_ENTER_MS;
    const t = Math.max(
        0,
        Math.min(
            1,
            (now - motion.started - Math.max(0, index) * CARD_STAGGER_MS) /
                duration
        )
    );
    const eased = t * t * (3 - 2 * t);
    return motion.phase === "out"
        ? (motion.from?.(index) ?? 1) * (1 - eased)
        : eased;
}
