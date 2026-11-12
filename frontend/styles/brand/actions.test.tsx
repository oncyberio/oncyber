/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "styled-components";
import { RoundButton } from "@components/DesignSystem/buttons";
import { NButton } from "@ui/components/NButton";
import { actionTokens, landingTokens } from "@styles/tokens";
import { ActionButton } from "./index";

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
const styleOf = (selector = "button") =>
    getComputedStyle(container.querySelector(selector));
/** The element's own generated rule. jsdom cannot compute a `font`
 * shorthand that holds a variable, or a gradient. */
const rulesOf = (selector = "button") => {
    const sheet = Array.from(document.querySelectorAll("style"))
        .map((style) => style.textContent)
        .join("");
    return Array.from(container.querySelector(selector).classList)
        .map((name) => sheet.match(new RegExp(`\\.${name}\\{([^}]*)\\}`)))
        .map((rule) => (rule ? rule[1] : ""))
        .join(";");
};
const FONT = 'font:500 13px/1.35 var(--oc-font,"Oncyber Sans","Aeonik",';
const BLUE =
    /background:linear-gradient\( ?180deg, ?#3975ff 0%, ?#2567ff 52%, ?#1854e8 100% ?\)/;

test("the landing keeps reading the one app-wide action spec", () => {
    expect(landingTokens.action).toEqual({
        minHeight: 40,
        paddingY: 10,
        paddingX: 16,
        gap: 10,
        compactGap: 7,
        font: "500 13px/1.35",
    });
    expect(actionTokens.size).toMatchObject({
        minHeight: landingTokens.action.minHeight,
        paddingY: landingTokens.action.paddingY,
        paddingX: landingTokens.action.paddingX,
        borderWidth: 1,
    });
    expect(actionTokens.type.font).toBe(landingTokens.action.font);
    expect(actionTokens.radius).toEqual({ rectangle: 12, pill: 999 });
});

test.each([
    ["rectangle", "12px"],
    ["pill", "999px"],
] as const)(
    "a %s has the same height, padding and border; only the corners differ",
    (shape, radius) => {
        render(<ActionButton $shape={shape}>Save</ActionButton>);
        const style = styleOf();
        expect(style.borderRadius).toBe(radius);
        expect(style.minHeight).toBe("40px");
        expect(style.paddingTop).toBe("10px");
        expect(style.paddingLeft).toBe("16px");
        expect(style.borderTopWidth).toBe("1px");
        expect(rulesOf()).toContain(FONT);
    }
);

test("an action button is the outline unless told otherwise, and never submits by accident", () => {
    render(<ActionButton>Cancel</ActionButton>);
    const button = container.querySelector("button");
    expect(button.type).toBe("button");
    expect(styleOf().backgroundColor).toBe("transparent");
    expect(styleOf().borderTopColor).toBe("#ffffff99");
    expect(styleOf().color).toBe("rgb(243, 243, 241)");

    render(<ActionButton type="submit">Send</ActionButton>);
    expect(container.querySelector("button").type).toBe("submit");
});

test("white is the ordinary main action and blue the important one", () => {
    render(<ActionButton $variant="white">Continue</ActionButton>);
    expect(styleOf().backgroundColor).toBe("rgb(250, 250, 248)");
    expect(styleOf().color).toBe("rgb(32, 32, 30)");

    render(<ActionButton $variant="blue">Sign in</ActionButton>);
    expect(rulesOf()).toMatch(BLUE);
    expect(styleOf().color).toBe("rgb(255, 255, 255)");
});

test("the same button can be a link, without a button type", () => {
    render(
        <ActionButton as="a" href="/explore" $variant="white">
            Explore
        </ActionButton>
    );
    const link = container.querySelector("a");
    expect(link.getAttribute("href")).toBe("/explore");
    expect(link.hasAttribute("type")).toBe(false);
    expect(styleOf("a").minHeight).toBe("40px");
});

describe("the older button families follow the spec", () => {
    test("NButton is white on a dark surface and the shared outline when outlined", () => {
        render(
            <>
                <NButton overrideTheme="dark">Save</NButton>
                <NButton overrideTheme="dark" outline id="outlined">
                    Cancel
                </NButton>
            </>
        );
        const solid = styleOf();
        expect(solid.backgroundColor).toBe("rgb(250, 250, 248)");
        expect(solid.color).toBe("rgb(32, 32, 30)");
        expect(rulesOf()).toContain(FONT);
        expect(solid.borderTopWidth).toBe("1px");
        expect(solid.paddingLeft).toBe("16px");
        // 18 px of text, 20 px of padding and 2 px of border: 40 px.
        expect(solid.lineHeight).toBe("18px");
        const outlined = styleOf("#outlined");
        expect(outlined.backgroundColor).toBe("transparent");
        expect(outlined.borderTopColor).toBe("#ffffff99");
        expect(outlined.color).toBe("rgb(243, 243, 241)");
    });

    test("every NButton size is the same button", () => {
        render(
            <>
                <NButton overrideTheme="dark" size="small" id="small" />
                <NButton overrideTheme="dark" size="medium" id="medium" />
                <NButton overrideTheme="dark" size="large" id="large" />
            </>
        );
        for (const size of ["small", "medium", "large"]) {
            const style = styleOf(`#${size}`);
            expect(rulesOf(`#${size}`)).toContain(FONT);
            expect(style.paddingTop).toBe("10px");
            expect(style.lineHeight).toBe("18px");
        }
    });

    test("NButton follows the page theme, and is the light-page button without one", () => {
        render(
            <ThemeProvider theme={{ type: "dark" }}>
                <NButton>Save</NButton>
            </ThemeProvider>
        );
        expect(styleOf().backgroundColor).toBe("rgb(250, 250, 248)");

        render(
            <ThemeProvider theme={{ type: "light" }}>
                <NButton>Save</NButton>
            </ThemeProvider>
        );
        expect(styleOf().backgroundColor).toBe("rgb(7, 7, 7)");
        expect(styleOf().color).toBe("rgb(255, 255, 255)");

        // No theme at all used to leave the button without any fill.
        render(<NButton>Save</NButton>);
        expect(styleOf().backgroundColor).toBe("rgb(7, 7, 7)");
        expect(styleOf().color).toBe("rgb(255, 255, 255)");
    });

    test("NButton has a blue variant for sign in and publish", () => {
        render(
            <NButton variant="blue" overrideTheme="light">
                Publish
            </NButton>
        );
        expect(rulesOf()).toMatch(BLUE);
        expect(styleOf().color).toBe("rgb(255, 255, 255)");
    });

    test("RoundButton is the white pill, and stays black for light pages", () => {
        render(
            <>
                <RoundButton>Ok</RoundButton>
                <RoundButton isLight id="light">
                    Ok
                </RoundButton>
            </>
        );
        const white = styleOf();
        expect(white.backgroundColor).toBe("rgb(250, 250, 248)");
        expect(white.color).toBe("rgb(32, 32, 30)");
        expect(white.height).toBe("40px");
        expect(white.borderRadius).toBe("999px");
        expect(rulesOf()).toContain(FONT);
        expect(white.borderTopWidth).toBe("1px");
        const black = styleOf("#light");
        expect(black.backgroundColor).toBe("rgb(0, 0, 0)");
        expect(black.color).toBe("rgb(255, 255, 255)");
        expect(black.height).toBe("40px");
    });
});
