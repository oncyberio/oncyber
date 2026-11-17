/** One label of the section switch, measured in screen pixels. */
export interface SwitchItem {
    width: number;
    /** Left edge of its section's first card. */
    natural: number;
    /** Top edge of the cards where it rides. */
    y: number;
}

/** Space between labels, whether side by side or docked. */
export const SWITCH_GAP = 20;
/** How long after the last scroll movement the labels stay apart. */
export const SWITCH_SETTLE_MS = 180;
/** Duration of separating and of joining back together. */
export const SWITCH_EASE_MS = 240;

const smooth = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Where each section label goes. At rest the labels sit side by side above
 * the first visible card, as a switch. While the grid scrolls (`separated`
 * goes to 1) they come apart: the first stays at the left edge, each later
 * one rides above its section's first card, waits at the right edge while
 * its section is still off screen, and docks beside the labels before it
 * once its section reaches the left.
 */
export function placeSwitch(
    items: SwitchItem[],
    frame: {
        left: number;
        top: number;
        /** Right edge of the last full column; later labels wait there. */
        right: number;
        /** 0 at rest, 1 while scrolling. */
        separated: number;
    }
) {
    const t = smooth(Math.min(1, Math.max(0, frame.separated)));
    let joinedEnd = frame.left;
    let dockEnd = frame.left;
    return items.map((item, index) => {
        const joined = joinedEnd;
        joinedEnd += item.width + SWITCH_GAP;
        const x =
            index === 0
                ? dockEnd
                : Math.max(
                      dockEnd,
                      Math.min(item.natural, frame.right - item.width)
                  );
        const docked = index === 0 || x === dockEnd;
        dockEnd = x + item.width + SWITCH_GAP;
        return {
            x: mix(joined, x, t),
            y: mix(frame.top, docked ? frame.top : item.y, t),
        };
    });
}

/**
 * Eases the switch apart while scrolling and back together once it stops.
 * Returns the current amount and whether another frame is needed.
 */
export function stepSeparation(
    state: { value: number; lastMove: number; lastTime: number },
    now: number,
    moved: boolean,
    reducedMotion = false
) {
    if (moved) state.lastMove = now;
    const target = now - state.lastMove < SWITCH_SETTLE_MS ? 1 : 0;
    const dt = Math.max(0, now - state.lastTime);
    state.lastTime = now;
    const step = reducedMotion ? 1 : dt / SWITCH_EASE_MS;
    state.value =
        target > state.value
            ? Math.min(target, state.value + step)
            : Math.max(target, state.value - step);
    return {
        value: state.value,
        animating: state.value !== target || target === 1,
    };
}
