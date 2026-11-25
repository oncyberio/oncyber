import styled from "styled-components";
import { baseTokens as base, lobbyTokens as lobby } from "@styles/tokens";
import NativeVisitorPanel, {
    UtilityStack,
} from "@features/content-host/NativeVisitorPanel";

/**
 * How a purchase looks, built from the design system (docs/brand): the
 * payment sidebar is the lobby's glass utility panel with its buttons and
 * rows. The wallet is not here: it is part of the account dashboard.
 */

/**
 * The payment sidebar: the shared utility panel, docked to the right edge
 * on a wide screen so the game stays in view beside it. On a phone it is
 * the same bottom sheet as every other utility panel.
 */
export const PurchasePanel = styled(NativeVisitorPanel)`
    @media (min-width: 681px) {
        left: auto;
        right: max(16px, env(safe-area-inset-right));
        top: max(16px, env(safe-area-inset-top));
        bottom: max(16px, env(safe-area-inset-bottom));
        transform: none;
        max-height: none;
    }
`;

export const PurchaseSummary = styled(UtilityStack)`
    /* What is being bought, for how much, and what the visitor holds. */
    dl {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px 16px;
        margin: 0;
        padding: 12px;
        border: 1px solid ${base.color.line.subtle};
        border-radius: ${base.radius.control}px;
        background: ${base.color.line.faint};
    }
    dt {
        color: ${lobby.color.secondary};
    }
    dd {
        margin: 0;
        color: ${lobby.color.ink};
        font: ${base.font.size.sm}px / ${(base.font.size.md * 1.5).toFixed(1)}px
            ${base.font.mono};
        text-align: right;
    }
    .purchase-status {
        min-height: 20px;
    }
    /* The dialogs' error ink, readable on the panel. */
    .purchase-status[data-tone="error"] {
        color: ${base.color.danger};
    }
`;
