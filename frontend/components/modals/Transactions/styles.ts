import { css } from "styled-components";
import { actionSpec } from "@styles/brand";
import { dialogCopy, dialogTitle } from "@components/Dialogs/styles";
import { actionTokens as action } from "@styles/tokens/action";

/**
 * The buy window's parts, in the shared dark dialog look. The surface itself
 * (panel, border, corners, shadow, font and the `--*-color` variables) comes
 * from `className="dialog-window"` on the modal.
 */
export const transactionWindow = css`
    box-sizing: border-box;
    width: 480px;
    max-width: calc(100vw - 32px);
    padding: 24px;
    color: var(--title-color);
`;

export const transactionHeader = css`
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 16px;
    margin-bottom: 16px;
    border-bottom: 1px solid var(--border-color);

    h2 {
        ${dialogTitle}
        text-align: left;
    }

    img {
        width: 32px;
    }
`;

export const transactionBody = css`
    display: grid;
    justify-content: flex-start;

    & > div {
        ${dialogCopy}
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 8px 0 16px 0;
        text-align: left;
    }
`;

export const transactionFooter = css`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color);

    & > a:first-child {
        ${dialogCopy}
        cursor: pointer;
        text-decoration: none;
        white-space: nowrap;
        transition: color 150ms ease;
    }

    & > a:first-child:hover {
        color: var(--title-color);
    }

    & > a:first-child:focus-visible {
        outline: ${action.state.focusWidth}px solid ${action.state.focusRing};
        outline-offset: ${action.state.focusOffset}px;
        border-radius: 4px;
    }
`;

/** The window's button, on the action spec: the shared outline. */
export const transactionAction = css`
    ${actionSpec}
    display: flex;
    align-items: center;
    justify-content: center;
    gap: ${action.size.gap}px;
    flex: 0 1 200px;
    min-width: 0;
    color: ${action.outline.ink};
    background: transparent;
    border-color: ${action.outline.border};
    text-align: center;
    text-decoration: none;
    white-space: nowrap;
`;
