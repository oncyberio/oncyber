import styled from "styled-components";
import { baseTokens as base, lobbyTokens as lobby } from "@styles/tokens";
import {
    darkDialogSurface,
    dialogCopy,
    dialogTitle,
} from "@components/Dialogs/styles";
import { experienceControl } from "@features/content-host/experienceChrome";
import NativeVisitorPanel from "@features/content-host/NativeVisitorPanel";

/**
 * How purchases look, built from the design system (docs/brand): the
 * question is the shared dark dialog with action buttons, the wallet is the
 * lobby's glass utility panel, and its opener is a lobby control.
 */

/** Dims the game behind the question; a click on it is a no. */
export const PurchaseScrim = styled.div`
    position: absolute;
    inset: 0;
    z-index: 10030;
    display: grid;
    place-items: center;
    padding: 20px;
    background: ${lobby.glass.scrim};
`;

export const PurchaseDialog = styled.section`
    ${darkDialogSurface}
    width: min(400px, 100%);
    max-height: calc(100dvh - 40px);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 24px;
    h2 {
        ${dialogTitle}
    }
    p {
        ${dialogCopy}
    }
    /* What is being bought, for how much, and what the visitor holds. */
    dl {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px 16px;
        margin: 0;
        padding: 12px 16px;
        border: 1px solid ${base.color.line.subtle};
        border-radius: ${base.radius.control}px;
        background: var(--field-bg-color);
        font: ${base.font.weight.regular} ${base.font.size.md}px / 1.5
            var(--oc-font, ${base.font.sans});
    }
    dt {
        color: var(--content-color);
    }
    dd {
        margin: 0;
        color: var(--title-color);
        font-family: ${base.font.mono};
        font-size: ${base.font.size.sm}px;
        line-height: ${(base.font.size.md * 1.5).toFixed(1)}px;
        text-align: right;
    }
    .purchase-status {
        min-height: 21px;
    }
    .purchase-status[data-tone="error"] {
        color: var(--danger-color);
    }
    .purchase-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
    }
    .purchase-actions > button {
        flex: 1;
        min-width: 120px;
    }
`;

/** The wallet's opener: a lobby control wide enough for the balance. */
export const WalletControl = styled.button`
    ${experienceControl}
    position: absolute;
    right: 12px;
    /* Above the Credits chip in the same corner. */
    bottom: 44px;
    z-index: 2;
    width: auto;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    font: ${base.font.weight.medium} ${base.font.size.sm}px / 1
        ${base.font.sans};
    .wallet-balance {
        font-family: ${base.font.mono};
        font-weight: ${base.font.weight.regular};
    }
    @media (max-width: 680px) {
        width: auto;
    }
`;

/**
 * The wallet: the shared utility panel, docked to the right edge on a wide
 * screen so the game stays in view beside it. On a phone it is the same
 * bottom sheet as every other utility panel.
 */
export const WalletPanel = styled(NativeVisitorPanel)`
    @media (min-width: 681px) {
        left: auto;
        right: max(16px, env(safe-area-inset-right));
        top: max(16px, env(safe-area-inset-top));
        bottom: max(16px, env(safe-area-inset-bottom));
        transform: none;
        max-height: none;
    }
    .wallet-balance {
        margin: 0;
        color: ${lobby.color.ink};
        font: ${base.font.weight.medium} 28px / 1.2 ${base.font.sans};
    }
    .wallet-list {
        display: flex;
        flex-direction: column;
        margin: 0;
        padding: 0;
        list-style: none;
    }
    .wallet-list li {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 0;
        border-top: 1px solid ${base.color.line.subtle};
    }
    .wallet-list small {
        display: block;
        color: ${lobby.color.meta};
        font-size: ${base.font.size.sm}px;
    }
    .wallet-price {
        flex-shrink: 0;
        color: ${lobby.color.ink};
        font: ${base.font.size.sm}px / 1.5 ${base.font.mono};
    }
`;
