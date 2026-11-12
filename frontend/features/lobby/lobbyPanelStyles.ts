import { css } from "styled-components";
import { baseTokens as base, lobbyTokens as lobby } from "@styles/tokens";
import { promptGlass } from "@ui/components/PromptGlass";

/** One visual family for panels opened from the experience dock. */
export const lobbyPanelTokens = css`
    --lobby-panel-width: ${lobby.panel.width}px;
    --lobby-panel-compact-width: ${lobby.panel.compactWidth}px;
    --lobby-panel-gap: ${lobby.panel.gap}px;
    --lobby-panel-perspective: ${lobby.panel.perspective}px;
    color: ${lobby.color.ink};
    font-family: var(--oc-font, sans-serif);
`;

export const lobbyPanelHeading = css`
    display: flex;
    align-items: center;
    flex-shrink: 0;
    min-height: 32px;
    gap: 12px;
    padding: 0 16px;
    pointer-events: auto;
    text-shadow: 0 1px 6px #000;
    h2 {
        margin: 0;
        min-width: 0;
        font-size: 12px;
        font-weight: 500;
        line-height: 20px;
    }
`;

export const lobbyPanelIconButton = css`
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: ${lobby.panel.iconRadius}px;
    background: transparent;
    color: ${lobby.color.secondary};
    cursor: pointer;
    &:hover:not(:disabled) {
        background: ${base.color.line.faint};
    }
    &:focus-visible {
        outline: 2px solid var(--oc-accent, #2567ff);
        outline-offset: 2px;
    }
    &:disabled {
        opacity: 0.35;
        cursor: default;
    }
`;

export const lobbyPanelSurface = css`
    ${promptGlass}
    --prompt-glass-blur: ${lobby.glass.panelBlur}px;
    position: relative;
    box-sizing: border-box;
    border: 1px solid ${lobby.panel.border};
    border-radius: ${lobby.panel.radius}px;
    /* The real border above is the only edge. */
    box-shadow: ${lobby.glass.shadow};
`;

export const lobbyPanelCard = css`
    ${lobbyPanelSurface}
    box-shadow: none;
    text-shadow: none;
    &::before,
    &::after {
        display: none;
    }
    min-width: 0;
    border-radius: ${lobby.panel.cardRadius}px;
    transition: border-color ${base.motion.fast}ms ease;
    &:hover,
    &:focus-visible {
        border-color: ${lobby.panel.cardHover};
    }
    &:focus-visible {
        outline: 2px solid var(--oc-accent, #2567ff);
        outline-offset: 2px;
    }
    &[aria-selected="true"] {
        border-color: ${lobby.panel.cardSelected};
    }
    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }
`;

export const lobbyPanelFooter = css`
    ${lobbyPanelSurface}
    display: flex;
    align-items: center;
    align-self: center;
    flex-shrink: 0;
    gap: 4px;
    width: min(
        var(--lobby-panel-compact-width, ${lobby.panel.compactWidth}px),
        100%
    );
    height: var(--lobby-dock-height, ${lobby.panel.dockHeight}px);
    padding: 3px 6px;
    border-radius: ${lobby.panel.cardRadius}px;
    pointer-events: auto;

    /*
     * Every bottom bar reads the same way: close on the left, one status line,
     * then text actions on the right.
     */
    .panel-close {
        ${lobbyPanelIconButton}
    }
    .panel-status {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        min-width: 0;
        padding-left: 2px;
        color: ${lobby.color.secondary};
        font-size: 12px;
        white-space: nowrap;
    }
    .panel-status > span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .panel-status strong {
        color: ${lobby.color.ink};
        font-weight: 500;
    }
    .panel-spinner {
        flex-shrink: 0;
        width: 12px;
        height: 12px;
        border: 1.5px solid ${base.color.line.strong};
        border-top-color: ${lobby.color.ink};
        border-radius: 50%;
        animation: lobby-panel-spin 0.8s linear infinite;
    }
    @keyframes lobby-panel-spin {
        to {
            transform: rotate(360deg);
        }
    }
    .panel-action {
        flex-shrink: 0;
        height: 32px;
        padding: 0 10px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: ${lobby.color.ink};
        font: inherit;
        font-size: 12px;
        cursor: pointer;
    }
    .panel-action:hover {
        background: ${base.color.line.faint};
    }
    .panel-action[aria-pressed="true"] {
        background: ${base.color.line.subtle};
    }
    .panel-action:focus-visible {
        outline: 2px solid var(--oc-accent, #2567ff);
        outline-offset: 2px;
    }
    @media (prefers-reduced-motion: reduce) {
        .panel-spinner {
            animation-duration: 2.4s;
        }
    }
`;

/** Phone dock panels share safe gutters, a bounded body and the same baseline. */
export const mobileDockPanelLayout = css`
    position: fixed;
    left: max(16px, env(safe-area-inset-left));
    right: max(16px, env(safe-area-inset-right));
    top: auto;
    bottom: max(80px, calc(env(safe-area-inset-bottom) + 68px));
    width: auto;
    max-width: none;
    max-height: min(
        60svh,
        calc(
            100dvh - max(80px, env(safe-area-inset-bottom) + 68px) -
                max(80px, env(safe-area-inset-top) + 64px)
        )
    );
    border-radius: 16px;
    transform: none;
`;

export const mobileDockPanelMotion = css`
    animation: mobile-dock-panel-enter 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
    @keyframes mobile-dock-panel-enter {
        from {
            opacity: 0;
            translate: 0 10px;
        }
        to {
            opacity: 1;
            translate: 0 0;
        }
    }
    @media (prefers-reduced-motion: reduce) {
        animation: none;
    }
`;
