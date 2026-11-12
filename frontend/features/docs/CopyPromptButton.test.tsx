/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import CopyPromptButton, { agentPrompt } from "./CopyPromptButton";

test("the prompt points the agent at the docs index and the repository", () => {
    const prompt = agentPrompt("https://oncyber.io");
    expect(prompt).toContain("https://oncyber.io/llms.txt");
    expect(prompt).toContain("https://github.com/oncyberio/oncyber");
});

test("copies the prompt and says so", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const container = document.createElement("div");
    const root = createRoot(container);
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    act(() => root.render(<CopyPromptButton />));
    const button = container.querySelector("button")!;
    expect(button.textContent).toBe("Copy prompt");
    await act(async () => button.click());
    expect(writeText).toHaveBeenCalledWith(agentPrompt(window.location.origin));
    expect(button.textContent).toBe("Copied");
    act(() => root.unmount());
});
