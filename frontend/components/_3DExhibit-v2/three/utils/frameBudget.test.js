import {
    createResolutionGovernor,
    createSharpenGate,
    defaultQuality,
    MAX_FRAME_GAP_MS,
} from "./frameBudget";

const feed = (gate, frameMs, count) => {
    let verdict;
    for (let i = 0; i < count; i++) verdict = gate.observe(frameMs);
    return verdict;
};

describe("sharpen gate", () => {
    test.each([
        ["60 fps", 16.7, "good"],
        ["50 fps", 20, "good"],
        ["40 fps", 25, "poor"],
    ])("%s after settling is %s", (_label, frameMs, expected) => {
        const gate = createSharpenGate({ settleMs: 1000, windowMs: 2000 });
        // Settling: no verdict before 1 s of frames plus a 2 s window.
        expect(feed(gate, frameMs, Math.floor(2900 / frameMs))).toBe("wait");
        expect(feed(gate, frameMs, 200)).toBe(expected);
    });

    test("settling frames do not count, however slow", () => {
        const gate = createSharpenGate({ settleMs: 1000, windowMs: 1000 });
        feed(gate, 200, 5); // shader compiles, first artworks
        expect(feed(gate, 16, 70)).toBe("good");
    });

    test("too many long frames is poor even with a good average", () => {
        const gate = createSharpenGate({ settleMs: 0, windowMs: 1000 });
        let verdict;
        for (let i = 0; i < 100 && verdict !== "poor"; i++)
            verdict = gate.observe(i % 10 === 0 ? 60 : 10);
        expect(verdict).toBe("poor");
    });

    test("pauses and hidden-tab gaps are not frames", () => {
        const gate = createSharpenGate({ settleMs: 0, windowMs: 1000 });
        expect(feed(gate, MAX_FRAME_GAP_MS + 1, 50)).toBe("wait");
        expect(feed(gate, 0, 50)).toBe("wait");
        expect(feed(gate, 16, 70)).toBe("good");
    });

    test("decides once", () => {
        const gate = createSharpenGate({ settleMs: 0, windowMs: 100 });
        expect(feed(gate, 30, 10)).toBe("poor");
        expect(feed(gate, 10, 100)).toBe("poor");
        expect(gate.verdict).toBe("poor");
    });
});

describe("default quality", () => {
    test.each([
        [{ isMobile: true, gpuTier: "low" }, "medium"],
        [{ isMobile: false, gpuTier: "low" }, "medium"],
        [{ isMobile: false, gpuTier: "mid" }, "high"],
        [{ isMobile: false, gpuTier: "high" }, "high"],
    ])("%j starts at %s", (device, expected) => {
        expect(defaultQuality(device)).toBe(expected);
    });
});

describe("resolution governor", () => {
    // Feeds whole windows of one frame time; returns every change.
    const run = (governor, frameMs, windows, windowMs = 2000) => {
        const changes = [];
        const frames = Math.ceil(windowMs / frameMs);
        for (let w = 0; w < windows; w++)
            for (let i = 0; i < frames; i++) {
                const scale = governor.observe(frameMs);
                if (scale != null) changes.push(scale);
            }
        return changes;
    };

    test("a steady 60 fps never changes anything", () => {
        expect(run(createResolutionGovernor(), 16.7, 30)).toEqual([]);
    });

    test("one slow window is not enough (a hitch, an artwork upload)", () => {
        const governor = createResolutionGovernor();
        expect(run(governor, 40, 1)).toEqual([]);
        expect(run(governor, 16.7, 1)).toEqual([]);
        expect(run(governor, 40, 1)).toEqual([]);
        expect(governor.scale).toBe(1);
    });

    test("sustained slow frames step down, measuring each new size", () => {
        const governor = createResolutionGovernor();
        // Two slow windows, a step; one ignored window; two more, a step.
        expect(run(governor, 40, 2)).toEqual([0.9]);
        expect(run(governor, 40, 1)).toEqual([]);
        expect(run(governor, 40, 2)).toEqual([0.8]);
    });

    test("never below LOW's size: 0.6 of HIGH, 0.75 of MEDIUM", () => {
        const high = createResolutionGovernor({ quality: "high" });
        expect(run(high, 50, 60)).toEqual([0.9, 0.8, 0.7, 0.6]);
        const medium = createResolutionGovernor({ quality: "medium" });
        // 0.8 x 0.75 = 0.6, the LOW multiplier.
        expect(run(medium, 50, 60)).toEqual([0.9, 0.8, 0.75]);
        const low = createResolutionGovernor({ quality: "low" });
        expect(run(low, 50, 60)).toEqual([]);
    });

    test("recovers only after long, clearly fast stretches", () => {
        const governor = createResolutionGovernor();
        run(governor, 40, 2);
        expect(governor.scale).toBe(0.9);
        // 60 Hz frames are never "clearly fast": it stays down.
        expect(run(governor, 16.7, 20)).toEqual([]);
        // 120 Hz frames for five windows (after the ignored one) step up.
        expect(run(governor, 8, 6)).toEqual([1]);
    });

    test("pauses and stalls are not frames", () => {
        const governor = createResolutionGovernor();
        expect(run(governor, MAX_FRAME_GAP_MS + 1, 10)).toEqual([]);
        expect(governor.scale).toBe(1);
    });
});
