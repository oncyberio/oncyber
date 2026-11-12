import {
    antialiasSamples,
    setRendererSamples,
    MEDIUM_MSAA_MAX_PIXEL_RATIO,
} from "./rendererAntialias";

describe("antialiasSamples", () => {
    test.each([
        // quality, dpi, isVR, samples
        ["high", 1, false, 4],
        ["high", 2, false, 4],
        ["medium", 1, false, 4], // 0.8 rendered px per CSS px: edges show
        ["medium", 1.25, false, 4], // 1.0
        ["medium", 1.5, false, 4], // 1.2
        ["medium", 1.75, false, 4], // 1.4
        ["medium", 2, false, 0], // 1.6: phones and dense screens
        ["low", 1, false, 0],
        ["low", 2, false, 0],
        ["low", 1, true, 4], // VR keeps full MSAA
        ["medium", 2, true, 4],
        ["high", 2, true, 4],
        [undefined, 2, false, 4], // unknown quality: as before
        ["ultra", 1, false, 4],
        ["medium", undefined, false, 4], // no ratio known: treated as 1
    ])("%s at dpi %s (VR %s) -> %i", (quality, dpi, isVR, samples) => {
        expect(antialiasSamples({ quality, dpi, isVR })).toBe(samples);
    });

    test("uses the renderer's own full count", () => {
        expect(
            antialiasSamples({ quality: "high", dpi: 1, fullSamples: 8 })
        ).toBe(8);
        expect(
            antialiasSamples({ quality: "low", dpi: 1, fullSamples: 8 })
        ).toBe(0);
    });

    test("the medium threshold sits between 1.75x and 2x screens", () => {
        expect(1.75 * 0.8).toBeLessThan(MEDIUM_MSAA_MAX_PIXEL_RATIO);
        expect(2 * 0.8).toBeGreaterThanOrEqual(MEDIUM_MSAA_MAX_PIXEL_RATIO);
    });
});

describe("setRendererSamples", () => {
    function fakeRenderer(samples = 4) {
        const target = { dispose: jest.fn() };
        const material = { dispose: jest.fn() };
        const renderer = {
            _samples: samples,
            _frameBufferTargets: new Map([["canvas", target]]),
            _quadCache: new Map([[target, { quad: { material } }]]),
        };
        return { renderer, target, material };
    }

    test("a new count drops the internal targets so they are rebuilt", () => {
        const { renderer, target, material } = fakeRenderer();
        expect(setRendererSamples(renderer, 0)).toBe(true);
        expect(renderer._samples).toBe(0);
        expect(target.dispose).toHaveBeenCalledTimes(1);
        expect(material.dispose).toHaveBeenCalledTimes(1);
        expect(renderer._frameBufferTargets.size).toBe(0);
        expect(renderer._quadCache.size).toBe(0);
    });

    test("the same count changes nothing", () => {
        const { renderer, target } = fakeRenderer();
        expect(setRendererSamples(renderer, 4)).toBe(false);
        expect(target.dispose).not.toHaveBeenCalled();
        expect(renderer._frameBufferTargets.size).toBe(1);
    });

    test("unexpected internals leave the renderer as created", () => {
        expect(setRendererSamples({ _samples: 4 }, 0)).toBe(false);
        const odd = { samples: 4, _frameBufferTargets: new Map() };
        expect(setRendererSamples(odd, 0)).toBe(false);
        expect(setRendererSamples(null, 0)).toBe(false);
    });
});
