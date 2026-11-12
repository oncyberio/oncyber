import React, { useEffect, useRef } from "react";
import styled, { css } from "styled-components";
import { brandFoundation } from "@styles/brand";
import { baseTokens as base, lobbyTokens as lobby } from "@styles/tokens";
import {
    mobileDockPanelLayout,
    mobileDockPanelMotion,
    lobbyPanelSurface,
    lobbyPanelIconButton,
} from "@features/lobby/lobbyPanelStyles";
import Icon from "@features/landing-carousel/components/Icon";

export const nativePanelTitles: Record<string, string> = {
    settings: "Settings",
    dashboard: "Space controls",
    audioSharing: "Share screen or audio",
    "select-media-placeholder": "Choose screen display",
    feedback: "Send feedback",
    report: "Report a visitor",
    users: "People in this space",
    voiceRequests: "Voice requests",
    explore: "Explore spaces",
    "profile-explore": "Profile",
};

/** One floating surface for native utilities, with the scene and chat kept visible. */
export default function NativeVisitorPanel({
    title,
    children,
    onClose,
    onBack,
    returnFocusRef,
    className,
}: {
    title: string;
    children: React.ReactNode;
    onClose(): void;
    onBack?: () => void;
    returnFocusRef?: React.RefObject<HTMLButtonElement>;
    className?: string;
}) {
    const heading = useRef<HTMLHeadingElement>(null);
    const close = useRef(onClose);
    close.current = onClose;
    useEffect(() => {
        const opener = document.activeElement as HTMLElement;
        return () => {
            const target = returnFocusRef?.current || opener;
            if (target?.isConnected) target.focus({ preventScroll: true });
        };
    }, [returnFocusRef]);
    useEffect(() => {
        heading.current?.focus({ preventScroll: true });
    }, [title]);

    return (
        <NativePanelFrame
            data-native-utility-panel
            className={className}
            role="dialog"
            aria-label={title}
            onWheel={(event) => event.stopPropagation()}
            onTouchMove={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Escape" && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    close.current();
                }
            }}
        >
            <div className="native-panel-heading">
                {onBack && (
                    <button
                        type="button"
                        aria-label="Back to More"
                        onClick={onBack}
                    >
                        <Icon name="back" size={17} />
                    </button>
                )}
                <h2 ref={heading} tabIndex={-1}>
                    {title}
                </h2>
                <button
                    type="button"
                    aria-label={`Close ${title.toLowerCase()}`}
                    onClick={onClose}
                >
                    <Icon name="close" size={16} />
                </button>
            </div>
            <div className="native-panel-body">{children}</div>
        </NativePanelFrame>
    );
}

export const nativeUtilitySurface = css`
    ${brandFoundation}
    ${lobbyPanelSurface}
    color: ${lobby.color.ink};
    text-shadow: none;
    font-size: ${base.font.size.md}px;
    line-height: 1.5;
    button,
    input,
    textarea,
    select {
        font-family: inherit;
    }
    button {
        cursor: pointer;
    }
    button:disabled {
        cursor: default;
        opacity: 0.45;
    }
    button:focus-visible,
    input:focus-visible,
    textarea:focus-visible {
        outline: 2px solid ${base.color.accent};
        outline-offset: 2px;
    }
`;

export const NativePanelFrame = styled.section`
    ${nativeUtilitySurface}
    position: fixed;
    z-index: 10020;
    left: 50%;
    bottom: max(82px, calc(env(safe-area-inset-bottom) + 70px));
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    width: ${lobby.panel.compactWidth}px;
    max-width: calc(100vw - 32px);
    max-height: calc(
        100dvh - max(82px, env(safe-area-inset-bottom) + 70px) -
            max(88px, env(safe-area-inset-top) + 72px)
    );
    overflow: hidden;
    pointer-events: auto;
    .native-panel-heading {
        display: flex;
        align-items: center;
        flex-shrink: 0;
        gap: 8px;
        min-height: 56px;
        padding: 12px 12px 12px 16px;
        border-bottom: 1px solid ${base.color.line.subtle};
    }
    .native-panel-heading h2 {
        flex: 1;
        min-width: 0;
        margin: 0;
        font-size: 14px;
        line-height: 20px;
        font-weight: 500;
        outline: none;
    }
    .native-panel-heading > button {
        ${lobbyPanelIconButton}
    }
    .native-panel-body {
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        padding: 16px;
    }
    .native-panel-body > :first-child {
        margin-top: 0;
    }
    .native-panel-body > :last-child {
        margin-bottom: 0;
    }
    @media (max-width: 680px) {
        ${mobileDockPanelLayout}
        ${mobileDockPanelMotion}
        .native-panel-heading {
            min-height: 56px;
            padding: 8px 12px 8px 16px;
        }
        .native-panel-heading > button {
            width: 40px;
            height: 40px;
        }
    }
`;

export const UtilityStack = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    min-width: 0;
    color: var(--oc-ink, ${base.color.ink});
    font: ${base.font.size.md}px / 1.5 ${base.font.sans};
    p {
        margin: 0;
        color: ${lobby.color.secondary};
    }
    h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 500;
    }
`;

export const UtilityActions = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    > button {
        flex: 1;
    }
`;

export const UtilityButton = styled.button<{ $primary?: boolean }>`
    min-height: 40px;
    padding: 10px 14px;
    border: 1px solid ${base.color.line.default};
    border-radius: ${base.radius.control}px;
    background: ${({ $primary }) =>
        $primary ? base.color.ink : base.color.line.faint};
    color: ${({ $primary }) => ($primary ? "#16191f" : base.color.ink)};
    font: 500 13px/20px ${base.font.sans};
    cursor: pointer;
    &:hover:not(:disabled) {
        filter: brightness(1.12);
    }
    &:disabled {
        opacity: 0.45;
        cursor: default;
    }
    &:focus-visible {
        outline: 2px solid ${base.color.accent};
        outline-offset: 2px;
    }
    @media (max-width: 680px) {
        min-height: 44px;
    }
`;

export const UtilityTextarea = styled.textarea`
    box-sizing: border-box;
    width: 100%;
    min-height: 120px;
    resize: vertical;
    padding: 12px;
    border: 1px solid ${base.color.line.default};
    border-radius: ${base.radius.control}px;
    background: ${base.color.line.faint};
    color: ${base.color.ink};
    font: 13px/1.5 ${base.font.sans};
    box-shadow: none;
    &::placeholder {
        color: ${base.color.muted};
    }
    &[aria-invalid="true"] {
        border-color: ${base.color.accentCreate};
    }
    @media (max-width: 680px) {
        font-size: 16px;
    }
`;

export const UtilityRow = styled.button`
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 48px;
    padding: 12px;
    border: 1px solid ${base.color.line.subtle};
    border-radius: ${base.radius.control}px;
    background: ${base.color.line.faint};
    color: ${base.color.ink};
    font: 13px/20px ${base.font.sans};
    text-align: left;
    cursor: pointer;
    &:hover:not(:disabled) {
        background: ${base.color.line.subtle};
    }
    &:disabled {
        opacity: 0.4;
        cursor: default;
    }
    &:focus-visible {
        outline: 2px solid ${base.color.accent};
        outline-offset: 2px;
    }
    > svg,
    > img,
    > .experience-icon {
        flex-shrink: 0;
    }
    small {
        display: block;
        color: ${base.color.muted};
        font-size: 12px;
    }
`;
