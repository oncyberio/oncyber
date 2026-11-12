import React from "react";
import styled, { css } from "styled-components";
import type { AssetType } from "../shared/AssetTypes";
export const AssetDock = styled.div<{
    isCollapsed: boolean;
    activeOpt: AssetType;
    isSelectedMesh: boolean;
    isEditableMesh: boolean;
}>`
    //
    position: relative;
    --asset-tool-size: 45.9px;
    --asset-tool-icon-scale: 0.85;
    --asset-tool-radius: 12px;

    @media (max-width: 600px) {
        --asset-tool-size: 54px;
        --asset-tool-icon-scale: 1;
        --asset-tool-radius: 14px;
    }

    & > .floatbar {
        position: fixed;
        left: 6px;
        top: calc(64px + (100vh - 70px) / 2);
        top: calc(64px + (100dvh - 70px) / 2);
        transform: translateY(-50%);
        margin: 0;
        user-select: none;

        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 1;

        @media (max-width: 600px) {
            background: var(--world-builder-bg);
        }

        .assets-content {
            top: 63px;
            left: 30px;
            width: 336px;
            margin-left: 40px;

            @media (max-width: 600px) {
                bottom: 95px;
                top: initial;
                left: 0px;
                margin-left: 29px;

                .arrow-indicator {
                    &.bottom {
                        left: 195px !important;
                    }
                }
            }
        }

        @media (max-width: 600px) {
            transform: none;
            left: 0;
            bottom: 0;
            width: 100%;
            height: 74px;
            top: initial;
            z-index: 10000;
            //

            ${(props) =>
                props.isSelectedMesh && props.isEditableMesh
                    ? css`
                          visibility: hidden;
                      `
                    : css`
                          visibility: visible;
                      `}

            & > .grab {
                display: none;
            }

            border-radius: 0px;
        }

        & > .asset-dock {
            position: relative;
            width: calc(var(--asset-tool-size) + 16px);
            background: var(--studio-bg, #141416);
            color: var(--studio-bg, #141416);

            /* Tangent curves join the dock to the viewport's black edge. */
            & > .wing {
                position: absolute;
                left: 0;
                width: 100%;
                height: 28px;
                pointer-events: none;

                &.wing-top {
                    bottom: calc(100% - 1px);
                }

                &.wing-bottom {
                    top: calc(100% - 1px);
                    transform: scaleY(-1);
                }
            }

            & > .cmd-list {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                padding: 10px 8px;
                max-height: calc(100vh - 178px);
                max-height: calc(100dvh - 178px);
                overflow-x: hidden;
                overflow-y: auto;
                overscroll-behavior: contain;
                scrollbar-width: thin;
                scrollbar-color: #45454a transparent;

                &::-webkit-scrollbar {
                    width: 3px;
                }

                &::-webkit-scrollbar-thumb {
                    border-radius: 3px;
                    background: #45454a;
                }

                & > * {
                    flex-shrink: 0;
                }
            }

            @media (max-width: 600px) {
                width: 100%;
                height: 100%;
                border-radius: 12px 12px 0 0;
                border: 0;
                filter: none;

                & > .wing {
                    display: none;
                }

                & > .cmd-list {
                    flex-direction: row;
                    gap: 4px;
                    width: 100%;
                    height: 100%;
                    max-height: none;
                    overflow-x: auto;
                    overflow-y: hidden;
                    padding: 0 8px;
                    scrollbar-width: none;

                    &::-webkit-scrollbar {
                        display: none;
                    }

                    & > #show-more {
                        display: none;
                    }
                }
            }
        }

        & > .details {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            left: calc(100% + 12px);

            @media (min-width: 601px) {
                & > #asset-layout {
                    min-height: 0;
                    max-height: min(600px, calc(100dvh - 110px));
                }
            }

            @media (max-width: 600px) {
                left: 0;
                width: 100%;
                bottom: 74px;
                top: initial;
                transform: none;
            }
        }
    }
`;

