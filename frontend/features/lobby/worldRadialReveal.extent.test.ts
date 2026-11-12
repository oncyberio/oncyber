import { buildRadialCellSchedule } from "./worldRadialReveal";

const anchor = { x: 0, y: 0, z: 0 };
const cells = [2, 8, 20].map((distance) => ({
    key: String(distance),
    center: { x: distance, y: 1, z: 0 },
}));

test.each(["outward", "inward"] as const)(
    "separate surfaces share the same %s wave with an explicit extent",
    (direction) => {
        const settings = { fullRange: true, radius: 18, direction };
        const whole = buildRadialCellSchedule(cells, anchor, settings);
        const extent = Math.max(...whole.map((step) => step.distance));
        const subset = buildRadialCellSchedule(cells.slice(0, 2), anchor, {
            ...settings,
            extent,
        });
        expect(subset).toEqual(whole.filter((step) => step.key !== "20"));
    }
);

test.each([undefined, NaN, Infinity, -1, 0, 2])(
    "invalid or shorter extent (%s) preserves full coverage",
    (extent) => {
        const settings = { fullRange: true, radius: 18 };
        expect(
            buildRadialCellSchedule(cells, anchor, { ...settings, extent })
        ).toEqual(buildRadialCellSchedule(cells, anchor, settings));
    }
);
