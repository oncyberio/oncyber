/** @jest-environment jsdom */
import { beginSpaceEntrance, finishSpaceEntrance } from "./spaceEntrance";
const mockDraw = jest.fn();
jest.mock("@components/_3DExhibit-v2/ui/LoaderVideoContainer", () => ({
    drawStarfield: () => mockDraw,
}));
let source: HTMLAnchorElement;
beforeEach(() => {
    jest.useFakeTimers();
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
    source = document.createElement("a");
    source.href = "/world";
    document.body.append(source);
    jest.spyOn(source, "getBoundingClientRect").mockReturnValue({
        top: 100,
        left: 200,
        width: 300,
        height: 200,
    } as DOMRect);
});
afterEach(() => {
    window.dispatchEvent(new PopStateEvent("popstate"));
    source.remove();
    jest.useRealTimers();
    jest.restoreAllMocks();
});
test("fades straight to black without reading or expanding the cover", () => {
    beginSpaceEntrance(
        source,
        { title: "World", image: "/cover.jpg" },
        jest.fn()
    );
    const overlay = document.querySelector<HTMLElement>(
        "[data-space-entrance]"
    );
    expect(overlay.dataset.spaceEntrance).toBe("fading");
    expect(overlay.querySelector("img")).toBeNull();
    expect(source.getBoundingClientRect).not.toHaveBeenCalled();
    finishSpaceEntrance();
    expect(overlay.dataset.spaceEntrance).toBe("fading");
    jest.advanceTimersByTime(160);
    expect(overlay.dataset.spaceEntrance).toBe("revealing");
    jest.advanceTimersByTime(160);
    expect(document.querySelector("[data-space-entrance]")).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
});
test("Escape cancels once, removes the overlay and restores keyboard focus", () => {
    const cancel = jest.fn();
    beginSpaceEntrance(source, { title: "World" }, cancel);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-space-entrance]")).toBeNull();
    expect(document.activeElement).toBe(source);
    expect(jest.getTimerCount()).toBe(0);
});
test("Back cancels the visual bridge and late readiness cannot resurrect it", () => {
    beginSpaceEntrance(source, { title: "World" }, jest.fn());
    window.dispatchEvent(new PopStateEvent("popstate"));
    finishSpaceEntrance();
    jest.runOnlyPendingTimers();
    expect(document.querySelector("[data-space-entrance]")).toBeNull();
});
test("reduced motion skips the fade and never starts the animated tunnel", () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    const handle = beginSpaceEntrance(source, { title: "World" }, jest.fn());
    jest.advanceTimersByTime(0);
    expect(
        document.querySelector<HTMLElement>("[data-space-entrance]").dataset
            .spaceEntrance
    ).toBe("loading");
    handle.cancel();
    expect(jest.getTimerCount()).toBe(0);
});

const flushImports = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
};
test("starts the tunnel at black while the destination is still loading", async () => {
    beginSpaceEntrance(source, { title: "World" }, jest.fn());
    await flushImports();
    const overlay = document.querySelector<HTMLElement>("[data-space-entrance]");
    expect(overlay.querySelector("canvas")).toBeNull();
    jest.advanceTimersByTime(160);
    await flushImports();
    expect(overlay.dataset.spaceEntrance).toBe("loading");
    expect(overlay.querySelector("canvas")).not.toBeNull();
    finishSpaceEntrance();
    jest.advanceTimersByTime(160);
    expect(document.querySelector("[data-space-entrance]")).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
});
test("cancelling during tunnel import does not attach a late canvas", async () => {
    const entrance = beginSpaceEntrance(source, { title: "World" }, jest.fn());
    jest.advanceTimersByTime(160);
    entrance.cancel();
    await flushImports();
    expect(document.querySelector("[data-space-entrance]")).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
});
