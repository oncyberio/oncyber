import { FIELD_BUDGETS, healthFindings } from "./healthFindings";
import type { ReleaseHealth } from "./gameHealthSummary";

const device = (
    visits: number,
    first: [number, number] | null,
    frames: [number, number] | null
) => ({
    visits,
    firstFrameMs: first && { median: first[0], p95: first[1] },
    frameMs: frames && { median: frames[0], p95: frames[1], windows: 10 },
});
const release = (patch: Partial<ReleaseHealth> = {}): ReleaseHealth => ({
    release: "r1",
    visits: 200,
    devices: { desktop: 150, phone: 50 },
    firstFrameMs: { median: 1200, p95: 3000 },
    frameMs: { median: 16.7, p95: 22, windows: 80 },
    byDevice: {
        desktop: device(150, [1000, 2500], [16.7, 20]),
        phone: device(50, [1800, 4000], [18, 28]),
    },
    loadFailures: 0,
    failures: [],
    ...patch,
});
const codes = (value: ReleaseHealth) =>
    healthFindings(value).map((found) => found.code);

describe("what a game's field health asks of its maker", () => {
    test("a game within its budgets everywhere asks nothing", () => {
        expect(healthFindings(release())).toEqual([]);
    });

    test("a phone that is slow is named, though the average looks fine", () => {
        const found = healthFindings(
            release({
                byDevice: {
                    desktop: device(150, [1000, 2500], [16.7, 20]),
                    phone: device(50, [1800, 4000], [41, 70]),
                },
            })
        );
        expect(found).toHaveLength(1);
        expect(found[0]).toMatchObject({
            code: "FIELD_FRAMES_SLOW",
            device: "phone",
        });
        // The number, what it means, and what to do about it.
        expect(found[0].text).toMatch(
            /41 ms on phones: about 24 frames a second/
        );
        expect(found[0].text).toMatch(/Draw less/);
    });

    test("hitches are told apart from a low frame rate", () => {
        expect(
            codes(
                release({
                    byDevice: { desktop: device(150, [1000, 2500], [17, 90]) },
                })
            )
        ).toEqual(["FIELD_FRAMES_HITCH"]);
    });

    test("a slow first frame is held to the check's own budget", () => {
        const found = healthFindings(
            release({
                byDevice: {
                    phone: device(50, [3000, 9000], [18, 28]),
                },
            })
        );
        expect(found[0].code).toBe("FIELD_FIRST_FRAME_SLOW");
        expect(found[0].text).toContain(String(FIELD_BUDGETS.firstFrameP95Ms));
    });

    test("visits that never drew, and the errors that say why", () => {
        const found = healthFindings(
            release({
                loadFailures: 20,
                failures: [
                    {
                        kind: "prepare failed",
                        message: "texture too large",
                        where: "world.js:40",
                        count: 14,
                    },
                ],
            })
        );
        expect(found.map((one) => one.code)).toEqual([
            "FIELD_LOAD_FAILED",
            "FIELD_ERROR",
        ]);
        expect(found[0].text).toMatch(/20 of 220 visits \(9\.1%\)/);
        expect(found[1].text).toBe(
            "14× prepare failed: texture too large (world.js:40)"
        );
        // One in a hundred is within what a network loses by itself.
        expect(codes(release({ loadFailures: 2 }))).toEqual([]);
    });

    test("a handful of visits is said to be a hint; none at all, to come back", () => {
        expect(codes(release({ visits: 3 }))).toEqual(["FIELD_FEW_VISITS"]);
        expect(
            codes(
                release({
                    visits: 0,
                    byDevice: {},
                    firstFrameMs: null,
                    frameMs: null,
                })
            )
        ).toEqual(["FIELD_NO_VISITS"]);
    });

    test("the slowest device leads", () => {
        const found = healthFindings(
            release({
                byDevice: {
                    desktop: device(150, [1000, 2500], [36, 44]),
                    phone: device(50, [1800, 4000], [55, 80]),
                },
            })
        );
        expect(found.map((one) => one.device)).toEqual(["phone", "desktop"]);
    });
});
