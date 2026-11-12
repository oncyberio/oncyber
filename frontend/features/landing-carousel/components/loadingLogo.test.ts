/** @jest-environment jsdom */
import {
    CYCLE_MS,
    HOLD_MS,
    MORPH_MS,
    SPIN_MS,
    SPIN_TURNS,
    loadingLogoPose,
    startLoadingLogo,
} from "./loadingLogo";

const turn = (angle: number) => ((angle % 360) + 360) % 360;

describe("loadingLogoPose", () => {
    it("spins the new logo, morphs to the old one, holds, and comes back", () => {
        expect(loadingLogoPose(0)).toEqual({ morph: 1, angle: -0 });
        expect(loadingLogoPose(SPIN_MS / 2).morph).toBe(1);
        expect(loadingLogoPose(SPIN_MS / 2).angle).toBeCloseTo(
            -180 * SPIN_TURNS
        );
        expect(loadingLogoPose(SPIN_MS + MORPH_MS + 1).morph).toBe(0);
        expect(loadingLogoPose(SPIN_MS + MORPH_MS + HOLD_MS - 1).morph).toBe(0);
        expect(loadingLogoPose(CYCLE_MS - 1).morph).toBeCloseTo(1, 2);
        expect(CYCLE_MS).toBe(2000 + 700 + 1500 + 700);
    });

    it("never jumps in shape or angle", () => {
        let previous = loadingLogoPose(0);
        for (let ms = 1; ms <= CYCLE_MS * 2; ms += 1) {
            const pose = loadingLogoPose(ms);
            expect(Math.abs(pose.morph - previous.morph)).toBeLessThan(0.01);
            const step = turn(pose.angle - previous.angle);
            expect(Math.min(step, 360 - step)).toBeLessThan(4);
            previous = pose;
        }
    });

    it("holds the new logo still for reduced motion", () => {
        expect(loadingLogoPose(SPIN_MS + MORPH_MS + 10, true)).toEqual({
            morph: 1,
            angle: 0,
        });
    });
});

describe("startLoadingLogo", () => {
    it("mounts in the middle of its parent and removes itself", () => {
        const parent = document.createElement("div");
        const logo = startLoadingLogo(parent);
        expect(parent.querySelector("svg[data-loading-logo]")).toBe(
            logo.element
        );
        expect(logo.element.querySelectorAll("path").length).toBeGreaterThan(0);
        logo.remove();
        expect(parent.querySelector("svg")).toBeNull();
    });
});
