/** @jest-environment jsdom */
import {
    CYCLE_MS,
    FRAME_COUNT,
    FRAME_MS,
    HOLD_MS,
    LOOP_MS,
    MORPH_MS,
    REST_FRAME,
    loadingLogoPose,
    startLoadingLogo,
} from "./loadingLogo";

describe("loadingLogoPose", () => {
    it("plays the sequence from the rest frame, morphs to the old logo, holds, and comes back", () => {
        expect(loadingLogoPose(0)).toEqual({
            phase: "loop",
            frame: REST_FRAME,
        });
        expect(loadingLogoPose(FRAME_MS * 10 + 1)).toEqual({
            phase: "loop",
            frame: REST_FRAME + 10,
        });
        // One whole loop ends back on the rest frame.
        expect(loadingLogoPose(LOOP_MS - 1)).toEqual({
            phase: "loop",
            frame: (REST_FRAME + FRAME_COUNT - 1) % FRAME_COUNT,
        });
        const atMorphStart = loadingLogoPose(LOOP_MS + 0.01);
        expect(atMorphStart).toMatchObject({ phase: "morph", morph: 1 });
        expect(loadingLogoPose(LOOP_MS + MORPH_MS + 1)).toMatchObject({
            phase: "morph",
            morph: 0,
            angle: 180,
        });
        expect(loadingLogoPose(LOOP_MS + MORPH_MS + HOLD_MS - 1)).toMatchObject(
            { morph: 0 }
        );
        const back = loadingLogoPose(CYCLE_MS - 1);
        expect(back.phase).toBe("morph");
        if (back.phase === "morph") expect(back.morph).toBeCloseTo(1, 2);
        expect(CYCLE_MS).toBe(LOOP_MS + MORPH_MS + HOLD_MS + MORPH_MS);
    });

    it("never jumps in shape or angle during the morphs", () => {
        let previous = loadingLogoPose(LOOP_MS);
        for (let ms = LOOP_MS + 1; ms <= CYCLE_MS; ms += 1) {
            const pose = loadingLogoPose(ms);
            if (pose.phase === "morph" && previous.phase === "morph") {
                expect(Math.abs(pose.morph - previous.morph)).toBeLessThan(
                    0.01
                );
                expect(Math.abs(pose.angle - previous.angle)).toBeLessThan(2);
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
