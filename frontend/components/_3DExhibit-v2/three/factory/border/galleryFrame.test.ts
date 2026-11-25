import {
    GALLERY_FRAME_DEFAULTS,
    galleryFrameLayout,
    galleryLabelText,
    galleryMouldingColor,
    normalizeCredit,
    normalizeFrame,
    referenceSide,
    type FrameBox,
} from "./galleryFrame";

const gallery = (extra = {}) => normalizeFrame({ style: "gallery", ...extra });

function bounds(boxes: FrameBox[]) {
    const xs = boxes.flatMap((b) => [b.x - b.w / 2, b.x + b.w / 2]);
    const ys = boxes.flatMap((b) => [b.y - b.h / 2, b.y + b.h / 2]);
    const zs = boxes.flatMap((b) => [b.z - b.d / 2, b.z + b.d / 2]);
    return {
        x: [Math.min(...xs), Math.max(...xs)],
        y: [Math.min(...ys), Math.max(...ys)],
        z: [Math.min(...zs), Math.max(...zs)],
    };
}

/** Width of a ring part on the left side of the art (its x-extent). */
function sideWidth(boxes: FrameBox[], part: FrameBox["part"]) {
    const left = boxes.filter((b) => b.part === part && b.x < 0 && b.y === 0);
    return left.reduce((sum, b) => sum + b.w, 0);
}
function topWidth(boxes: FrameBox[], part: FrameBox["part"]) {
    const top = boxes.filter((b) => b.part === part && b.x === 0 && b.y > 0);
    return top.reduce((sum, b) => sum + b.h, 0);
}

describe("normalizeFrame", () => {
    it("keeps the flat border when there is no gallery frame", () => {
        expect(normalizeFrame(undefined)).toBeNull();
        expect(normalizeFrame(null)).toBeNull();
        expect(normalizeFrame({})).toBeNull();
        expect(normalizeFrame({ style: "baroque" })).toBeNull();
    });

    it("fills the defaults: near-black moulding, warm off-white mat", () => {
        expect(gallery()).toEqual(GALLERY_FRAME_DEFAULTS);
        expect(galleryMouldingColor(undefined)).toBe("#141414");
        expect(galleryMouldingColor("black-borderless")).toBe("#141414");
        expect(galleryMouldingColor("#5D4E43")).toBe("#5d4e43");
    });

    it("clamps sizes and rejects bad colours", () => {
        const it = gallery({
            width: 99,
            depth: -1,
            matWidth: 1000,
            matColor: "red",
            mat: "yes",
        });
        expect(it.width).toBe(15);
        expect(it.depth).toBe(0.3);
        expect(it.matWidth).toBe(30);
        expect(it.matColor).toBe(GALLERY_FRAME_DEFAULTS.matColor);
        expect(it.mat).toBe(true);
    });
});

describe("referenceSide", () => {
    it("is the shorter side, but at least a quarter of the longer", () => {
        expect(referenceSide(2, 3)).toBe(2);
        expect(referenceSide(16, 9)).toBe(9);
        expect(referenceSide(12, 1)).toBe(3);
    });
});

describe("galleryFrameLayout", () => {
    const depth = 0.04;
    const frame = gallery();

    it.each([
        ["portrait 2:3", 2, 3],
        ["square", 3, 3],
        ["landscape 16:9", 16 / 3, 3],
        ["panorama 3:1", 9, 3],
    ])("frames %s with the same width on every side", (_, w, h) => {
        const { boxes, outer } = galleryFrameLayout({
            width: w,
            height: h,
            depth,
            frame,
        });

        const ref = referenceSide(w, h);
        const mat = sideWidth(boxes, "mat");
        const moulding = sideWidth(boxes, "frame");

        expect(mat).toBeCloseTo((ref * frame.matWidth) / 100);
        expect(moulding).toBeCloseTo((ref * frame.width) / 100);
        // Not stretched by the aspect ratio: top equals side.
        expect(topWidth(boxes, "mat")).toBeCloseTo(mat);
        expect(topWidth(boxes, "frame")).toBeCloseTo(moulding);

        expect(outer.w).toBeCloseTo(w + 2 * (mat + moulding));
        expect(outer.h).toBeCloseTo(h + 2 * (mat + moulding));

        const b = bounds(boxes);
        expect(b.x[1] - b.x[0]).toBeCloseTo(outer.w);
        expect(b.y[1] - b.y[0]).toBeCloseTo(outer.h);
    });

    it("does not give a wide panorama a hairline frame", () => {
        const pano = galleryFrameLayout({ width: 12, height: 1, depth, frame });
        expect(sideWidth(pano.boxes, "frame")).toBeCloseTo(
            (3 * frame.width) / 100
        );
    });

    it("sits on the wall, with the art recessed behind mat and moulding", () => {
        const { boxes } = galleryFrameLayout({
            width: 2,
            height: 3,
            depth,
            frame,
        });
        const b = bounds(boxes);
        const zArt = depth / 2;

        // Every part starts at the wall plane.
        expect(b.z[0]).toBeCloseTo(-depth / 2);

        const matFront = Math.max(
            ...boxes.filter((it) => it.part === "mat").map((it) => it.z + it.d / 2)
        );
        const frameFront = Math.max(
            ...boxes
                .filter((it) => it.part === "frame")
                .map((it) => it.z + it.d / 2)
        );
        const backing = boxes.find((it) => it.part === "backing");

        expect(matFront).toBeGreaterThan(zArt);
        expect(frameFront).toBeGreaterThan(matFront);
        // The backing stays behind the art so it never covers it.
        expect(backing.z + backing.d / 2).toBeLessThan(zArt);
        // Two steps of moulding: an inner lip and a prouder outer ring.
        const fronts = new Set(
            boxes
                .filter((it) => it.part === "frame")
                .map((it) => (it.z + it.d / 2).toFixed(6))
        );
        expect(fronts.size).toBe(2);
    });

    it("drops the mat when it is off", () => {
        const { boxes } = galleryFrameLayout({
            width: 2,
            height: 3,
            depth,
            frame: gallery({ mat: false }),
        });
        expect(boxes.some((it) => it.part === "mat")).toBe(false);
        // the moulding hugs the art
        const inner = boxes.find((it) => it.part === "frame" && it.x < 0);
        expect(inner.x + inner.w / 2).toBeCloseTo(-1);
    });

    it("scales with the artwork", () => {
        const one = galleryFrameLayout({ width: 2, height: 3, depth, frame });
        const two = galleryFrameLayout({
            width: 2,
            height: 3,
            depth,
            frame,
            scale: { x: 2, y: 2, z: 2 },
        });
        expect(two.outer.w).toBeCloseTo(one.outer.w * 2);
        expect(two.outer.h).toBeCloseTo(one.outer.h * 2);
    });

    it("puts the label beside the lower right corner, on the wall", () => {
        const { label, outer, boxes } = galleryFrameLayout({
            width: 2,
            height: 3,
            depth,
            frame,
            withLabel: true,
        });
        expect(label).not.toBeNull();
        expect(label.x - label.w / 2).toBeGreaterThan(outer.w / 2);
        expect(label.y - label.h / 2).toBeCloseTo(-outer.h / 2);
        expect(boxes.filter((it) => it.part === "label")).toHaveLength(1);
    });

    it("uses 9 boxes without a mat, 13 with, 14 with a label", () => {
        const count = (extra, withLabel = false) =>
            galleryFrameLayout({
                width: 1,
                height: 1,
                depth,
                frame: gallery(extra),
                withLabel,
            }).boxes.length;
        expect(count({ mat: false })).toBe(9);
        expect(count({})).toBe(13);
        expect(count({}, true)).toBe(14);
    });
});

