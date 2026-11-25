import { useEffect, useRef } from "react";
import styled from "styled-components";
import {
    actionButton,
    blueAction,
    brandFoundation,
    outlineAction,
    whiteAction,
} from "@styles/brand";
import { baseTokens as base } from "@styles/tokens";
import Icon from "@features/landing-carousel/components/Icon";
import {
    sidebarCard,
    sidebarClose,
    sidebarEyebrow,
    sidebarHeader,
    sidebarPanel,
    sidebarPhoneClose,
    sidebarPhonePanel,
    sidebarRow,
    sidebarScroll,
    sidebarTitle,
} from "@ui/components/sidebarSurface";

/**
 * The payment sidebar: the same solid sidebar as a profile and the account
 * (ui/components/sidebarSurface.ts), on the right. Its header, close
 * button, cards, rows and buttons are theirs; only what it says is its own.
 *
 * It is not a native modal, unlike those two: the sign-in sheet and the
 * visitor's profile open over it, and a native modal would make everything
 * else on the page unreachable. Its own backdrop covers the game's frame,
 * so a click outside is seen here and is a no.
 */
export default function PurchaseSidebar({
    title,
    busy,
    onClose,
    children,
}: {
    title: string;
    /** A payment is under way: the sidebar cannot be closed. */
    busy: boolean;
    onClose(): void;
    children: React.ReactNode;
}) {
    const panel = useRef<HTMLElement>(null);
    useEffect(() => {
        const opener = document.activeElement as HTMLElement | null;
        panel.current?.focus({ preventScroll: true });
        return () => {
            if (opener?.isConnected) opener.focus({ preventScroll: true });
        };
    }, []);
    return (
        <Layer
            onPointerDown={(event) => {
                if (event.target === event.currentTarget && !busy) onClose();
            }}
            onKeyDown={(event) => {
                // Typing and shortcuts here must not reach the game.
                event.stopPropagation();
                if (event.key !== "Tab") return;
                const targets = [
                    ...panel.current.querySelectorAll<HTMLElement>(
                        "button:not(:disabled), a[href]"
                    ),
                ];
                const first = targets[0],
                    last = targets[targets.length - 1];
                if (
                    event.shiftKey &&
                    (document.activeElement === first ||
                        document.activeElement === panel.current)
                ) {
                    event.preventDefault();
                    last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first?.focus();
                }
            }}
        >
            <aside
                ref={panel}
                className="purchase-sidebar"
                role="dialog"
                aria-label={title}
                tabIndex={-1}
                // A page overlay the game keeps its HUD clear of
                // (docs/games/safe-area.md).
                data-game-overlay="purchase"
            >
                <header className="purchase-header">
                    <h2>{title}</h2>
                    <button
                        type="button"
                        className="purchase-close"
                        aria-label={`Close ${title.toLowerCase()}`}
                        disabled={busy}
                        onClick={onClose}
                    >
                        <Icon name="close" size={20} />
                    </button>
                </header>
                <div className="purchase-scroll">{children}</div>
            </aside>
        </Layer>
    );
}

const Layer = styled.div`
    ${brandFoundation}
    position: fixed;
    inset: 0;
    /* Over the game and its controls; under dialogs and the sign-in sheet. */
    z-index: 10030;
    display: flex;
    justify-content: flex-end;
    padding: ${base.sidebar.inset}px;
    background: ${base.sidebar.backdrop};
    color: var(--oc-ink);
    animation: purchase-shade-in var(--oc-enter) var(--oc-ease) both;
    &,
    * {
        box-sizing: border-box;
    }
    button {
        font: inherit;
        cursor: pointer;
    }
    button:disabled {
        cursor: not-allowed;
    }
    button:focus-visible {
        outline: ${base.focus.width}px solid var(--oc-accent);
        outline-offset: -${base.focus.offset}px;
    }
    .purchase-sidebar {
        ${sidebarPanel("right")}
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        animation: purchase-sidebar-in var(--oc-enter) var(--oc-ease) both;
    }
    .purchase-sidebar:focus {
        outline: none;
    }
    .purchase-header {
        ${sidebarHeader}
    }
    h2 {
        ${sidebarTitle}
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
    }
    .purchase-close {
        ${sidebarClose}
    }
    .purchase-close:disabled {
        opacity: 0.45;
    }
    .purchase-scroll {
        ${sidebarScroll}
        display: flex;
        flex-direction: column;
        gap: 16px;
    }
    h3 {
        ${sidebarEyebrow}
        margin: 0;
    }
    p {
        margin: 0;
        color: var(--oc-secondary);
        font-size: 13px;
        line-height: 1.5;
    }
    /* What is being bought, from which game. */
    .purchase-item {
        display: grid;
        gap: 4px;
        padding-top: 8px;
    }
    /* The price, and what the visitor holds or pays with. */
    .purchase-summary {
        ${sidebarCard}
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px 16px;
        margin: 0;
        font-size: 13px;
        line-height: 1.5;
    }
    .purchase-summary dt {
        color: var(--oc-secondary);
    }
    .purchase-summary dd {
        margin: 0;
        color: var(--oc-ink);
        font: 12px/1.6 var(--oc-mono);
        text-align: right;
    }
    .purchase-summary .purchase-price {
        font-size: 14px;
    }
    .purchase-status {
        min-height: 20px;
    }
    .purchase-status[data-tone="error"] {
        color: var(--oc-danger);
    }
    .purchase-actions {
        display: grid;
        gap: 8px;
    }
    .purchase-actions button {
        ${actionButton}
        ${outlineAction}
        width: 100%;
    }
    .purchase-actions button.primary {
        ${whiteAction}
    }
    /* Blue is for signing in (docs/brand, Action buttons). */
    .purchase-actions button.sign-in {
        ${blueAction}
    }
    .purchase-wallet {
        margin-top: 8px;
        padding-top: 16px;
        border-top: 1px solid var(--oc-line);
    }
    .purchase-wallet button {
        ${sidebarRow}
        margin: 6px -12px 0;
        width: calc(100% + 24px);
    }
    .purchase-wallet button:disabled {
        opacity: 0.45;
    }
    .row-arrow {
        color: var(--oc-muted);
        opacity: 0.65;
    }
    @keyframes purchase-sidebar-in {
        from {
            opacity: 0;
            transform: translateX(${base.sidebar.slide}px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    @keyframes purchase-shade-in {
        from {
            background: transparent;
        }
        to {
            background: ${base.sidebar.backdrop};
        }
    }
    @media (max-width: ${base.breakpoint.phone}px) {
        padding: 0;
        .purchase-sidebar {
            ${sidebarPhonePanel}
        }
        .purchase-header {
            padding: calc(16px + env(safe-area-inset-top, 0px)) 16px 12px 20px;
        }
        .purchase-scroll {
            padding: 4px 20px calc(24px + env(safe-area-inset-bottom, 0px));
        }
        .purchase-close {
            ${sidebarPhoneClose}
        }
    }
    @media (prefers-reduced-motion: reduce) {
        &,
        .purchase-sidebar {
            animation: none;
        }
    }
`;
