import { cleanStyle, describeWorld } from "./style";

describe("a world's style", () => {
    it("keeps a checked style and bounds its numbers", () => {
        expect(
            cleanStyle({
                summary: "Thick swirling paint, night blues and yellows.",
                palette: ["#0b1d51", "gold", "not a colour", "#f7e27a"],
                look: "painted",
                strokes: 4,
                wobble: -1,
                outline: "yes",
            })
        ).toEqual({
            summary: "Thick swirling paint, night blues and yellows.",
            palette: ["#0b1d51", "#ffc400", "#f7e27a"],
            look: "painted",
            strokes: 1,
            wobble: 0,
            outline: false,
        });
    });

    it("refuses a style with no palette and unknown looks fall back", () => {
        expect(cleanStyle({ summary: "x", palette: ["#fff"] })).toBeNull();
        expect(cleanStyle(null)).toBeNull();
        expect(
            cleanStyle({ palette: ["#000", "#fff"], look: "<script>" }).look
        ).toBe("matte");
    });

    it("describes the world for the model in plain lines", () => {
        expect(
            describeWorld({
                title: "Starry Night",
                sky: "#0b1d51",
                artworks: ["The Starry Night", "Sunflowers"],
            })
        ).toBe(
            "Title: Starry Night\nSky / background colour: #0b1d51\nSome artworks: The Starry Night; Sunflowers"
        );
    });
});
