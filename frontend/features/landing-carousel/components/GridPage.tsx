import styled from "styled-components";
import { brandFoundation } from "@styles/brand";

export const Page = styled.div<{ $gallery?: boolean }>`
    ${brandFoundation}
    position: relative;
    --accent: var(--oc-accent);
    --landing-header-height: 30.6svh;
    /* Keep the search and Jump In controls in proportion as space tightens. */
    --landing-control-height: clamp(
        40px,
        min(calc(32px + 1.25vw), 6.6667svh),
        48px
    );
    --landing-control-radius: clamp(12px, 1.25vw, 16px);
    --landing-control-gap: clamp(7px, 0.78125vw, 10px);
    --landing-control-font-size: clamp(13px, 1.09375vw, 14px);
    background: var(--oc-canvas);
    color: var(--oc-ink);
    height: 100vh;
    height: 100svh;
    min-height: 620px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    * {
        box-sizing: border-box;
    }
    a {
        text-decoration: none;
        color: inherit;
    }
    :where(button, input, select) {
        font: inherit;
        letter-spacing: inherit;
    }
    button,
    a,
    input,
    select {
        -webkit-tap-highlight-color: transparent;
    }
    button:focus-visible,
    a:focus-visible,
    input:focus-visible,
    select:focus-visible {
        outline: 1px solid var(--accent);
        outline-offset: 4px;
    }
    button:disabled {
        cursor: default;
    }
    main,
    .results {
        min-height: 0;
        display: flex;
        flex: 1;
        flex-direction: column;
    }
    main {
        position: relative;
    }
    .skip-link {
        position: absolute;
        top: -60px;
        left: 16px;
        z-index: 100;
        padding: 12px;
        background: var(--accent);
        color: #101010;
    }
    .skip-link:focus {
        top: 10px;
    }
    @media (max-width: 700px) {
        min-height: 560px;
        --landing-header-height: ${({ $gallery }) =>
            $gallery ? "190px" : "20svh"};
    }
`;

export const BrowseSurface = styled.div`
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
`;

export const EmptyFooter = styled.div`
    height: 17.8svh;
    min-height: 76px;
    flex-shrink: 0;
    margin: 0 7%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    > button {
        display: flex;
        align-items: center;
        gap: 12px;
        background: none;
        border: 0;
        padding: 10px 0;
        color: #deded6;
        cursor: pointer;
        font-size: 14px;
    }
    span {
        color: var(--accent);
        font-size: 19px;
    }
    @media (max-width: 700px) {
        height: 18svh;
        min-height: 144px;
        margin: 0 20px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        align-content: end;
        align-items: center;
        padding-bottom: 28px;
        > button {
            justify-self: start;
            font-size: 12px;
            gap: 5px;
        }
        > div {
            justify-self: end;
        }
    }
`;

export const ViewControls = styled.div`
    display: flex;
    align-items: center;
    gap: 18px;
    .density {
        display: flex;
        align-items: center;
        gap: 2px;
    }
    button {
        color: var(--oc-muted);
        background: none;
        border: 0;
        padding: 8px;
        font-family: var(--oc-mono);
        font-size: 11px;
        cursor: pointer;
        border-radius: var(--oc-radius-inset);
        transition: background var(--oc-fast), color var(--oc-fast);
    }
    button[aria-pressed="true"] {
        color: var(--oc-ink);
        background: var(--oc-surface);
    }
    button:hover:not([aria-pressed="true"]) {
        color: var(--oc-ink);
        background: var(--oc-hover);
    }
    .density button {
        position: relative;
        min-width: 34px;
        min-height: 40px;
        padding: 8px 6px;
        background: none;
        font-size: 10px;
    }
    .density button[aria-pressed="true"] {
        color: var(--oc-secondary);
        background: none;
    }
    .density button[aria-pressed="true"]::after {
        content: "";
        position: absolute;
        bottom: 5px;
        left: calc(50% - 5px);
        width: 10px;
        height: 2px;
        border-radius: 1px;
        background: var(--oc-accent);
    }
    .density button:hover {
        color: var(--oc-ink);
        background: none;
    }
    @media (max-width: 700px) {
        gap: 6px;
        button {
            padding: 7px 3px;
        }
        .density button {
            min-width: 30px;
            min-height: 44px;
        }
    }
`;

// The empty page itself is the shared `EmptyState` (@ui/components/EmptyState).
