/** @jest-environment jsdom */
import {
    CYCLE_MS,
    LOOP_FRAMES,
    HOLD_MS,
    LOOP_MS,
    MORPH_MS,
    REST_FRAME,
    loadingLogoPose,
    startLoadingLogo,
} from "./loadingLogo";

describe("loadingLogoPose", () => {
    it("plays up to the rest frame, morphs to the old logo, holds, comes back, and rewinds", () => {
        expect(loadingLogoPose(0)).toEqual({
            phase: "loop",
            frame: REST_FRAME - LOOP_FRAMES + 1,
        });
        expect(loadingLogoPose(LOOP_MS - 1)).toEqual({
            phase: "loop",
            frame: REST_FRAME,
        });
        const atMorphStart = loadingLogoPose(LOOP_MS + 0.01);
        expect(atMorphStart.phase).toBe("morph");
        if (atMorphStart.phase === "morph")
            expect(atMorphStart.morph).toBeCloseTo(1, 3);
        expect(loadingLogoPose(LOOP_MS + MORPH_MS + 1)).toMatchObject({
            phase: "morph",
            morph: 0,
            angle: 180,
        });
        expect(loadingLogoPose(LOOP_MS + MORPH_MS + HOLD_MS - 1)).toMatchObject(
            { morph: 0 }
        );
        const rewindStart = LOOP_MS + MORPH_MS + HOLD_MS + MORPH_MS;
        const backDone = loadingLogoPose(rewindStart - 1);
        expect(backDone.phase).toBe("morph");
        if (backDone.phase === "morph")
            expect(backDone.morph).toBeCloseTo(1, 2);
        expect(loadingLogoPose(rewindStart + 0.01)).toEqual({
            phase: "loop",
            frame: REST_FRAME,
        });
        expect(loadingLogoPose(CYCLE_MS - 1)).toEqual({
            phase: "loop",
            frame: REST_FRAME - LOOP_FRAMES + 1,
        });
        expect(CYCLE_MS).toBe(LOOP_MS * 2 + MORPH_MS * 2 + HOLD_MS);
    });

    it("never jumps by more than one frame or a few degrees", () => {
        let previous = loadingLogoPose(0);
        for (let ms = 1; ms <= CYCLE_MS * 2; ms += 1) {
            const pose = loadingLogoPose(ms);
            if (pose.phase === "loop" && previous.phase === "loop") {
                expect(
                    Math.abs(pose.frame - previous.frame)
                ).toBeLessThanOrEqual(1);
            } else if (pose.phase === "morph" && previous.phase === "morph") {
                expect(Math.abs(pose.morph - previous.morph)).toBeLessThan(
                    0.01
                );
                expect(Math.abs(pose.angle - previous.angle)).toBeLessThan(2);
            } else if (pose.phase === "loop") {
                expect(pose.frame).toBe(REST_FRAME);
            } else {
                expect(previous).toEqual({ phase: "loop", frame: REST_FRAME });
                expect(pose.morph).toBeCloseTo(1, 2);
            }
            previous = pose;
        }
    });

    it("holds the rest frame for reduced motion", () => {
        expect(loadingLogoPose(LOOP_MS + 10, true)).toEqual({
            phase: "loop",
            frame: REST_FRAME,
        });
    });
});

describe("startLoadingLogo", () => {
    it("mounts in the middle of its parent and removes itself", () => {
        const parent = document.createElement("div");
        const logo = startLoadingLogo(parent);
        expect(parent.querySelector("[data-loading-logo]")).toBe(logo.element);
        expect(logo.element.querySelector("svg")).not.toBeNull();
        logo.remove();
        expect(parent.querySelector("[data-loading-logo]")).toBeNull();
    });
});
