import styled from "styled-components";

/** The / command palette above the landing search bar. */
const FeedMenu = styled.div`
    position: fixed;
    z-index: 10;
    bottom: calc(max(17.8svh, 76px) / 2 + 36px);
    left: 0;
    right: 0;
    margin: 0 auto;
    width: clamp(320px, 40vw, 520px);
    max-height: min(460px, calc(100svh - max(17.8svh, 76px) / 2 - 56px));
    display: flex;
    flex-direction: column;
    border: 1px solid var(--oc-line);
    border-radius: var(--oc-radius-card);
    background: var(--oc-panel);
    box-shadow: var(--oc-shadow);
    color: var(--oc-ink);
    overflow: hidden;
    animation: landing-popover-in var(--oc-enter) var(--oc-ease);
    @keyframes landing-popover-in {
        from {
            opacity: 0;
            transform: translateY(4px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    .command-input {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
        padding: 10px 14px;
        border-bottom: 1px solid var(--oc-line);
        color: var(--oc-muted);
    }
    .command-input .slash {
        font-family: var(--oc-mono);
        font-size: 13px;
    }
    .command-input input {
        flex: 1;
        min-width: 0;
        border: 0;
        outline: none;
        background: none;
        color: var(--oc-ink);
        font: inherit;
        /* 16px keeps iOS Safari from zooming into the field. */
        font-size: 16px;
    }
    /* The field is the whole menu's focus; the panel already frames it. */
    && .command-input input:focus,
    && .command-input input:focus-visible {
        outline: none;
        box-shadow: none;
    }
    .command-input input::placeholder {
        color: var(--oc-muted);
    }
    .command-list {
        overflow-y: auto;
        padding: 4px 6px 6px;
        overscroll-behavior: contain;
    }
    .command-section {
        padding: 10px 10px 4px;
        font-family: var(--oc-mono);
        font-size: 10px;
        letter-spacing: 0.02em;
        color: var(--oc-muted);
    }
    [role="option"] {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 32px;
        padding: 0 10px;
        border-radius: var(--oc-radius-inset, 8px);
        color: var(--oc-secondary);
        font-size: 13px;
        cursor: pointer;
        user-select: none;
    }
    [role="option"] > svg {
        flex-shrink: 0;
        color: var(--oc-muted);
    }
    [role="option"] .label {
        color: var(--oc-ink);
        white-space: nowrap;
    }
    [role="option"] .detail {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        color: var(--oc-muted);
        white-space: nowrap;
        text-overflow: ellipsis;
    }
    [role="option"] .hint {
        flex-shrink: 0;
        margin-left: auto;
        font-family: var(--oc-mono);
        font-size: 11px;
        color: var(--oc-muted);
    }
    [role="option"] .hint svg {
        display: block;
        color: var(--oc-accent, var(--accent));
    }
    [role="option"][data-active="true"] {
        background: var(--oc-hover);
    }
    [role="option"][data-active="true"] > svg {
        color: var(--oc-ink);
    }
    .command-empty {
        padding: 18px 10px;
        color: var(--oc-muted);
        font-size: 13px;
        text-align: center;
    }
    @media (max-width: 700px) {
        bottom: 140px;
        left: 20px;
        right: 20px;
        width: auto;
        max-height: calc(100svh - 160px);
        [role="option"] {
            min-height: 40px;
        }
        [role="option"] .detail {
            display: none;
        }
    }
    @media (prefers-reduced-motion: reduce) {
        animation: none;
    }
`;

export default FeedMenu;
