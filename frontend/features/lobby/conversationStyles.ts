import { css } from "styled-components";
import { brandTokens } from "@styles/brand/tokens";
import { baseTokens as base, lobbyTokens as lobby } from "@styles/tokens";
import { CHAT_VIEW_MOTION } from "./useChatViewTransition";

/** Shared conversation presentation for the lobby and native galleries. Placement stays with the host. */
export const conversationStyles = css`
    .group-notices {
        display: flex;
        flex-direction: column;
        gap: 7px;
        max-height: 38vh;
        overflow-y: auto;
        scrollbar-width: thin;
    }
    .group-notices:empty {
        display: none;
    }
    .group-notice {
        padding: 12px;
        border: 1px solid #ffffff0c;
        border-radius: 13px;
        background: #15181eed;
        margin: 0 0 5px;
        font-size: 12px;
        line-height: 1.5;
        text-shadow: none;
    }
    .group-notice > small {
        color: #9ba4b2;
        font-size: 9px;
        letter-spacing: 0.8px;
    }
    .group-notice p {
        margin: 7px 0 10px;
        color: #ced3dc;
    }
    .group-notice strong {
        font-weight: 500;
        color: #f0f1f5;
    }
    .group-notice > div {
        display: flex;
        align-items: center;
        gap: 7px;
    }
    .group-notice button {
        font: inherit;
        font-size: 11px;
        border: 0;
        border-radius: 8px;
        color: #a4adbb;
        background: transparent;
        padding: 6px 9px;
        cursor: pointer;
    }
    .group-notice button:hover {
        background: #ffffff10;
        color: #fff;
    }
    .group-notice button.notice-primary {
        color: #e9edf5;
        background: #ffffff12;
    }
    .group-notice button:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .voice-request-notice p {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .voice-request-notice img {
        width: 24px;
        height: 24px;
        flex-shrink: 0;
        border-radius: 50%;
        object-fit: cover;
    }
    .group-notice button.notice-more {
        margin-left: auto;
    }
    .group-notice .notice-status {
        font-size: 10px;
        color: #9da6b5;
        margin: 4px 0 8px;
    }
    /* History floats over the world; only the composer owns a glass frame. */
    .lobby-chat {
        box-sizing: border-box;
        min-width: 0;
        background: transparent;
    }
    .chat-view-viewport {
        width: 100%;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    .chat-view {
        position: relative;
        isolation: isolate;
        min-height: 0;
        padding-bottom: 8px;
        display: flex;
        flex-direction: column;
        transform-origin: bottom left;
        opacity: 1;
        transform: translateY(0) scale(1);
        transition: opacity ${CHAT_VIEW_MOTION.enter}ms ${base.motion.ease},
            transform ${CHAT_VIEW_MOTION.enter}ms ${base.motion.ease};
    }
    .chat-view:empty {
        padding-bottom: 0;
    }
    /* A faint wash behind the lines above the input, so they read over
       bright worlds. It fades with the view and has no visible edge. */
    .chat-view:not(:empty)::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: -1;
        pointer-events: none;
        background: ${lobby.chat.scrim};
        -webkit-mask-image: ${lobby.chat.scrimMask};
        mask-image: ${lobby.chat.scrimMask};
    }
    .chat-view > .group-notices:not(:empty),
    .chat-view > .native-chat-notice {
        padding: 8px 8px 0;
    }
    .chat-view .group-notice {
        border-color: ${base.color.line.subtle};
        background: #ffffff08;
    }
    .lobby-chat[data-view-phase="exiting"] .chat-view,
    .lobby-chat[data-view-phase="paused"] .chat-view {
        opacity: 0;
        transform: translateY(10px) scale(0.99);
        transition-duration: ${CHAT_VIEW_MOTION.exit}ms;
        transition-timing-function: cubic-bezier(0.4, 0, 1, 1);
    }
    .lobby-chat[data-view-phase="paused"] .chat-view {
        transition: none;
    }
    .lobby-chat[data-view-phase="exiting"] *,
    .lobby-chat[data-view-phase="paused"] * {
        pointer-events: none;
    }

    /* Conversation header (DM or group). */
    .chat-group-heading,
    .chat-thread-heading {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        padding: 7px 6px 7px 10px;
        text-shadow: ${lobby.chat.textShadow};
        font-size: ${base.font.size.sm}px;
        color: ${lobby.color.chatInk};
    }
    .chat-group-heading {
        gap: 2px;
        padding-left: 4px;
    }
    .chat-group-heading button {
        color: ${lobby.color.chatInk};
        border: 0;
        background: transparent;
        border-radius: 8px;
        padding: 5px 6px;
        display: flex;
        gap: 8px;
        align-items: center;
        cursor: pointer;
        font: inherit;
        font-size: ${base.font.size.sm}px;
    }
    .chat-group-heading button:hover:not(:disabled) {
        background: #ffffff10;
    }
    .chat-group-heading button:first-child {
        flex: 1;
        min-width: 0;
    }
    .chat-group-heading button span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .chat-group-heading small,
    .chat-thread-heading small {
        color: ${lobby.color.meta};
        white-space: nowrap;
        font-size: ${base.font.size.micro}px;
    }
    .chat-group-heading small {
        margin-left: auto;
    }
    .chat-thread-heading small {
        margin-right: auto;
    }
    .chat-group-heading .lobby-dock-icon {
        width: 16px;
        height: 16px;
    }
    .chat-thread-name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: ${base.font.weight.medium};
    }
    .chat-group-heading .chat-thread-close,
    .chat-thread-close {
        display: grid;
        place-items: center;
        width: 26px;
        height: 26px;
        flex: 0 0 26px;
        padding: 0;
        border: 0;
        border-radius: 7px;
        color: #a8adb7;
        background: transparent;
    }
    .chat-thread-close:hover,
    .chat-thread-close:focus-visible {
        outline: none;
        color: #fff;
        background: #ffffff14;
    }

    /* Messages. */
    .chat-log {
        overflow-y: auto;
        padding: 8px 6px;
        margin: 0;
        max-height: calc(50vh - 56px);
        background: transparent;
        text-shadow: ${lobby.chat.textShadow};
        overscroll-behavior: contain;
        scrollbar-width: thin;
        scrollbar-color: #ffffff24 transparent;
        overflow-anchor: none;
    }
    /* The closed chat keeps its latest lines in view; a click opens it. */
    .chat-feed {
        overflow: hidden;
        cursor: pointer;
        padding-bottom: 2px;
    }
    .chat-message {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 3px 4px;
        border-radius: 6px;
        font-size: ${base.font.size.sm}px;
        line-height: 1.5;
    }
    .chat-avatar {
        text-shadow: none;
        position: relative;
        width: 18px;
        height: 18px;
        flex: 0 0 18px;
        display: grid;
        place-items: center;
        overflow: hidden;
        background: #ffffff14;
        border-radius: 50%;
        color: #a3a8b1;
        font-size: ${base.font.size.micro}px;
    }
    .chat-avatar img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .chat-line {
        min-width: 0;
        margin: 0;
        overflow-wrap: anywhere;
    }
    .chat-name {
        color: #c2cef0;
        font-weight: ${base.font.weight.medium};
    }
    .chat-name[data-own] {
        color: #b0b5bf;
    }
    .chat-separator {
        color: ${lobby.color.meta};
    }
    .chat-text {
        color: ${lobby.color.controlInk};
        white-space: pre-wrap;
    }
    .chat-empty {
        text-shadow: none;
        margin: 4px;
        font-size: ${base.font.size.xs}px;
        line-height: 1.5;
        color: ${lobby.color.meta};
    }

    /* Input row: switcher on the left, then the text field. */
    .chat-composer {
        box-sizing: border-box;
        width: 100%;
        height: 40px;
        display: flex;
        align-items: center;
        flex-shrink: 0;
        gap: 2px;
        padding: 4px;
        border: 1px solid ${lobby.control.border};
        border-radius: ${base.radius.control}px;
        color: ${lobby.color.controlInk};
        background: ${lobby.control.background};
        -webkit-backdrop-filter: blur(${lobby.glass.blur}px);
        backdrop-filter: blur(${lobby.glass.blur}px);
        box-shadow: ${lobby.glass.shadow};
        transition: border-color ${base.motion.standard}ms ease,
            background ${base.motion.standard}ms ease;
    }
    .chat-composer:hover,
    .chat-composer:focus-within {
        border-color: ${lobby.control.hoverBorder};
    }
    .chat-composer:focus-within {
        background: #14161bed;
    }
    .chat-composer [hidden] {
        display: none;
    }
    .chat-input-bar {
        min-width: 0;
        height: 100%;
        flex: 1;
        display: flex;
        align-items: center;
        padding: 0 4px 0 6px;
        color: ${lobby.color.controlInk};
    }
    .chat-input-bar input {
        min-width: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        color: #fff;
        border: 0;
        outline: none;
        background: transparent;
        font: ${base.font.size.md}px / 20px var(--oc-font);
    }
    .chat-input-bar input::placeholder {
        color: ${lobby.color.meta};
    }
    .chat-search-glyph {
        display: grid;
        place-items: center;
        margin-right: 7px;
        color: ${lobby.color.meta};
    }
    .chat-switcher {
        position: relative;
        display: flex;
        align-items: center;
        gap: 3px;
        height: 100%;
        flex: 0 0 auto;
        padding: 0 5px 0 7px;
        border: 0;
        border-radius: 9px;
        color: ${lobby.color.controlInk};
        background: transparent;
        transition: background ${base.motion.fast}ms ease;
    }
    .chat-switcher:not(:disabled):hover,
    .chat-switcher:focus-visible {
        outline: none;
        background: #ffffff12;
    }
    .chat-switcher[aria-pressed="true"] {
        background: #ffffff1c;
    }
    .chat-switcher:disabled {
        cursor: default;
        padding-right: 7px;
    }
    .chat-input-glyph {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        display: grid;
        place-items: center;
        color: #c2c5cc;
    }
    .chat-input-glyph .lobby-dock-icon {
        width: 18px;
        height: 18px;
    }
    .chat-switcher-caret {
        display: grid;
        place-items: center;
        color: ${lobby.color.meta};
        /* Points up: the list opens above the input. */
        transform: rotate(180deg);
        transition: transform ${base.motion.fast}ms ease;
    }
    .chat-switcher[aria-pressed="true"] .chat-switcher-caret {
        transform: none;
    }
    .chat-shortcut {
        flex-shrink: 0;
        margin-right: 4px;
        padding: 2px 5px;
        border: 1px solid ${base.color.line.default};
        border-radius: 5px;
        color: ${lobby.color.meta};
        font: ${base.font.size.micro}px / 14px var(--oc-font);
        opacity: 0;
        transition: opacity ${base.motion.fast}ms ease;
        pointer-events: none;
    }
    .chat-composer:focus-within .chat-shortcut {
        opacity: 1;
    }
    .chat-create-group {
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        flex: 0 0 30px;
        padding: 0;
        border: 0;
        border-radius: 8px;
        color: #a8adb7;
        background: transparent;
    }
    .chat-create-group:hover,
    .chat-create-group:focus-visible {
        outline: none;
        color: #fff;
        background: #ffffff14;
    }
    .chat-send {
        border: 0;
        color: #14161b;
        background: ${lobby.color.controlInk};
        width: 28px;
        height: 28px;
        flex-shrink: 0;
        display: grid;
        place-items: center;
        padding: 0;
        border-radius: 8px;
        transition: background ${base.motion.fast}ms ease;
    }
    .chat-send:hover:not(:disabled),
    .chat-send:focus-visible {
        outline: none;
        background: #fff;
    }
    .chat-send:disabled {
        opacity: 0.4;
    }

    /* Chat list (opened from the switcher). */
    .chat-picker {
        width: 100%;
        min-width: 0;
        padding: 8px 4px 6px;
        box-sizing: border-box;
        border: 1px solid ${lobby.control.border};
        border-radius: 14px;
        background: ${lobby.control.background};
        -webkit-backdrop-filter: blur(${lobby.glass.blur}px);
        backdrop-filter: blur(${lobby.glass.blur}px);
    }
    .chat-picker-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 0 8px 6px;
        font-size: ${base.font.size.xs}px;
        color: ${lobby.color.meta};
    }
    .chat-picker-heading > span:first-child {
        color: ${lobby.color.tooltipInk};
        font-weight: ${base.font.weight.medium};
    }
    .chat-picker-heading > span + span {
        font-variant-numeric: tabular-nums;
    }
    .chat-contact-strip {
        min-width: 0;
        display: flex;
    }
    .chat-contacts {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 1px;
        max-height: min(280px, 36vh);
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        scrollbar-color: #ffffff24 transparent;
    }
    .chat-contact {
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 0 0 auto;
        width: 100%;
        min-height: 42px;
        padding: 6px 8px;
        border: 1px solid transparent;
        border-radius: 10px;
        background: transparent;
        font: ${base.font.size.sm}px var(--oc-font);
        color: ${lobby.color.tooltipInk};
        text-align: left;
    }
    .chat-contact:hover {
        background: #ffffff0c;
        color: #fff;
    }
    .chat-contact[aria-pressed="true"] {
        background: #ffffff14;
        color: #fff;
    }
    .chat-contact:focus-visible,
    .chat-contact[data-preview="true"] {
        outline: none;
        border-color: ${base.color.line.soft};
        background: #ffffff14;
        color: #fff;
    }
    .chat-contact > .chat-avatar,
    .contact-symbol {
        width: 28px;
        height: 28px;
        flex: 0 0 28px;
        font-size: ${base.font.size.xs}px;
    }
    .contact-symbol {
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: #ffffff10;
        color: #d4d7de;
    }
    .contact-symbol .lobby-dock-icon {
        width: 16px;
        height: 16px;
    }
    .contact-body {
        min-width: 0;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 1px;
    }
    .contact-name,
    .contact-last {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
    .contact-name {
        color: inherit;
        font-weight: ${base.font.weight.medium};
    }
    .contact-last {
        color: ${lobby.color.meta};
        font-size: ${base.font.size.xs}px;
    }
    .contact-away {
        flex-shrink: 0;
        padding: 1px 6px;
        border-radius: 999px;
        background: #ffffff10;
        color: ${lobby.color.meta};
        font-size: ${base.font.size.micro}px;
    }
    .contact-unread {
        width: 7px;
        height: 7px;
        flex: 0 0 7px;
        border-radius: 50%;
        background: ${brandTokens.color.actionBlue};
    }
    .chat-unread-dot {
        position: absolute;
        top: 4px;
        left: 20px;
        width: 7px;
        height: 7px;
        border: 2px solid #14161b;
        border-radius: 50%;
        background: ${brandTokens.color.actionBlue};
        box-sizing: content-box;
        pointer-events: none;
    }
    .chat-unread-label {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
    }
    .send-error {
        margin: 0;
        padding: 6px 10px 8px;
        border-top: 1px solid ${base.color.line.subtle};
        color: #e6c9cd;
        font-size: ${base.font.size.xs}px;
    }

    @media (max-width: 680px) {
        .chat-log {
            max-height: 32vh;
        }
        .chat-composer {
            height: ${lobby.control.touchSize}px;
            gap: 4px;
            padding: 0 4px;
        }
        .chat-switcher {
            min-width: 36px;
            justify-content: center;
            padding: 0 6px;
        }
        .chat-input-bar {
            padding: 0 8px;
            gap: 8px;
        }
        .chat-input-bar input::placeholder {
            font-size: ${base.font.size.body}px;
        }
        .chat-shortcut {
            display: none;
        }
        .chat-send {
            width: 36px;
            height: 36px;
            border-radius: 10px;
        }
        .chat-message {
            font-size: ${base.font.size.md}px;
        }
        .chat-contact {
            min-height: 46px;
        }
        .chat-input-bar input {
            /* Keep iOS from zooming the viewport when the keyboard opens. */
            font-size: 16px;
            line-height: 20px;
        }
    }
    @media (prefers-reduced-motion: reduce) {
        .lobby-chat[data-view-phase] .chat-view {
            opacity: 1;
            transform: none;
            transition: none;
        }
        .chat-composer,
        .chat-switcher,
        .chat-switcher-caret,
        .chat-send,
        .chat-shortcut {
            transition: none;
        }
    }
`;
