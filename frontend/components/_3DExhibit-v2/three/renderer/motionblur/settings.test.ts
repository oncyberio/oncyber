import {
    DEFAULT_SAMPLES,
    DEFAULT_SHUTTER,
    isCameraCut,
    motionBlurOptions,
    quaternionAngle,
    tileSize,
} from "./settings";

describe("motionBlurOptions", () => {
    test("off unless the page asks for it", () => {
        expect(motionBlurOptions("").enabled).toBe(false);
        expect(motionBlurOptions("?motionblur=0").enabled).toBe(false);
        expect(motionBlurOptions("?motionblur=").enabled).toBe(false);
        for (const on of ["1", "on", "true", "YES"])
            expect(motionBlurOptions(`?motionblur=${on}`).enabled).toBe(true);
    });

    test("shutter and samples default, and stay in range", () => {
        expect(motionBlurOptions("?motionblur=1")).toEqual({
            enabled: true,
            shutter: DEFAULT_SHUTTER,
            samples: DEFAULT_SAMPLES,
        });
        expect(motionBlurOptions("?mbshutter=0.25").shutter).toBe(0.25);
        expect(motionBlurOptions("?mbshutter=4").shutter).toBe(1);
        expect(motionBlurOptions("?mbshutter=abc").shutter).toBe(
            DEFAULT_SHUTTER
        );
        expect(motionBlurOptions("?mbsamples=2").samples).toBe(4);
        expect(motionBlurOptions("?mbsamples=100").samples).toBe(32);
        expect(motionBlurOptions("?mbsamples=8.6").samples).toBe(9);
    });
});

test("tiles are the longest blur: 2.5% of the height", () => {
    expect(tileSize(1080)).toBe(27);
    expect(tileSize(2160)).toBe(54);
    expect(tileSize(10)).toBe(4);
});

describe("isCameraCut", () => {
    const still = { x: 0, y: 0, z: 0, w: 1 };
    // 90 degrees about Y
    const turned = { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 };
    const at = (x: number, quaternion = still, time = 1) => ({
        position: { x, y: 0, z: 0 },
        quaternion,
        time,
    });

    test("walking and turning is motion", () => {
        expect(isCameraCut(at(0), at(0.1, still, 1.016))).toBe(false);
        const small = {
            x: 0,
            y: Math.sin(0.05),
            z: 0,
            w: Math.cos(0.05),
        };
        expect(isCameraCut(at(0), at(0, small, 1.016))).toBe(false);
    });

    test("teleports, big turns and pauses are cuts", () => {
        expect(isCameraCut(at(0), at(5, still, 1.016))).toBe(true);
        expect(isCameraCut(at(0), at(0, turned, 1.016))).toBe(true);
        expect(isCameraCut(at(0), at(0, still, 2))).toBe(true);
        expect(isCameraCut(at(0, still, -Infinity), at(0))).toBe(true);
    });

    test("quaternionAngle", () => {
        expect(quaternionAngle(still, still)).toBe(0);
        expect(quaternionAngle(still, turned)).toBeCloseTo(Math.PI / 2);
    });
});
