import styled from "styled-components";
import { conversationStyles } from "./conversationStyles";

/** Shared conversation placement for the lobby and visiting game worlds. */
const LobbyConversationSurface = styled.div`
    position: absolute;
    z-index: 21;
    left: 24px;
    bottom: max(20px, calc(env(safe-area-inset-bottom) + 8px));
    width: 280px;
    max-width: calc(50vw - 156px);
    pointer-events: auto;
    color: #fff;
    font-family: var(--oc-font);
    font-size: 14px;
    &[data-hidden] {
        display: none;
    }
    &[data-search] {
        pointer-events: none;
    }
    &[data-search] .chat-composer,
    &[data-search] .chat-view-viewport,
    &[data-search] .destination-group-toggle {
        pointer-events: auto;
    }
    /* In a space the party chat stays on the bottom bar's line, as in the
       lobby. */
    &[data-entered] {
        max-width: calc(100% - 32px);
    }
    &[data-collapsed] .chat-view-viewport {
        display: none;
    }
    .lobby-chat {
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        max-height: 58vh;
    }
    button {
        font: inherit;
        cursor: pointer;
        color: inherit;
    }
    button:focus-visible {
        outline: 2px solid #ffffff65;
        outline-offset: 2px;
    }
    ${conversationStyles}
    .chat-composer {
        width: 100%;
    }
    .destination-group-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 11px;
        background: #17191ee8;
        border: 1px solid #ffffff15;
        border-radius: 11px;
        font-size: 12px;
        margin: 5px 0;
    }
    @media (max-width: 850px) {
        /* No room beside the people list here: it takes the chat's place. */
        &[data-people] {
            display: none;
        }
        left: 16px;
        width: 280px;
        max-width: calc(100% - 242px);
    }
    @media (max-width: 550px) {
        width: min(280px, calc(100% - 32px));
        max-width: calc(100% - 32px);
        bottom: max(20px, calc(env(safe-area-inset-bottom) + 8px));
        .chat-composer {
            height: 44px;
        }
        .chat-input-bar input {
            font-size: 16px;
        }
        .chat-log {
            max-height: 32vh;
        }
    }
`;

export default LobbyConversationSurface;
