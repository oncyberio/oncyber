/** @jest-environment node */
import { drawText } from "./text";

/** A canvas that writes down what is drawn on it. */
function canvas() {
    const drawn: string[] = [];
    const context: any = {
        measureText: (text: string) => ({ width: text.length * 30 }),
        fillRect: (...box: number[]) => drawn.push(`rect ${box.join(" ")}`),
        fillText: (text: string) =>
            drawn.push(`text ${text} in ${context.fillStyle}`),
    };
    return { width: 0, height: 0, getContext: () => context, drawn };
}

let made: ReturnType<typeof canvas>[] = [];
beforeEach(() => {
    made = [];
    (global as any).document = {
        createElement() {
            const next = canvas();
            made.push(next);
            return next;
        },
    };
});
afterAll(() => {
    delete (global as any).document;
});

describe("a thing's text, drawn into a texture", () => {
    test("each line is drawn, in the thing's colours, on a canvas that fits", () => {
        const { texture, aspect } = drawText({
            text: "Shop\nOpen late",
            textColor: "#ffcc00",
            background: "#000000",
        });
        const [surface] = made;
        expect(surface.drawn).toEqual([
            `rect 0 0 ${surface.width} ${surface.height}`,
            "text Shop in #ffcc00",
            "text Open late in #ffcc00",
        ]);
        // Wide enough for the longest line, tall enough for two.
        expect(surface.width).toBe(9 * 30 + 64);
        expect(surface.height).toBe(Math.ceil(2 * 64 * 1.25 + 32));
        expect(aspect).toBeCloseTo(surface.width / surface.height);
        expect(texture.image).toBe(surface);
    });

    test("no background is none; no colour is white; six lines at most", () => {
        drawText({ text: "1\n2\n3\n4\n5\n6\n7\n8" });
        expect(made[0].drawn).toHaveLength(6);
        expect(made[0].drawn[0]).toBe("text 1 in #ffffff");
    });

    test("new words are drawn into the canvas the thing already has", () => {
        const first = drawText({ text: "One" });
        const second = drawText({ text: "Two" }, first.texture);
        expect(made).toHaveLength(1);
        expect(second.texture).toBe(first.texture);
        expect(made[0].drawn[made[0].drawn.length - 1]).toBe(
            "text Two in #ffffff"
        );
    });
});
