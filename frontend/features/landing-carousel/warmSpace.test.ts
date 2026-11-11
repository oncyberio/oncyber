/** @jest-environment jsdom */
import { directEntry, opensSpace } from "./warmSpace";
import { GPU_TIER_STORAGE_KEY } from "@components/_3DExhibit-v2/three/utils/gpuTierMemory";

const card = (extra: any = {}) =>
    ({ id: "space-1", href: "/void", title: "Void", ...extra } as any);

describe("opensSpace", () => {
    it("warms space cards only", () => {
        expect(opensSpace(card())).toBe(true);
        expect(opensSpace(card({ href: "" }))).toBe(false);
        expect(opensSpace(card({ id: "template-void" }))).toBe(false);
        expect(opensSpace(card({ id: "build-gallery" }))).toBe(false);
        expect(opensSpace(card({ buildStatus: "Soon" }))).toBe(false);
        expect(opensSpace(undefined)).toBe(false);
    });
});

describe("directEntry", () => {
    afterEach(() => localStorage.clear());

    it("has no tier before the GPU was ever looked up", () => {
        expect(directEntry()).toMatchObject({ kind: "direct", gpuTier: null });
    });

    it("uses the tier remembered from an earlier space", () => {
        localStorage.setItem(
            GPU_TIER_STORAGE_KEY,
            JSON.stringify({
                version: "3.1.30",
                userAgent: navigator.userAgent,
                savedAt: Date.now(),
                result: { type: "BENCHMARK", tier: 3 },
            })
        );
        expect(directEntry()).toMatchObject({
            kind: "direct",
            gpuTier: "high",
        });
    });
});
