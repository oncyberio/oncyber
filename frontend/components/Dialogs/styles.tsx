import styled, { css } from "styled-components";
import { actionSpec, brandFonts, brandVariables } from "@styles/brand";
import { actionTokens as action } from "@styles/tokens/action";
import { baseTokens as base } from "@styles/tokens/base";
import { landingTokens as landing } from "@styles/tokens/landing";

export type ColorSchemeName = "dark" | "light";

/**
 * A dialog's colours, as CSS variables on its root. The first eight names
 * are read outside this folder too (the space error screen and the password
 * prompt); add names, do not rename them.
 *
 * `--btn-color` fills the confirming button and `--btn-bg-color` is its
 * text. The other button is an outline in `--btn-secondary-color` with a
 * `--btn-border-color` edge.
 */
type ColorSchemeVars = {
    "--bg-color": string;
    "--title-color": string;
    "--content-color": string;
    "--border-color": string;
    "--btn-bg-color": string;
    "--btn-color": string;
    "--btn-border-color": string;
    "--img-invert": string;
    "--btn-hover-color": string;
    "--btn-pressed-color": string;
    "--btn-secondary-color": string;
    "--btn-secondary-hover-bg": string;
    "--btn-secondary-hover-border": string;
    "--btn-secondary-pressed-bg": string;
    "--field-bg-color": string;
    "--field-border-color": string;
    "--danger-color": string;
    "--dialog-shadow": string;
    "--dialog-radius": string;
    "--dialog-border": string;
};

/**
 * The older light container. Alerts, confirms and prompts never use it. It
 * remains for callers of `showModal` whose own content is a light panel
 * that relies on a white container; see `currentTheme` in index.tsx.
 */
const light: ColorSchemeVars = {
    "--bg-color": "#fff",
    "--title-color": "#18191c",
    "--content-color": "#777980",
    "--border-color": "#dfdfe4",

    "--btn-bg-color": "#fff",
    "--btn-color": "#070707",
    "--btn-border-color": "#070707",
    "--img-invert": "0.3",

    "--btn-hover-color": "#292929",
    "--btn-pressed-color": "#3d3d3d",
    "--btn-secondary-color": "#070707",
    "--btn-secondary-hover-bg": "#0707070f",
    "--btn-secondary-hover-border": "#070707",
    "--btn-secondary-pressed-bg": "#0707071f",
    "--field-bg-color": "#f5f5f5",
    "--field-border-color": "#8c8c8c",
    "--danger-color": "#c62f1f",
    "--dialog-shadow": "0em 0.5em 1.5em rgba(124, 124, 124, 0.2)",
    "--dialog-radius": "8px",
    "--dialog-border": "0 solid transparent",
};

/** The landing and studio panel material; buttons are the shared actions. */
const dark: ColorSchemeVars = {
    "--bg-color": landing.color.panel,
    "--title-color": base.color.ink,
    "--content-color": base.color.secondary,
    "--border-color": base.color.line.subtle,

    "--btn-bg-color": action.white.ink,
    "--btn-color": action.white.fill,
    "--btn-border-color": action.outline.border,
    "--img-invert": "0.7",

    "--btn-hover-color": action.white.hover,
    "--btn-pressed-color": action.white.pressed,
    "--btn-secondary-color": action.outline.ink,
    "--btn-secondary-hover-bg": action.outline.hoverFill,
    "--btn-secondary-hover-border": action.outline.hoverBorder,
    "--btn-secondary-pressed-bg": action.outline.pressedFill,
    "--field-bg-color": landing.color.canvas,
    // 3.8:1 against the panel, so the field's edge can be seen.
    "--field-border-color": base.color.line.hover,
    "--danger-color": "#ff8f80",
    "--dialog-shadow": landing.shadow.card,
    // 24 px, 16 px on small screens.
    "--dialog-radius": "var(--oc-radius-card)",
    "--dialog-border": `1px solid ${base.color.line.subtle}`,
};

export type ColorScheme = ColorSchemeVars;

export type DialogTheme = ColorSchemeName | ColorScheme;

export const DIALOG_COLOR_SCHEMES: Record<ColorSchemeName, ColorScheme> = {
    light,
    dark,
} as const;

/** Also resolves where the dialog parts are used outside a dialog root. */
const dialogFont = `var(--oc-font, ${action.type.family})`;
const titleFont = `${base.font.weight.medium} 16px/1.5 ${dialogFont}`;
const copyFont = `${base.font.weight.regular} ${base.font.size.body}px/1.5 ${dialogFont}`;