export const AssetDockButton = styled.button<{ $active?: boolean }>`
    position: relative;
    appearance: none;
    border: 0;
    padding: 0;
    margin: 0;
    width: var(--asset-tool-size);
    min-height: var(--asset-tool-size);
    flex-shrink: 0;
    background: transparent;
    color: var(--studio-ink, #f2f2f3);
    font: 13px/20px var(--studio-font, sans-serif);
    cursor: pointer;
    user-select: none;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;

    & > .icon-circle {
        position: relative;
        display: grid;
        place-items: center;
        width: var(--asset-tool-size);
        height: var(--asset-tool-size);
        flex-shrink: 0;
        border-radius: var(--asset-tool-radius);
        background: var(--studio-surface);
        border: 1px solid var(--studio-line);
        box-shadow: var(--studio-edge);
        transition: background 150ms ease, color 150ms ease;
        & > svg {
            display: block;
            pointer-events: none;
            transform: scale(var(--asset-tool-icon-scale));
        }
    }
    &:not(:disabled):hover {
        color: var(--studio-ink);
        & > .icon-circle {
            background: var(--studio-hover);
            border-color: var(--studio-line-strong);
        }
    }
    &:focus-visible {
        outline: 2px solid var(--studio-ink);
        outline-offset: 2px;
    }
    ${(props) =>
        props.$active &&
        css`
            && {
                color: var(--studio-ink);
                & > .icon-circle {
                    border-color: var(--studio-line-strong);
                    background: var(--studio-selected);
                }
                &::after {
                    content: "";
                    position: absolute;
                    left: -6px;
                    top: calc(
                        (
                                var(--asset-tool-size) - 22px *
                                    var(--asset-tool-icon-scale)
                            ) / 2
                    );
                    width: 3px;
                    height: calc(22px * var(--asset-tool-icon-scale));
                    border-radius: 2px;
                    background: #f2f2f3;
                }
            }
        `}
    &[data-tool="youtube"] > .icon-circle,
    &[data-tool="nft"] > .icon-circle,
    &[data-tool="component"] > .icon-circle,
    &[data-tool="text"] > .icon-circle,
    &[data-tool="upload"] > .icon-circle {
        background: transparent;
        border-color: transparent;
        box-shadow: none;
        > .nft-art-frame,
        > .upload-folder {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: contain;
            pointer-events: none;
            filter: drop-shadow(0 2px 2px #00000030);
        }
    }
    &[data-tool="component"] > .icon-circle > .world-globe {
        position: relative;
        display: grid;
        place-items: center;
        width: 100%;
        height: 100%;
        pointer-events: none;
        > img {
            position: absolute;
            inset: 0;
            display: block;
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
    }
    &[data-tool="nft"] > .icon-circle > .nft-art-frame {
        width: 88%;
        height: 88%;
    }
    &[data-tool="youtube"] > .icon-circle > .youtube-play {
        object-fit: contain;
        display: block;
        width: 88%;
        height: 88%;
        transform: none;
        pointer-events: none;
    }
    &[data-tool="avatar"] > .icon-circle {
        overflow: hidden;
    }
    &:disabled {
        opacity: 0.35;
        cursor: not-allowed;
    }
    & > .desc {
        width: 100%;
        display: flex;
        justify-content: center;
        & > .title {
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: inherit;
            font-size: 11px;
            line-height: 14px;
        }
    }
    & > .icon-circle > .tag {
        position: absolute;
        top: 0;
        right: -2px;
        padding: 1px 3px;
        border-radius: 3px;
        background: var(--studio-hover);
        color: var(--studio-ink);
        font: 8px/12px var(--studio-mono, monospace);
    }
    @media (max-width: 600px) {
        width: 68px;
        height: 100%;
        padding: 2px;
        box-sizing: border-box;
        gap: 2px;
        & > .icon-circle > .tag {
            display: none;
        }
        &:focus-visible {
            outline-offset: -3px;
        }
    }
    @media (prefers-reduced-motion: reduce) {
        & > .icon-circle {
            transition: none;
        }
    }
`;

export function AssetDockShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="asset-dock">
            {["top", "bottom"].map((side) => (
                <svg
                    key={side}
                    className={`wing wing-${side}`}
                    width="70"
                    height="28"
                    viewBox="0 0 58 28"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                >
                    <path
                        d="M0 0C0 7.73 12.98 14 29 14S58 20.27 58 28H0Z"
                        fill="currentColor"
                    />
                </svg>
            ))}
            <div className="cmd-list" role="group" aria-label="Add assets">
                {children}
            </div>
        </div>
    );
}
