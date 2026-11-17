import { collageStrips, coverFit } from "./collage";

describe("collageStrips", () => {
    const strips = collageStrips(5, 1000, 500);

    it("covers the whole picture, corners included", () => {
        expect(strips).toHaveLength(5);
        expect(strips[0].corners[0][0]).toBeLessThan(0);
        expect(strips[0].corners[3][0]).toBeLessThan(0);
        expect(strips[4].corners[1][0]).toBeGreaterThan(1000);
        expect(strips[4].corners[2][0]).toBeGreaterThan(1000);
    });

    it("shares each cut between neighbours, leaning one way", () => {
        for (let index = 1; index < strips.length; index++) {
            const [top, , , bottom] = strips[index].corners;
            expect(strips[index - 1].corners[1]).toEqual(top);
            expect(strips[index - 1].corners[2]).toEqual(bottom);
            expect(top[0]).toBeGreaterThan(bottom[0]);
            expect((top[0] + bottom[0]) / 2).toBeCloseTo(index * 200);
        }
    });

    it("keeps every picture's box inside the frame", () => {
        for (const { box } of strips) {
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(1000);
        }
    });
});

describe("coverFit", () => {
    it("fills the box and centres the overflow", () => {
        const fit = coverFit(400, 100, {
            x: 100,
            y: 0,
            width: 200,
            height: 500,
        });
        expect(fit.height).toBe(500);
        expect(fit.width).toBe(2000);
        expect(fit.x + fit.width / 2).toBe(200);
    });
});
