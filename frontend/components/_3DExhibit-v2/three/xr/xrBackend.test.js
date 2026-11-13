import {
    canPresentXR,
    forceWebGLForXR,
    setRenderLoop,
    xrSessionInit,
} from "./xrBackend";

const QUEST =
    "Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/40.0 Chrome/140.0 Mobile VR Safari/537.36";
const DESKTOP =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

describe("forceWebGLForXR", () => {
    it("starts headset browsers on WebGL2", () => {
        expect(forceWebGLForXR({ userAgent: QUEST })).toBe(true);
    });

    it("keeps WebGPU on a headset that has the WebXR/WebGPU binding", () => {
        expect(forceWebGLForXR({ userAgent: QUEST, hasGPUBinding: true })).toBe(false);
    });

    it("leaves desktop browsers alone", () => {
        expect(forceWebGLForXR({ userAgent: DESKTOP })).toBe(false);
    });
});

describe("canPresentXR", () => {
    it("always presents on WebGL2", () => {
        expect(canPresentXR({ isWebGPUBackend: false })).toBe(true);
    });

    it("needs the binding on WebGPU", () => {
        expect(canPresentXR({ isWebGPUBackend: true })).toBe(false);
        expect(canPresentXR({ isWebGPUBackend: true, hasGPUBinding: true })).toBe(true);
    });
});

describe("xrSessionInit", () => {
    it("asks for the webgpu feature only on WebGPU", () => {
        expect(xrSessionInit({ isWebGPUBackend: false }).requiredFeatures).toBeUndefined();
        expect(xrSessionInit({ isWebGPUBackend: true }).requiredFeatures).toEqual(["webgpu"]);
    });

    it("keeps the optional features the old build asked for", () => {
        expect(xrSessionInit().optionalFeatures).toEqual([
            "local-floor",
            "bounded-floor",
            "hand-tracking",
            "layers",
        ]);
    });
});

describe("setRenderLoop", () => {
    const loop = () => {};

    it("uses the renderer's loop outside VR", () => {
        const renderer = {
            xr: { isPresenting: false, _currentAnimationLoop: null },
            setAnimationLoop: jest.fn(),
        };
        setRenderLoop(renderer, loop);
        expect(renderer.setAnimationLoop).toHaveBeenCalledWith(loop);
        expect(renderer.xr._currentAnimationLoop).toBeNull();
    });

    it("hands the loop to the XR manager while presenting", () => {
        const renderer = {
            xr: { isPresenting: true, _currentAnimationLoop: null },
            setAnimationLoop: jest.fn(),
        };
        setRenderLoop(renderer, loop);
        expect(renderer.setAnimationLoop).not.toHaveBeenCalled();
        expect(renderer.xr._currentAnimationLoop).toBe(loop);
        setRenderLoop(renderer, null);
        expect(renderer.xr._currentAnimationLoop).toBeNull();
    });
});