describe("galleryLabelText", () => {
    it("reads the title and the creator's username", () => {
        expect(
            galleryLabelText({
                name: "Luxury ship",
                creator: { user: { username: "jarlan" } },
            })
        ).toEqual({ title: "Luxury ship", artist: "jarlan" });
    });

    it("tidies an upload's file name and skips wallets", () => {
        expect(
            galleryLabelText({
                name: "SANCTUM_low2.jpg",
                creator: { address: "0xb2816f2af4ac", user: {} },
            })
        ).toEqual({ title: "SANCTUM low2", artist: "" });
        expect(
            galleryLabelText({
                name: "Orbit",
                creator: { username: "0xb2816f2af4ac2ef5ce42" },
            }).artist
        ).toBe("");
    });

    it("has nothing to show without a title", () => {
        expect(galleryLabelText({})).toBeNull();
        expect(galleryLabelText({ name: "  " })).toBeNull();
        expect(galleryLabelText({ name: "Untitled" })).toBeNull();
        expect(galleryLabelText(null)).toBeNull();
    });
});

describe("gallery credit", () => {
    it("is off unless the artist fills something in", () => {
        expect(gallery().credit).toBeNull();
        expect(gallery({ credit: {} }).credit).toBeNull();
        expect(gallery({ credit: { artist: "  ", x: "@" } }).credit).toBeNull();
        expect(normalizeCredit("Jarlan")).toBeNull();
    });

    it("tidies handles and websites, and trims the rest", () => {
        expect(
            normalizeCredit({
                artist: "  Jarlan   Perez ",
                location: "New York",
                x: "https://x.com/jarlanperez?s=20",
                website: "https://www.jarlanperez.com/",
                extra: "ignored",
            })
        ).toEqual({
            artist: "Jarlan Perez",
            location: "New York",
            x: "jarlanperez",
            website: "jarlanperez.com",
        });
        expect(normalizeCredit({ x: "@jarlan_p" })).toEqual({ x: "jarlan_p" });
        expect(normalizeCredit({ artist: "a".repeat(200) }).artist).toHaveLength(48);
    });

    it("shows the artist's fields, falling back to the artwork's title", () => {
        const text = galleryLabelText(
            { name: "Onward", creator: { user: { username: "jarlan" } } },
            { artist: "Jarlan Perez", location: "New York", x: "jarlanperez" }
        );
        expect(text.credit).toEqual({
            artist: "Jarlan Perez",
            location: "New York",
            title: "Onward",
            x: "jarlanperez",
            website: "",
        });
        expect(text.title).toBe("Onward");
    });

    it("lets a credit title replace the artwork's, and label untitled art", () => {
        expect(
            galleryLabelText({ name: "IMG_2231.jpg" }, { title: "Outlast" }).title
        ).toBe("Outlast");
        expect(
            galleryLabelText({}, { artist: "Jarlan Perez" }).credit.artist
        ).toBe("Jarlan Perez");
        // Only a location or links: nothing to headline, no label.
        expect(galleryLabelText({}, { location: "New York" })).toBeNull();
    });

    it("keeps the plain label when there is no credit", () => {
        expect(galleryLabelText({ name: "Orbit" }, null)).toEqual({
            title: "Orbit",
            artist: "",
        });
    });

    it("gives a credit label a taller plate", () => {
        const opts = { width: 2, height: 3, depth: 0.1, frame: gallery() };
        const plain = galleryFrameLayout({ ...opts, withLabel: true }).label;
        const credit = galleryFrameLayout({
            ...opts,
            withLabel: true,
            creditLabel: true,
        }).label;
        expect(credit.w).toBeGreaterThan(plain.w);
        expect(credit.h / credit.w).toBeGreaterThan(plain.h / plain.w);
    });
});
