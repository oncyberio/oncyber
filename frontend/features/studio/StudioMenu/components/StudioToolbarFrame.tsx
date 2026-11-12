import styled, { css } from "styled-components";
export const StudioToolbarFrame = styled.div<{
    isAnonymous: boolean;
}>`
    //
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 64px;
    z-index: 2000;
    padding: 0 12px;
    user-select: none;

    background: var(--studio-bg, #141416);
    border: 0;

    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;

    @media (min-width: 601px) and (max-width: 1000px) {
        grid-template-columns: auto minmax(0, 1fr) auto;
        column-gap: 12px;
        & > .center {
            max-width: 100%;
        }
    }

    & .mode {
        display: none !important;

        @media (max-width: 600px) {
            &.desktop {
                display: none !important;
            }
        }
    }

    .preview-tuto {
        top: 80px;
        right: 20px;
        width: 336px;

        @media (max-width: 600px) {
            width: 280px;
            right: 5px;
            top: 70px;
        }

        .arrow-indicator {
            &.top {
                right: 40px !important;

                ${(props) =>
                    !props.isAnonymous &&
                    css`
                        @media (max-width: 600px) {
                            right: 5px !important;
                        }
                    `}
            }
        }
    }

    &.edit .mode.edit {
        display: flex !important;

        @media (max-width: 600px) {
            &.desktop {
                display: none !important;
            }
        }
    }

    &.display .mode.display {
        display: flex !important;

        @media (max-width: 600px) {
            &.desktop {
                display: none !important;
            }
        }
    }

    &.cinematic .mode.cinematic {
        display: flex !important;

        @media (max-width: 600px) {
            &.desktop {
                display: none !important;
            }
        }
    }

    & .horz {
        display: flex;
        flex-direction: row;
        align-items: center;
        min-width: 0;

        & .exhibit-wrapper {
            height: 38px;
            gap: 10px;
            padding: 0 14px 0 6px;
            border-radius: var(--studio-radius-control);
            border: 0;
            transition: background 150ms ease;
            &:hover {
                background: var(--studio-surface);
            }

            @media (max-width: 600px) {
                max-width: 140px;
                height: 44px;
                border-radius: var(--studio-radius-control);
                padding: 4px 12px 4px 4px;
                gap: 6px;
            }
        }

        & > .icon-group {
            gap: 8px;
        }

        & > .settings-mobile {
            display: none;

            @media (max-width: 600px) {
                width: 44px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
        }

        .select-space {
            @media (max-width: 600px) {
                & > .caption {
                    .desc {
                        font-size: 12px;
                        max-width: 62px !important;
                    }

                    .expand {
                        display: none !important;
                    }
                }
            }
        }

        & > .exhibit-picture {
            border-radius: var(--studio-radius-control);
            width: 40px;
            height: 28px;

            @media (max-width: 600px) {
                width: 24px;
                height: 24px;
                min-width: 24px;
                min-height: 24px;
                border-radius: 3px;
            }
        }

        &.right {
            align-items: middle;
        }
    }

    & .vert {
        display: flex;
        flex-direction: column;
    }

    & .left {
        justify-content: flex-start;
        gap: 8px;

        @media (max-width: 600px) {
            gap: 6px;
        }
    }

    & .center {
        justify-content: center;
        max-width: min(360px, 32vw);
    }

    & .right {
        justify-content: flex-end;
        gap: 8px;

        @media (max-width: 600px) {
            gap: 6px;
        }
    }

    & .y-scroll {
        overflow-y: auto;
        overflow-x: hidden;
        // grid-auto-rows: 1fr;

        &::-webkit-scrollbar {
            width: 0 !important;
        }

        &::-webkit-scrollbar-thumb {
            border-radius: 8px;
            background: #999999;
        }
    }
`;
