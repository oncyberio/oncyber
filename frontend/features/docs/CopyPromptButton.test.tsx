/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import CopyPromptButton, {
    agentPrompt,
    contributePrompt,
} from "./CopyPromptButton";

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
    expect(button.textContent).toBe("Copy for AI");
    await act(async () => button.click());
    expect(writeText).toHaveBeenCalledWith(agentPrompt(window.location.origin));
    expect(button.textContent).toBe("Copied");
    act(() => root.unmount());
});

test("the contribute prompt says how a change gets back to the project", async () => {
    const prompt = contributePrompt("https://oncyber.io");
    expect(prompt).toContain("https://oncyber.io/llms.txt");
    expect(prompt).toContain("https://github.com/oncyberio/oncyber");
    expect(prompt).toContain("CONTRIBUTING.md");
    expect(prompt).toContain("pull request");

    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const container = document.createElement("div");
    const root = createRoot(container);
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    act(() => root.render(<CopyPromptButton prompt={contributePrompt} />));
    await act(async () => container.querySelector("button")!.click());
    expect(writeText).toHaveBeenCalledWith(
        contributePrompt(window.location.origin)
    );
    act(() => root.unmount());
});

test("a page can show fewer marks and style the button itself", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    act(() =>
        root.render(
            <CopyPromptButton
                agents={["claude", "codex", "cursor"]}
                className="action white"
            />
        )
    );
    const button = container.querySelector("button")!;
    expect(button.className).toBe("copy-prompt action white");
    const marks = [...button.querySelectorAll("img")];
    expect(marks.map((mark) => mark.getAttribute("src"))).toEqual([
        "/docs/agents/claude.svg",
        "/docs/agents/codex.svg",
        "/docs/agents/cursor.svg",
    ]);
    // The white marks are flagged so a light button can darken them.
    expect(marks.map((mark) => mark.hasAttribute("data-white"))).toEqual([
        false,
        true,
        true,
    ]);
    act(() => root.unmount());
});
