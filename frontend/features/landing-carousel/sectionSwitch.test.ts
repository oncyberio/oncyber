import {
    FILTER_HANDOVER,
    FILTER_TRAVEL,
    placeFilter,
    placeSwitch,
    stepSeparation,
    SWITCH_EASE_MS,
    SWITCH_GAP,
    SWITCH_SETTLE_MS,
} from "./sectionSwitch";

const items = (templatesAt: number) => [
    { width: 80, natural: 100, y: 0 },
    { width: 70, natural: templatesAt, y: 4 },
];
const frame = (separated: number) => ({
    left: 100,
    top: 10,
    right: 1000,
    separated,
});

describe("section switch", () => {
    it("sits side by side at rest", () => {
        const placed = placeSwitch(items(600), frame(0));
        expect(placed.map((item) => item.x)).toEqual([
            100,
            100 + 80 + SWITCH_GAP,
        ]);
        expect(placed.every((item) => item.y === 10)).toBe(true);
    });

    it("comes apart while scrolling: rides, or waits at the right", () => {
        expect(placeSwitch(items(600), frame(1))[1]).toEqual({ x: 600, y: 4 });
        expect(placeSwitch(items(2000), frame(1))[1].x).toBe(1000 - 70);
        expect(placeSwitch(items(2000), frame(1))[0].x).toBe(100);
    });

    it("docks beside the first label once its section reaches the left", () => {
        expect(placeSwitch(items(-400), frame(1))[1]).toEqual({
            x: 100 + 80 + SWITCH_GAP,
            y: 10,
        });
    });

    it("separates while moving and rejoins after scrolling stops", () => {
        const state = { value: 0, lastMove: -Infinity, lastTime: 0 };
        stepSeparation(state, SWITCH_EASE_MS, true);
        expect(state.value).toBe(1);
        expect(
            stepSeparation(state, SWITCH_EASE_MS + SWITCH_SETTLE_MS / 2, false)
                .value
        ).toBeLessThan(1 + 1e-9);
        let now = SWITCH_EASE_MS + SWITCH_SETTLE_MS + 1;
        stepSeparation(state, now, false);
        now += SWITCH_EASE_MS;
        const rest = stepSeparation(state, now, false);
        expect(rest).toEqual({ value: 0, animating: false });
        expect(stepSeparation(state, now, true, true).value).toBe(1);
    });

    it("keeps room after a label for its section's filters", () => {
        const [first, second] = items(-400);
        const placed = placeSwitch(
            [{ ...first, after: 200 }, second],
            frame(0)
        );
        expect(placed[1].x).toBe(100 + 80 + SWITCH_GAP + 200);
    });

    it("hands the filters over to the edge as their section scrolls", () => {
        const at = (scrolled: number, handover = true) =>
            placeFilter({ scrolled, start: 300, edge: 40, handover });
        expect(at(0)).toEqual({
            handed: 0,
            list: { x: 300, opacity: 1 },
            menu: { x: 40 + FILTER_TRAVEL, opacity: 0 },
        });
        expect(at(FILTER_HANDOVER)).toEqual({
            handed: 1,
            list: { x: 300 - FILTER_TRAVEL, opacity: 0 },
            menu: { x: 40, opacity: 1 },
        });
        // Never both at once: the list is gone before the menu shows.
        const half = at(FILTER_HANDOVER / 2);
        expect(half.list.opacity).toBe(0);
        expect(half.menu.opacity).toBe(0);
        // With no room at the edge the filters stay where they are.
        expect(at(3, false).list).toEqual({ x: 300, opacity: 1 });
    });
});
