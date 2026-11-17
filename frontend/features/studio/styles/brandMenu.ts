import { css } from "styled-components";
import { brandVariables } from "@styles/brand";

/**
 * The brand guide's menu, as the landing's language menu draws it: a panel
 * with 24px corners (20px on phones), 40px rows with 8px corners, a subtle
 * hover, and the sans face. Studio dropdowns share it so every open menu
 * looks the same.
 */
export const brandMenuPanel = css`
    ${brandVariables}
    box-sizing: border-box;
    min-width: 192px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    border: 1px solid var(--oc-line);
    border-radius: var(--oc-radius-card, 24px);
    background: var(--oc-panel);
    box-shadow: 0 16px 40px #0006, 0 2px 8px #0003;
    color: var(--oc-secondary);
    font: 14px/1.2 var(--oc-font);
    animation: brand-menu-in 0.14s ease-out;

    @media (max-width: 600px) {
        border-radius: 20px;
    }
    @keyframes brand-menu-in {
        from {
            opacity: 0;
            transform: translateY(-4px);
        }
    }
    @media (prefers-reduced-motion: reduce) {
        animation: none;
    }
`;

/** A menu row: put it on the row's button or link. */
export const brandMenuRow = css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    box-sizing: border-box;
    width: 100%;
    min-height: 40px;
    padding: 8px 12px;
    border: 0;
    border-radius: var(--oc-radius-inset, 8px);
    background: none;
    color: var(--oc-secondary);
    font: 14px/1.2 var(--oc-font);
    text-align: left;
    text-decoration: none;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
    &:hover,
    &:focus-visible {
        background: var(--oc-hover);
        color: var(--oc-ink);
        outline: none;
    }
    &[aria-checked="true"],
    &[aria-current="true"] {
        color: var(--oc-ink);
    }
    &:disabled {
        opacity: 0.5;
        cursor: default;
    }
`;

/** A small section label above a group of rows. */
export const brandMenuLabel = css`
    padding: 8px 12px 4px;
    color: var(--oc-muted);
    font: 500 13px/1.2 var(--oc-font);
`;

/** A divider between groups of rows. */
export const brandMenuDivider = css`
    height: 1px;
    margin: 6px -8px;
    background: var(--oc-line);
    border: 0;
`;
