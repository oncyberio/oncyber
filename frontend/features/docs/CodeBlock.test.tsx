/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import CodeBlock from "./CodeBlock";

test("copies the block's text and says so", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const container = document.createElement("div");
    const root = createRoot(container);
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const code = "pnpm install --frozen-lockfile\npnpm dev:local";
    act(() => root.render(<CodeBlock lang="sh" code={code} />));
    const button = container.querySelector("button")!;
    expect(container.querySelector("pre code")!.textContent).toBe(code);
    expect(button.getAttribute("aria-label")).toBe("Copy");
    await act(async () => button.click());
    expect(writeText).toHaveBeenCalledWith(code);
    expect(button.getAttribute("aria-label")).toBe("Copied");
    act(() => root.unmount());
});
