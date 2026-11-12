/** @jest-environment jsdom */
import React from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import ProfilePortrait, { DEFAULT_PROFILE_PORTRAIT } from "./ProfilePortrait";

const act = (React as any).act;
(global as any).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;

beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});
function render(src?: string) {
    act(() => root.render(<ProfilePortrait src={src} className="portrait" />));
    return container.querySelector("img");
}
function loaded(image: HTMLImageElement) {
    Object.defineProperties(image, {
        complete: { configurable: true, value: true },
        naturalWidth: { configurable: true, value: 256 },
    });
    act(() => Simulate.load(image));
}

test.each([undefined, "", "   ", DEFAULT_PROFILE_PORTRAIT])(
    "uses the local Summer surface without requesting an invalid photo: %s",
    (source) => {
        expect(render(source)).toBeNull();
        expect(container.querySelector(".portrait")).not.toBeNull();
    }
);

test("a failing photo never exposes a broken image, including on rerender", () => {
    const image = render("/missing-photo.png");
    expect(image.style.visibility).toBe("hidden");
    act(() => Simulate.error(image));
    expect(image.style.visibility).toBe("hidden");
    expect(render("/missing-photo.png")).toBe(image);
    expect(image.style.visibility).toBe("hidden");
    expect(image.getAttribute("src")).toBe("/missing-photo.png");
});

test("reveals a successful photo and immediately resets when the account photo changes", () => {
    const first = render("/first.png");
    loaded(first);
    expect(first.style.visibility).toBe("visible");
    const second = render("/second.png");
    expect(second).not.toBe(first);
    expect(second.style.visibility).toBe("hidden");
    act(() => Simulate.error(second));
    expect(second.style.visibility).toBe("hidden");
    const replacement = render("/replacement.png");
    loaded(replacement);
    expect(replacement.style.visibility).toBe("visible");
});

test("recognizes a cached image whose load event happened before React attached", () => {
    jest.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(
        true
    );
    jest.spyOn(
        HTMLImageElement.prototype,
        "naturalWidth",
        "get"
    ).mockReturnValue(256);
    expect(render("/cached.png").style.visibility).toBe("visible");
});

test("keeps an image hidden when its error happened before React attached", () => {
    jest.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(
        true
    );
    jest.spyOn(
        HTMLImageElement.prototype,
        "naturalWidth",
        "get"
    ).mockReturnValue(0);
    expect(render("/already-failed.png").style.visibility).toBe("hidden");
});

test("never reveals a load that did not decode a usable image", () => {
    const image = render("/invalid-image.png");
    act(() => Simulate.load(image));
    expect(image.style.visibility).toBe("hidden");
});
