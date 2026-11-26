/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { actionTokens, baseTokens, lobbyTokens } from "@styles/tokens";
import {
    ActionButton,
    GameChip,
    GameControl,
    GameDialog,
    GameField,
    GameGlass,
    GameLink,
    GameMark,
    GameNotice,
    GameScrim,
    moveMenuFocus,
} from "./gameControls";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});
const render = (element: React.ReactElement) => act(() => root.render(element));
/** Every rule styled-components wrote for the element, states included. */
const cssOf = (selector: string) => {
    const sheet = Array.from(document.querySelectorAll("style"))
        .map((style) => style.textContent)
        .join("");
    return Array.from(container.querySelector(selector).classList)
        .flatMap((name) =>
            Array.from(
                sheet.matchAll(new RegExp(`\\.${name}[^{]*\\{[^}]*\\}`, "g"))
            ).map((rule) => rule[0])
        )
        .join("\n");
};

test("a control over the game is the lobby's control, with every state", () => {
    render(
        <GameControl aria-pressed="true" id="c">
            Mic on
        </GameControl>
    );
    const control = container.querySelector("#c");
    // Never a form's submit button unless it says so.
    expect(control.getAttribute("type")).toBe("button");
    const css = cssOf("#c");
    expect(css).toContain(`background:${lobbyTokens.control.background}`);
    expect(css).toMatch(/:hover:not\(:disabled\)\{[^}]*background:/);
    expect(css).toMatch(
        new RegExp(
            `:focus-visible\\{[^}]*outline:${baseTokens.focus.width}px solid ${lobbyTokens.color.controlInk}`
        )
    );
    expect(css).toMatch(/\[aria-pressed="true"\][^{]*\{[^}]*background:/);
    expect(css).toMatch(/:disabled\{[^}]*opacity:/);
    // As wide as its word, at the lobby control's height.
    expect(css).toContain("width:auto");
    expect(css).toContain(`height:${lobbyTokens.control.size}px`);
    expect(css).toContain(`font:${actionTokens.type.font}`);
});

test("the small controls keep the same material and states", () => {
    render(
        <>
            <GameChip id="chip">Credits</GameChip>
            <GameMark id="mark" aria-label="Dismiss result">
                ×
            </GameMark>
            <GameControl id="send" type="submit" disabled>
                Send
            </GameControl>
        </>
    );
    for (const id of ["#chip", "#mark"]) {
        expect(cssOf(id)).toMatch(/:focus-visible\{[^}]*outline:/);
        expect(cssOf(id)).toMatch(/:hover:not\(:disabled\)/);
    }
    expect(container.querySelector("#send").getAttribute("type")).toBe(
        "submit"
    );
});

test("the field never loses its focus ring", () => {
    render(<GameField id="f" aria-label="Message" />);
    const css = cssOf("#f");
    expect(css).not.toMatch(/outline:\s*(none|0)\b/);
    expect(css).toMatch(
        new RegExp(
            `:focus-visible\\{[^}]*outline:${baseTokens.focus.width}px solid`
        )
    );
    expect(css).toMatch(/::placeholder\{[^}]*color:/);
    expect(css).toMatch(/:hover:not\(:disabled\)\{[^}]*border-color:/);
    expect(css).toMatch(/:disabled\{[^}]*opacity:/);
});

test("links and the shared action button show focus, hover and disabled", () => {
    render(
        <>
            <GameLink id="l" href="https://example.com">
                three.js
            </GameLink>
            <ActionButton id="a" $variant="white" $shape="pill">
                Follow
            </ActionButton>
            <ActionButton id="b" as="a" href="/?lobby=1">
                Back to lobby
            </ActionButton>
        </>
    );
    expect(cssOf("#l")).toMatch(/:focus-visible\{[^}]*outline:/);
    expect(cssOf("#l")).toMatch(/:hover\{[^}]*text-decoration-color:/);
    for (const id of ["#a", "#b"]) {
        expect(cssOf(id)).toMatch(/:focus-visible\{[^}]*outline:/);
        expect(cssOf(id)).toMatch(/:hover:not\(:disabled\)/);
    }
    expect(container.querySelector("#b").tagName).toBe("A");
});

test("the surfaces come from the tokens", () => {
    render(
        <>
            <GameGlass id="g" />
            <GameScrim id="s" />
            <GameDialog id="d" />
            <GameNotice id="n" />
        </>
    );
    expect(cssOf("#g")).toContain(lobbyTokens.glass.fallback);
    expect(cssOf("#s")).toContain(lobbyTokens.glass.tint.replace(/ /g, ""));
    expect(cssOf("#d")).toContain(`border-radius:${baseTokens.radius.panel}px`);
    expect(cssOf("#n")).toContain(`background:${baseTokens.color.frame}`);
});

test("Up, Down, Home and End move between a menu's actions", () => {
    render(
        <div id="menu" onKeyDown={moveMenuFocus}>
            <button id="one">Resume</button>
            <button id="off" disabled>
                Unavailable
            </button>
            <button id="two">Sound: On</button>
            <a id="three" href="/?lobby=1">
                Back to lobby
            </a>
        </div>
    );
    const press = (key: string) =>
        act(() => {
            document.activeElement.dispatchEvent(
                new KeyboardEvent("keydown", { key, bubbles: true })
            );
        });
    (container.querySelector("#one") as HTMLElement).focus();
    press("ArrowDown");
    expect(document.activeElement.id).toBe("two");
    press("ArrowDown");
    expect(document.activeElement.id).toBe("three");
    press("ArrowDown");
    expect(document.activeElement.id).toBe("one");
    press("ArrowUp");
    expect(document.activeElement.id).toBe("three");
    press("Home");
    expect(document.activeElement.id).toBe("one");
    press("End");
    expect(document.activeElement.id).toBe("three");
    // Any other key is left alone.
    press("a");
    expect(document.activeElement.id).toBe("three");
});
