import React from "react";
import styled, { css } from "styled-components";
import IconImg from "@ui/components/IconImg";
import { PanelTypeIcon } from "../../shared/PanelTypeIcon";
import {
    studioPanel,
    studioHeading,
    studioAction,
} from "@features/studio/styles/primitives";
interface AddAssetLayoutProps {
    title: React.ReactNode;
    icon?: React.ReactNode;
    style?: React.CSSProperties;
    onClose: () => unknown;
    children: React.ReactNode;
    variant?: "inspector" | "content";
}

export function InspectorFrame({
    title,
    icon,
    style = {},
    onClose,
    children,
    variant = "inspector",
    actions,
}: AddAssetLayoutProps & { actions?: React.ReactNode }) {
    //

    return (
        <Container
            data-studio-surface
            style={style}
            $variant={variant}
            role="region"
            aria-label={typeof title === "string" ? title : undefined}
        >
            <div className="header">
                {icon && <PanelTypeIcon>{icon}</PanelTypeIcon>}
                <h2 className="title">{title}</h2>
                {/* <div className="info">
                    <IconImg name="info" size={16} />
                </div> */}
                <div className="actions">
                    {actions}
                    <button
                        type="button"
                        aria-label="Close inspector"
                        className="close"
                        onClick={onClose}
                    >
                        <IconImg name="x" size={16} mode="light" />
                    </button>
                </div>
            </div>
            <div className="body y-scroll">{children}</div>
        </Container>
    );
}

const Container = styled.div<{ $variant: "inspector" | "content" }>`
    //
    --separator-color: var(--studio-line, #303035);

    display: flex;
    flex-direction: column;
    padding: var(--studio-panel-padding);
    z-index: 1;

    width: 340px;

    max-height: calc(100vh - var(--edit-asset-top) - 140px);

    @media (max-width: 600px) {
        max-height: 40vh;
        border-radius: 0 !important;
        border: none !important;
        width: 100% !important;
    }

    color: var(--panel-text-primary);

    background: var(--panel-bg);
    border: var(--panel-border);
    box-shadow: var(--panel-shadow);
    ${studioPanel}

    & > .header {
        display: flex;
        flex-direction: row;
        gap: 8px;
        align-items: center;
        padding-bottom: 12px;

        border-bottom: 1px solid var(--separator-color);

        @media (max-width: 600px) {
            padding-bottom: 12px;
            .close {
                min-width: 44px;
                min-height: 44px;
            }
        }

        & > .icon {
            filter: invert(0.5);
            cursor: pointer;
        }

        & > .title {
            ${studioHeading}
            color: var(--panel-text-primary);
        }

        & > .actions {
            margin-left: auto;
            display: flex;
            gap: 8px;
            align-items: center;

            & > .close {
                ${studioAction}
                width: 32px;
                height: 32px;
                min-height: 32px;
                padding: 0;
                opacity: 0.6;
                filter: none;
                cursor: pointer;
                transition: opacity 0.2s ease-out;

                &:hover {
                    opacity: 1;
                }
            }
        }
    }

    & > .body {
        flex: 1;
        padding-top: 14px;
        min-height: 0;
        user-select: none;

        @media (max-width: 600px) {
            padding: 0;
        }
    }

    ${({ $variant }) =>
        $variant === "content" &&
        css`
            padding: 0;
            height: min(600px, calc(100dvh - 110px));
            max-height: min(600px, calc(100dvh - 110px));
            overflow: hidden;

            & > .header {
                flex-shrink: 0;
                padding: 12px var(--studio-panel-padding);
                border-bottom: 0;

                & > .title {
                    font-size: 16px;
                    line-height: 22px;
                    letter-spacing: 0;
                }
            }

            & > .body {
                padding: 0 var(--studio-panel-padding)
                    var(--studio-panel-padding);
                overflow-y: auto;
                overscroll-behavior: contain;
                scrollbar-width: thin;
                scrollbar-color: #45454d transparent;
            }

            @media (max-width: 600px) {
                height: min(420px, calc(100dvh - 150px));
                max-height: min(420px, calc(100dvh - 150px));
                border-radius: var(--studio-radius-panel)
                    var(--studio-radius-panel) 0 0 !important;
                border: 1px solid var(--studio-line) !important;
                border-bottom: 0 !important;

                & > .header {
                    display: flex;
                    padding: 8px 18px;

                    & > .actions > .close {
                        width: 44px;
                        height: 44px;
                        min-height: 44px;
                    }
                }

                & > .body {
                    padding: 0 18px 16px;
                }
            }
        `}
`;
