import { css } from "styled-components";
import { baseTokens as base, lobbyTokens as lobby } from "@styles/tokens";

/** Only collapse actions while chat and controls share the tablet row. */
export const nativeCompactControlsQuery =
    "(min-width: 681px) and (max-width: 1100px)";

export const nativePhoneControlsQuery = "(max-width: 680px)";

/** Align the phone composer and toolbar with the same safe-area gutters. */
export const nativePhoneRow = css`
    left: max(16px, env(safe-area-inset-left));
    right: max(16px, env(safe-area-inset-right));
    width: auto;
    max-width: none;
`;

/** Native chat shares the dock baseline, including the inline phone composer. */
export const nativeChatPlacement = css`
    position: fixed;
    left: max(24px, env(safe-area-inset-left));
    bottom: max(20px, calc(env(safe-area-inset-bottom) + 8px));
    width: 340px;
    max-width: calc(50vw - 180px);
    z-index: 10000;
    @media ${nativeCompactControlsQuery} {
        max-width: calc(
            100vw - max(24px, env(safe-area-inset-left)) -
                max(24px, env(safe-area-inset-right)) - 208px
        );
    }
    @media (max-width: 680px) {
        ${nativePhoneRow}
        bottom: max(20px, calc(env(safe-area-inset-bottom) + 8px));
    }
`;

/** The shared lobby and every visitor runtime use the same control material. */
export const experienceControl = css`
    width: ${lobby.control.size}px;
    height: ${lobby.control.size}px;
    display: grid;
    place-items: center;
    color: ${lobby.color.controlInk};
    border: 1px solid ${lobby.control.border};
    border-radius: ${lobby.control.radius}px;
    background: ${lobby.control.background};
    transition: background ${base.motion.standard}ms ease,
        border-color ${base.motion.standard}ms ease;
    cursor: pointer;
    flex-shrink: 0;
    &:hover:not(:disabled) {
        background: ${lobby.control.hover};
    }
    &:focus-visible {
        outline: ${base.focus.width}px solid ${lobby.color.controlInk};
        outline-offset: ${base.focus.offsetLoose}px;
    }
    &[aria-pressed="true"],
    &[aria-expanded="true"] {
        background: ${lobby.control.pressed};
        border-color: ${lobby.control.pressedBorder};
    }
    &:disabled {
        opacity: 0.42;
        cursor: default;
    }
    @media (max-width: 680px) {
        width: ${lobby.control.touchSize}px;
        height: ${lobby.control.touchSize}px;
    }
    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }
`;
