import { css } from "styled-components";
import { baseTokens as base, lobbyTokens as lobby } from "@styles/tokens";
import { experienceControl } from "@features/content-host/experienceChrome";

/** Shared dock controls and hover labels. Placement stays with the host. */
export const lobbyDockStyles = css`
    .dock-item {
        position: relative;
        display: flex;
    }
    .dock-item > span {
        position: absolute;
        bottom: calc(100% + 10px);
        left: 50%;
        transform: translateX(-50%);
        padding: 6px 10px;
        border: 1px solid ${lobby.control.border};
        border-radius: ${base.radius.inset}px;
        background: ${lobby.control.tooltip};
        color: ${lobby.color.tooltipInk};
        font-size: ${base.font.size.sm}px;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        visibility: hidden;
        transition: opacity ${base.motion.fast}ms ease;
    }
    /* Show on hover or keyboard focus only (a clicked button keeps focus, so
       :focus-within left labels stuck), and fade out after a few seconds. */
    .dock-item:hover > span,
    .dock-item:has(:focus-visible) > span {
        animation: dock-tooltip-life 2.6s ease forwards;
    }
    @keyframes dock-tooltip-life {
        0% {
            opacity: 0;
            visibility: visible;
        }
        6%,
        88% {
            opacity: 1;
            visibility: visible;
        }
        100% {
            opacity: 0;
            visibility: hidden;
        }
    }
    .dock-item:has([aria-expanded="true"]) > span {
        animation: none;
        opacity: 0;
        visibility: hidden;
    }
    .dock-button {
        ${experienceControl}
        padding: 0;
    }
    .dock-button .lobby-dock-icon {
        width: 22px;
        height: 22px;
        display: block;
        flex-shrink: 0;
        background: currentColor;
        -webkit-mask-size: contain;
        mask-size: contain;
        -webkit-mask-position: center;
        mask-position: center;
        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;
        mask-mode: alpha;
        opacity: 0.9;
        transition: opacity ${base.motion.fast}ms ease;
    }
    .dock-button:hover:not(:disabled) {
        background: ${lobby.control.hover};
        border-color: ${lobby.control.hoverBorder};
    }
    .dock-button[aria-pressed="true"],
    .dock-button[aria-expanded="true"] {
        background: ${lobby.control.dockPressed};
        border-color: ${lobby.control.dockPressedBorder};
        box-shadow: inset 0 1px 0 #ffffff08;
    }
    .dock-button[aria-pressed="true"] .lobby-dock-icon,
    .dock-button[aria-expanded="true"] .lobby-dock-icon,
    .dock-button:hover:not(:disabled) .lobby-dock-icon {
        opacity: 1;
    }
    @media (max-width: ${base.breakpoint.phone}px) {
        .dock-item > span {
            display: none;
        }
    }
    @media (prefers-reduced-motion: reduce) {
        .dock-button,
        .dock-item > span,
        .lobby-dock-icon {
            transition: none;
        }
    }
`;
