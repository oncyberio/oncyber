import styled, { css } from "styled-components";
import { brandTokens as brand } from "./tokens";
import { actionTokens as action } from "@styles/tokens/action";
import { baseTokens as base } from "@styles/tokens/base";
import { landingTokens as landing } from "@styles/tokens/landing";

/**
 * Action buttons share one spec across the app. Compose a button from
 * `actionButton` (or the `ActionButton` component), one variant and,
 * for a pill, `pillAction`:
 *
 * - `blueAction`: important actions only (sign in, publish).
 * - `whiteAction`: an ordinary main action on a dark surface.
 * - `outlineAction`: everything else on a dark surface.
 *
 * The legacy families (`NButton`, `RoundButton`) read the same tokens.
 */

/** The action font; also resolves outside a `brandFoundation` root. */
const actionFont = `${action.type.font} var(--oc-font, ${action.type.family})`;

/** Shared geometry for the landing Sign in and Jump In actions. */
export const compactActionSizing = css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: ${landing.action.gap}px;
    min-height: ${landing.action.minHeight}px;
    padding: ${landing.action.paddingY}px ${landing.action.paddingX}px;
    border-radius: ${landing.radius.control}px;
    font: ${actionFont};
    white-space: nowrap;
    @media (max-width: ${base.breakpoint.compact}px) {
        gap: ${landing.action.compactGap}px;
        font-size: ${base.font.size.md}px;
    }
`;

/**
 * The action-button spec itself: type, border width, height and padding.
 * It is the same for a pill and a rounded rectangle, so shape changes the
 * corner radius only. Layout (display, gap) is left to the caller.
 */
export const actionSpec = css`
    box-sizing: border-box;
    min-height: ${action.size.minHeight}px;
    padding: ${action.size.paddingY}px ${action.size.paddingX}px;
    border: ${action.size.borderWidth}px solid transparent;
    border-radius: ${action.radius.rectangle}px;
    font: ${actionFont};
    /* Keep a gradient fill from repeating under the transparent border. */
    background-origin: border-box;
`;

/** Pill shape. Add after `actionSpec` or `actionButton`. */
export const pillAction = css`
    border-radius: ${action.radius.pill}px;
`;

/** A complete action button without its colours: add one variant. */
export const actionButton = css`
    ${compactActionSizing}
    ${actionSpec}
    margin: 0;
    appearance: none;
    cursor: pointer;
    text-decoration: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
`;

const actionStates = css`
    &:focus-visible {
        outline: ${action.state.focusWidth}px solid ${action.state.focusRing};
        outline-offset: ${action.state.focusOffset}px;
    }
    &:disabled,
    &[aria-disabled="true"] {
        opacity: ${action.state.disabledOpacity};
        cursor: not-allowed;
    }
    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }
    @media (forced-colors: active) {
        color: ButtonText;
        background: ButtonFace;
        border-color: ButtonText;
        &:focus-visible {
            outline-color: Highlight;
        }
    }
`;

/** Solid white: an ordinary main action on a dark surface. */
export const whiteAction = css`
    color: ${action.white.ink};
    background: ${action.white.fill};
    border-color: ${action.white.fill};
    transition: background-color 150ms ease, border-color 150ms ease;
    &:hover:not(:disabled) {
        color: ${action.white.ink};
        background: ${action.white.hover};
        border-color: ${action.white.hover};
    }
    &:active:not(:disabled) {
        background: ${action.white.pressed};
        border-color: ${action.white.pressed};
    }
    ${actionStates}
`;

/** Outline: every other action on a dark surface. */
export const outlineAction = css`
    color: ${action.outline.ink};
    background: transparent;
    border-color: ${action.outline.border};
    transition: background-color 150ms ease, border-color 150ms ease;
    &:hover:not(:disabled) {
        color: ${action.outline.ink};
        background: ${action.outline.hoverFill};
        border-color: ${action.outline.hoverBorder};
    }
    &:active:not(:disabled) {
        background: ${action.outline.pressedFill};
    }
    ${actionStates}
