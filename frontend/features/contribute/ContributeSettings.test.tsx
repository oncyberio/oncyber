/** @jest-environment jsdom */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import ContributeSettings from "./ContributeSettings";
import { resetContributeCache, writeContributeSettings } from "./store";

jest.mock("./githubSignIn", () => ({ signInWithGitHub: jest.fn() }));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("Contribute settings", () => {
    let container: HTMLDivElement;
    beforeEach(() => {
        localStorage.clear();
        resetContributeCache();
        container = document.createElement("div");
        document.body.appendChild(container);
    });
    afterEach(() => container.remove());

    it("asks for both accounts before contributor mode can turn on", async () => {
        const root = createRoot(container);
        await act(async () => root.render(<ContributeSettings />));
        const buttons = () =>
            [...container.querySelectorAll("button")].map((b) => b.textContent);
        expect(buttons()).toContain("Sign in with GitHub");
        expect(buttons()).toContain("Sign in with ChatGPT");
        // No client ID from OpenAI yet: the ChatGPT button waits.
        const chatgpt = [...container.querySelectorAll("button")].find(
            (b) => b.textContent === "Sign in with ChatGPT"
        );
        expect(chatgpt.disabled).toBe(true);
        for (const label of ["Use a token instead", "Use an API key instead"]) {
            const link = [...container.querySelectorAll("button")].find(
                (b) => b.textContent === label
            );
            await act(async () => link.click());
        }
        expect(
            container.querySelector('[aria-label="GitHub token"]')
        ).not.toBeNull();
        expect(
            container.querySelector('[aria-label="OpenAI API key"]')
        ).not.toBeNull();
        const toggle =
            container.querySelector<HTMLButtonElement>('[role="switch"]');
        expect(toggle.disabled).toBe(true);

        await act(async () =>
            writeContributeSettings({
                githubToken: "g",
                githubLogin: "ada",
                aiKey: "k",
                aiModel: "gpt-5",
            })
        );
        expect(container.textContent).toContain("Signed in as @ada");
        expect(toggle.disabled).toBe(false);
        await act(async () => toggle.click());
        expect(
            JSON.parse(localStorage.getItem("oncyber.contribute.v1")).enabled
        ).toBe(true);
        await act(async () => root.unmount());
    });
});
