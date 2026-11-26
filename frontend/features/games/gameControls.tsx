/**
 * The controls and surfaces the page puts around and over a game, built on
 * the design system (docs/brand/README.md, docs/brand/tokens.md):
 *
 *   - Over the game itself it is the lobby's set, as for any interface over
 *     a 3D scene: the lobby's glass (`promptGlass`) for a bar or a panel,
 *     and the lobby's control material (`experienceControl`: rest, hover,
 *     pressed, disabled, a focus ring) for what is pressed.
 *   - In a card or a dialog that covers play, and on the screens that stand
 *     in for a game, actions are the shared `ActionButton`: white for the
 *     main one, the outline for the rest.
 *
 * Every state a visitor can reach is styled here, once: no control in the
 * games interface writes its own colours, removes its outline or leaves a
 * browser's default look. Where things sit on the page is still each
 * component's own (and the safe area's: safeArea.ts).
 */
import styled, { css } from "styled-components";
import { ActionButton } from "@styles/brand";
import { experienceControl } from "@features/content-host/experienceChrome";
import { promptGlass } from "@ui/components/PromptGlass";
import {
    actionTokens as action,
    baseTokens as base,
    lobbyTokens as lobby,
} from "@styles/tokens";

export { ActionButton };

/** The focus ring of the lobby's controls, for what is not one of them. */
const focusRing = css`
    &:focus-visible {
        outline: ${base.focus.width}px solid ${lobby.color.controlInk};
        outline-offset: ${base.focus.offsetLoose}px;
    }
    @media (forced-colors: active) {
        &:focus-visible {
            outline-color: Highlight;
        }
    }
`;

/** The type of every control and label here: the action spec's. */
const controlType = css`
    font: ${action.type.font} ${action.type.family};
`;

/**
 * A bar or a panel floating over the game: the lobby's glass. Position and
 * size are the component's own.
 */
export const GameGlass = styled.div`
    ${promptGlass}
    ${controlType}
    color: ${lobby.color.controlInk};
`;

/**
 * A control over the game that says a word ("Mic off", "Lobby", "Chat"):
 * the lobby's control, as wide as its label. `aria-pressed` and
 * `aria-expanded` show as pressed, as on every lobby control.
 */
export const GameControl = styled.button.attrs((props: any) => ({
    type: props.type || "button",
}))`
    ${experienceControl}
    ${controlType}
    width: auto;
    margin: 0;
    padding: 0 ${action.size.paddingX}px;
    border-radius: ${action.radius.pill}px;
    white-space: nowrap;
    appearance: none;
    -webkit-tap-highlight-color: transparent;
    @media (max-width: 680px) {
        width: auto;
    }
    @media (forced-colors: active) {
        border-color: ButtonText;
        &:focus-visible {
            outline-color: Highlight;
        }
    }
`;

/** The same control, small: a label in a corner that opens something. */
export const GameChip = styled(GameControl)`
    height: 28px;
    padding: 0 10px;
    color: ${lobby.color.meta};
    font-size: ${base.font.size.xs}px;
    &:hover:not(:disabled),
    &[aria-expanded="true"] {
        color: ${lobby.color.controlInk};
    }
    @media (max-width: 680px) {
        height: 28px;
    }
`;

/** The same control with a mark instead of a word: dismissing a card. */
export const GameMark = styled(GameControl)`
    width: 28px;
    height: 28px;
    padding: 0;
    line-height: 1;
    @media (max-width: 680px) {
        width: 28px;
        height: 28px;
    }
`;

/** A line of text to type, on the same material as the controls. */
export const GameField = styled.input`
    box-sizing: border-box;
    flex: 1;
    min-width: 0;
    height: ${lobby.control.size}px;
    margin: 0;
    padding: 0 14px;
    color: ${lobby.color.controlInk};
    border: 1px solid ${lobby.control.border};
    border-radius: ${action.radius.pill}px;
    background: ${lobby.control.background};
    ${controlType}
    appearance: none;
    transition: background ${base.motion.standard}ms ease,
        border-color ${base.motion.standard}ms ease;
    &::placeholder {
        color: ${lobby.color.meta};
        opacity: 1;
    }
    &:hover:not(:disabled) {
        border-color: ${lobby.control.hoverBorder};
    }
    &:focus,
    &:focus-visible {
        background: ${lobby.control.hover};
        border-color: ${lobby.control.pressedBorder};
    }
    ${focusRing}
    &:disabled {
        opacity: 0.42;
        cursor: default;
    }
    @media (max-width: 680px) {
        height: ${lobby.control.touchSize}px;
    }
    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }
    @media (forced-colors: active) {
        border-color: FieldText;
    }
`;

/** The wash over a game behind a dialog or a menu. */
export const GameScrim = styled.div`
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 16px;
    color: ${base.color.ink};
    background: ${lobby.glass.tint};
    ${controlType}
    @media (prefers-reduced-transparency: reduce) {
        background: ${lobby.glass.fallback};
    }
    @media (forced-colors: active) {
        background: Canvas;
        color: CanvasText;
    }
`;

/** A dialog over a game: dark, solid, the system's panel corner. */
export const GameDialog = styled.section`
    box-sizing: border-box;
    width: min(560px, 100%);
    max-height: min(80vh, 640px);
    overflow-y: auto;
    padding: 24px;
    color: ${base.color.ink};
    border: 1px solid ${base.color.line.default};
    border-radius: ${base.radius.panel}px;
    background: ${lobby.glass.fallback};
    box-shadow: ${lobby.glass.shadow};
    font: ${base.font.weight.regular} ${base.font.size.md}px / 1.5
        ${action.type.family};
    @media (max-width: ${base.breakpoint.phone}px) {
        padding: 20px;
        border-radius: ${base.radius.card}px;
    }
    @media (forced-colors: active) {
        border-color: CanvasText;
    }
`;

/** A link in running text. */
export const GameLink = styled.a`
    color: ${base.color.ink};
    border-radius: 2px;
    text-decoration: underline;
    text-decoration-color: ${base.color.line.hover};
    text-underline-offset: 3px;
    transition: text-decoration-color ${base.motion.standard}ms ease;
    &:hover {
        color: ${base.color.white};
        text-decoration-color: ${base.color.white};
    }
    &:active {
        color: ${base.color.secondary};
    }
    ${focusRing}
    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }
    @media (forced-colors: active) {
        color: LinkText;
    }
`;

/**
 * A screen that stands in for a game: paused, wrong device, could not load.
 * The backdrop a game has until it draws, and the brand's type.
 */
export const GameNotice = styled.div`
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 18px;
    padding: 24px;
    text-align: center;
    color: ${base.color.ink};
    background: ${base.color.frame};
    font: ${base.font.weight.regular} ${base.font.size.body}px / 1.5
        ${action.type.family};
    @media (forced-colors: active) {
        background: Canvas;
        color: CanvasText;
    }
`;

/**
 * Up and Down (and Home, End) move between the actions of a menu, as the
 * brand guide asks of menus. Put it on the element that holds them.
 */
export function moveMenuFocus(event: {
    key: string;
    currentTarget: Element;
    preventDefault(): void;
}) {
    const step =
        event.key === "ArrowDown"
            ? 1
            : event.key === "ArrowUp"
            ? -1
            : event.key === "Home" || event.key === "End"
            ? 0
            : null;
    if (step === null) return;
    const items = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>(
            "button:not(:disabled), a[href]"
        )
    );
    if (!items.length) return;
    event.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next =
        event.key === "Home"
            ? 0
            : event.key === "End"
            ? items.length - 1
            : (at + step + items.length) % items.length;
    items[next].focus();
}