`;

/**
 * Blue: important actions only (sign in, publish). Also the Studio
 * play/preview actions, by an earlier explicit choice.
 */
export const blueAction = css`
    color: ${base.color.white};
    background: linear-gradient(
        180deg,
        ${brand.color.actionBlueStart} 0%,
        ${brand.color.actionBlue} 52%,
        ${brand.color.actionBlueEnd} 100%
    );
    box-shadow: ${landing.shadow.action};
    transition: filter 150ms ease, transform 150ms ease;
    &:hover:not(:disabled) {
        color: ${base.color.white};
        background: linear-gradient(
            180deg,
            ${brand.color.actionBlueStart} 0%,
            ${brand.color.actionBlue} 52%,
            ${brand.color.actionBlueEnd} 100%
        );
        filter: brightness(1.06);
    }
    &:active:not(:disabled) {
        filter: brightness(0.96);
        transform: scale(0.98);
    }
    &:focus-visible {
        outline: 2px solid ${brand.color.actionBlue};
        outline-offset: 3px;
    }
    &:disabled {
        opacity: 0.45;
        cursor: not-allowed;
    }
    @media (prefers-reduced-motion: reduce) {
        transition: none;
        &:active:not(:disabled) {
            transform: none;
        }
    }
`;

export type ActionVariant = "blue" | "white" | "outline";
export type ActionShape = "rectangle" | "pill";

const actionVariants = {
    blue: blueAction,
    white: whiteAction,
    outline: outlineAction,
};

/**
 * The shared action button. `$variant` defaults to the outline and `$shape`
 * to the rounded rectangle; `as="a"` gives the same button as a link.
 */
export const ActionButton = styled.button.attrs((props: any) => ({
    type: props.type || (props.as ? undefined : "button"),
}))<{ $variant?: ActionVariant; $shape?: ActionShape }>`
    ${actionButton}
    ${({ $variant }) => actionVariants[$variant || "outline"]}
    ${({ $shape }) => $shape === "pill" && pillAction}
`;

/** The Oncyber Sans and Mono faces. Part of `brandFoundation`. */
export const brandFonts = css`
    @font-face {
        font-family: "Oncyber Sans";
        src: url("${base.font.files.regular}") format("opentype");
        font-weight: 400;
        font-style: normal;
        font-display: swap;
    }
    @font-face {
        font-family: "Oncyber Sans";
        src: url("${base.font.files.medium}") format("opentype");
        font-weight: 500;
        font-style: normal;
        font-display: swap;
    }
    @font-face {
        font-family: "Oncyber Mono";
        src: url("${base.font.files.mono}") format("woff2");
        font-weight: 400;
        font-style: normal;
        font-display: swap;
    }
`;

/** The `--oc-*` variables. Part of `brandFoundation`. */
export const brandVariables = css`
    --oc-font: ${base.font.sans};
    --oc-mono: ${base.font.mono};
    --oc-canvas: ${brand.color.canvas};
    --oc-panel: ${brand.color.panel};
    --oc-surface: ${brand.color.surface};
    --oc-hover: ${brand.color.hover};
    --oc-ink: ${brand.color.ink};
    --oc-secondary: ${brand.color.secondary};
    --oc-muted: ${brand.color.muted};
    --oc-line: ${brand.color.line};
    --oc-line-strong: ${brand.color.lineStrong};
    --oc-paper: ${brand.color.paper};
    --oc-paper-ink: ${brand.color.paperInk};
    --oc-paper-muted: ${brand.color.paperMuted};
    --oc-accent: ${brand.color.accent};
    --oc-accent-create: ${brand.color.createAccent};
    --oc-selection: linear-gradient(
        90deg,
        ${brand.color.selectionStart},
        ${brand.color.selectionEnd}
    );
    --oc-radius-card: ${brand.radius.card}px;
    --oc-radius-control: ${brand.radius.control}px;
    --oc-radius-inset: ${brand.radius.inset}px;
    --oc-fast: ${brand.motion.fast}ms;
    --oc-standard: ${brand.motion.standard}ms;
    --oc-enter: ${brand.motion.enter}ms;
    --oc-ease: ${base.motion.ease};
    --oc-shadow: ${landing.shadow.card};
    @media (max-width: ${base.breakpoint.compact}px) {
        --oc-radius-card: ${brand.radius.compactCard}px;
    }
    @media (prefers-reduced-motion: reduce) {
        --oc-fast: 0ms;
        --oc-standard: 0ms;
        --oc-enter: 0ms;
    }
`;

/**
 * Apply to a surface root; this deliberately does not restyle other routes.
 * A surface that holds other people's content (the shared dialog) takes
 * `brandFonts` and `brandVariables` only, so it does not change the font
 * that content inherits.
 */
export const brandFoundation = css`
    ${brandFonts}
    ${brandVariables}
    font: 400 14px/1.5 var(--oc-font);
    font-synthesis: none;
    font-kerning: normal;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
`;
