/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { WorldToolArtwork } from "./WorldToolArtwork";

beforeAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});
afterAll(() => {
    delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
});

test("the globe is visible before loading and after failure without a hover", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(<WorldToolArtwork />));
    const img = host.querySelector("img");
    expect(host.querySelector("svg")).not.toBeNull();
    expect(img.style.visibility).toBe("hidden");
    act(() => img.dispatchEvent(new Event("load")));
    expect(host.querySelector("svg")).toBeNull();
    expect(img.style.visibility).toBe("visible");
    act(() => img.dispatchEvent(new Event("error")));
    expect(host.querySelector("svg")).not.toBeNull();
    expect(img.style.visibility).toBe("hidden");
    act(() => root.unmount());
    host.remove();
});
