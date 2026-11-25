import moment from "moment";
import { relativeTime } from "./relativeTime";

describe("time in words", () => {
    const now = Date.UTC(2026, 10, 25, 12, 0, 0);

    test("says what the date library said, across every threshold", () => {
        const second = 1000;
        const minute = 60 * second;
        const hour = 60 * minute;
        const day = 24 * hour;
        const spans = [
            0,
            44 * second,
            44.6 * second,
            45 * second,
            89 * second,
            90 * second,
            44 * minute,
            44.6 * minute,
            45 * minute,
            89 * minute,
            90 * minute,
            21 * hour,
            21.6 * hour,
            22 * hour,
            35 * hour,
            36 * hour,
            25 * day,
            25.6 * day,
            26 * day,
            45 * day,
            46 * day,
            100 * day,
            319 * day,
            320 * day,
            345 * day,
            400 * day,
            547 * day,
            548 * day,
            900 * day,
            4000 * day,
        ];
        for (const span of spans)
            for (const sign of [1, -1]) {
                const date = new Date(now + sign * span);
                expect([span, relativeTime(date, now)]).toEqual([
                    span,
                    moment(date).from(moment(now), true),
                ]);
            }
    });

    test("and across a few thousand arbitrary spans", () => {
        let seed = 12345;
        const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        for (let i = 0; i < 3000; i++) {
            const span = Math.floor(random() ** 3 * 5 * 365 * 86_400_000);
            const date = new Date(now + span);
            expect([span, relativeTime(date, now)]).toEqual([
                span,
                moment(date).from(moment(now), true),
            ]);
        }
    });

    test("a date that is not one says so, as before", () => {
        expect(relativeTime("not a date")).toBe("Invalid date");
    });
});