/**
 * The dialog surface. With the dark scheme it is the landing and studio
 * panel material. It registers the Oncyber fonts and the `--oc-*` variables
 * so its parts look the same on every page, but it sets no font or text
 * colour of its own: callers of `showModal` put their own content inside.
 * Put a colour scheme's variables on the same element.
 */
export const dialogSurface = css`
    ${brandFonts}
    ${brandVariables}
    box-sizing: border-box;
    background: var(--bg-color);
    border: var(--dialog-border, 1px solid var(--border-color));
    border-radius: var(--dialog-radius, var(--oc-radius-card));
    box-shadow: var(--dialog-shadow, var(--oc-shadow));

    /* The alert icons are black line art. */
    & .dialog-icon {
        filter: invert(var(--img-invert));
    }
`;

/** The dark scheme's colour variables alone, as CSS declarations. */
export const darkDialogColors = css`
    ${Object.entries(dark)
        .map(([name, value]) => `${name}: ${value};`)
        .join("\n")}
`;

/**
 * The dark dialog surface with its colour variables included, for an element
 * that cannot take a scheme as inline style. Windows built on
 * `components/modals/Modal` get it from `className="dialog-window"`.
 */
export const darkDialogSurface = css`
    ${darkDialogColors}
    ${dialogSurface}
`;

/**
 * Content shown with `showModal` that is dark on every page marks its root
 * with this attribute and sets `darkDialogColors` on it. The container then
 * draws the dark surface too, whatever the page's container scheme (see
 * `Dialog`), so the caller does not have to pass `theme: "dark"`.
 */
export const DARK_DIALOG_CONTENT = { "data-dialog-surface": "dark" } as const;

/** The container's dark surface, for `:has(> [data-dialog-surface="dark"])`. */
export const darkDialogContainer = css`
    background: ${dark["--bg-color"]};
    border: ${dark["--dialog-border"]};
    border-radius: ${dark["--dialog-radius"]};
    box-shadow: ${dark["--dialog-shadow"]};
`;

/**
 * The dialog buttons, on the shared action spec. `.primary` is the
 * confirming action (solid white on dark). Every other `.btn` is the
 * outline; `.secondary` is its usual name. Use inside any dialog-like panel
 * that has the colour variables.
 */
export const dialogButtons = css`
    & .btn {
        ${actionSpec}
        min-width: 100px;
        transition: background-color 150ms ease, border-color 150ms ease;
    }
    & .btn:hover:not(:disabled) {
        opacity: 1;
    }
    & .btn:disabled {
        opacity: ${action.state.disabledOpacity};
        cursor: not-allowed;
    }
    & .btn.primary {
        background: var(--btn-color);
        border-color: var(--btn-color);
        color: var(--btn-bg-color);
    }
    & .btn.primary:hover:not(:disabled) {
        background: var(--btn-hover-color, var(--btn-color));
        border-color: var(--btn-hover-color, var(--btn-color));
    }
    & .btn.primary:active:not(:disabled) {
        background: var(--btn-pressed-color, var(--btn-color));
        border-color: var(--btn-pressed-color, var(--btn-color));
    }
    & .btn:not(.primary) {
        background: transparent;
        border-color: var(--btn-border-color);
        color: var(--btn-secondary-color, var(--btn-color));
    }
    & .btn:not(.primary):hover:not(:disabled) {
        background: var(--btn-secondary-hover-bg, transparent);
        border-color: var(
            --btn-secondary-hover-border,
            var(--btn-border-color)
        );
    }
    & .btn:not(.primary):active:not(:disabled) {
        background: var(--btn-secondary-pressed-bg, transparent);
    }
    @media (prefers-reduced-motion: reduce) {
        & .btn {
            transition: none;
        }
    }
`;

/** Type roles from the brand guide: panel title and ordinary UI copy. */
export const dialogTitle = css`
    margin: 0;
    color: var(--title-color);
    font: ${titleFont};
    text-align: center;
`;

export const dialogCopy = css`
    margin: 0;
    color: var(--content-color);
    font: ${copyFont};
    text-align: center;
`;

export const DialogContent = styled.div<{ biggerTopPad?: boolean }>`
    display: flex;
    font-style: normal;
    border-radius: inherit;
    align-items: center;
    flex-direction: column;
    padding: 24px;
    padding-top: ${(props) => (props.biggerTopPad ? "32px" : "24px")};
    justify-content: flex-start;
    gap: 24px;
    background-color: var(--bg-color);
`;

export const DialogFooter = styled.div`
    width: 100%;
    padding-top: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    ${dialogButtons}
`;

export const DialogMain = styled.div`
    display: flex;
    align-items: center;
    flex-direction: column;
    gap: 16px;

    & > .title {
        ${dialogTitle}
    }
    & > .content {
        ${dialogCopy}
        white-space: break-spaces;
    }
`;
