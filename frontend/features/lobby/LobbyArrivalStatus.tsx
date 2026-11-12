import React, { forwardRef } from "react";
import styled from "styled-components";
import { compactActionSizing } from "@styles/brand";
import { lobbyPanelTokens } from "./lobbyPanelStyles";
import type { LobbyDestinationPhase } from "./lobbyJourneyProtocol";

export type LobbyArrivalStatusProps = {
    worldName?: string;
    phase: LobbyDestinationPhase;
    admitted?: boolean;
    /**
     * @deprecated Ignored. Neither the page nor the 3D scene draws travel
     * text. Kept only so `/dev/lobby-travel` still type-checks.
     */
    floorStatusVisible?: boolean;
    /** The space has loaded and is revealing: fade the travel UI away so it
     * never sits over the space's own controls. */
    leaving?: boolean;
    onCancel: () => void;
    className?: string;
};

export function lobbyArrivalStatusText(
    phase: LobbyDestinationPhase,
    admitted = false
) {
    return phase === "returning"
        ? "Welcome back"
        : phase === "revealing"
        ? "Arriving"
        : admitted
        ? "Preparing arrival"
        : "Transporting you…";
}

/** Travel shows no words, over the scene or in it. The status stays in the
 * DOM for assistive technology only, beside the one visible control: Cancel. */
const LobbyArrivalStatus = forwardRef<HTMLDivElement, LobbyArrivalStatusProps>(
    function LobbyArrivalStatus(
        {
            worldName,
            phase,
            admitted = false,
            leaving = false,
            onCancel,
            className,
        },
        ref
    ) {
        const title = worldName?.trim() || "Your world";
        return (
            <Overlay
                ref={ref}
                className={className}
                tabIndex={-1}
                aria-label="Travelling to your world"
                data-leaving={leaving || undefined}
            >
                <div
                    className="arrival-copy"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    <strong className="arrival-world" title={title}>
                        {title}
                    </strong>
                    <span className="arrival-state">
                        {lobbyArrivalStatusText(phase, admitted)}
                    </span>
                </div>
                <CancelButton
                    className="arrival-cancel"
                    type="button"
                    onClick={onCancel}
                    aria-keyshortcuts="Escape"
                    aria-hidden={leaving || undefined}
                    tabIndex={leaving ? -1 : undefined}
                >
                    Cancel
                </CancelButton>
            </Overlay>
        );
    }
);

export default LobbyArrivalStatus;

const Overlay = styled.div`
    ${lobbyPanelTokens}
    position: absolute;
    inset: 0;
    z-index: 22;
    pointer-events: none;
    outline: none;
    font-family: var(
        --oc-font,
        "Oncyber Sans",
        "Helvetica Neue",
        Arial,
        sans-serif
    );
    font-synthesis: none;
    -webkit-font-smoothing: antialiased;
    .arrival-copy {
        /* A live status for assistive technology; never drawn. */
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        clip-path: inset(50%);
        white-space: nowrap;
    }
    &[data-leaving] .arrival-cancel {
        opacity: 0;
        transform: translate(-50%, 12px);
        pointer-events: none;
    }
`;

const CancelButton = styled.button`
    ${compactActionSizing}
    position: absolute;
    bottom: max(24px, calc(env(safe-area-inset-bottom) + 12px));
    left: 50%;
    transform: translateX(-50%);
    appearance: none;
    pointer-events: auto;
    border: 1px solid #ffffff99;
    background: transparent;
    color: #f3f3f1;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background-color 150ms ease, border-color 150ms ease,
        opacity 280ms ease, transform 280ms ease;
    &:hover {
        background: #ffffff18;
        border-color: #fff;
    }
    &:active {
        background: #ffffff24;
    }
    &:focus-visible {
        outline: 2px solid var(--oc-accent, #2567ff);
        outline-offset: 3px;
    }
    @media (max-width: 640px) {
        min-height: 44px;
    }
    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }
    @media (forced-colors: active) {
        color: ButtonText;
        background: ButtonFace;
        border-color: ButtonText;
        &:hover,
        &:active {
            background: Highlight;
            color: HighlightText;
            border-color: Highlight;
        }
        &:focus-visible {
            outline-color: Highlight;
        }
    }
`;
