import { css } from "styled-components";
import { baseTokens as base } from "@styles/tokens";

/**
 * The solid sidebar: one material for every panel that slides in from an
 * edge of the screen (a profile on the left; the account and a purchase on
 * the right). It is the landing and studio panel, not lobby glass: a
 * sidebar holds things to read and decide, so it does not show the scene
 * through itself.
 *
 * These are the pieces; each sidebar puts them under its own class names
 * and keeps only what is its own (its width, its rows of content). They
 * read the `--oc-*` variables, so the element they are used in mounts
 * `brandFoundation`.
 */
const sidebar = base.sidebar;

/** The panel itself. `side` is the edge it sits on. */
export const sidebarPanel = (side: "left" | "right") => css`
    width: ${sidebar.width}px;
    max-width: 100%;
    min-height: 0;
    border: 1px solid var(--oc-line-strong);
    border-radius: ${base.radius.panel}px;
    background: var(--oc-panel);
    box-shadow: ${side === "left" ? "" : "-"}${sidebar.shadowReach}px ${sidebar.shadow};
    overflow: hidden;
`;

/** Title on the left, close button on the right. */
export const sidebarHeader = css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 20px 12px 24px;
`;

export const sidebarTitle = css`
    margin: 0;
    font-size: 18px;
    font-weight: 500;
    line-height: 1.4;
`;

export const sidebarClose = css`
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    border: 1px solid var(--oc-line);
    border-radius: var(--oc-radius-control);
    background: transparent;
    color: var(--oc-secondary);
    &:hover {
        background: var(--oc-hover);
        color: var(--oc-ink);
    }
`;

/** The part that scrolls, under the header. */
export const sidebarScroll = css`
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 4px 24px 24px;
    scrollbar-width: thin;
    scrollbar-color: var(--oc-line-strong) transparent;
`;

/** A small label over a group: mono, upper case. */
export const sidebarEyebrow = css`
    margin: 0 0 10px;
    font: 400 10px/1.5 var(--oc-mono);
    color: var(--oc-muted);
    letter-spacing: 0.04em;
    text-transform: uppercase;
`;

/** A row that goes somewhere: an icon, a name with a line under it, an arrow. */
export const sidebarRow = css`
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    min-height: 68px;
    padding: 12px;
    margin: 2px 0;
    border: 1px solid transparent;
    border-radius: var(--oc-radius-control);
    background: transparent;
    color: var(--oc-secondary);
    text-align: left;
    transition: background var(--oc-fast), color var(--oc-fast);
    > svg {
        flex-shrink: 0;
    }
    > span {
        flex: 1;
        min-width: 0;
    }
    strong {
        display: block;
        font-size: 14px;
        line-height: 1.5;
        font-weight: 500;
        color: var(--oc-ink);
    }
    small {
        display: block;
        margin-top: 2px;
        font-size: 12px;
        line-height: 1.5;
        color: var(--oc-muted);
    }
    &:hover:not(:disabled),
    &:focus-visible {
        background: var(--oc-surface);
        color: var(--oc-ink);
    }
`;

/** A boxed group inside a sidebar: the wallet, a purchase's price. */
export const sidebarCard = css`
    padding: 16px;
    border: 1px solid var(--oc-line);
    border-radius: var(--oc-radius-control);
    background: var(--oc-surface);
`;

/** On a phone a sidebar is the whole screen. */
export const sidebarPhonePanel = css`
    width: 100%;
    border: 0;
    border-radius: 0;
`;
export const sidebarPhoneClose = css`
    width: 44px;
    height: 44px;
`;
