import styled, { css } from "styled-components";

export const ModalContainer = styled.div`
    display: flex;
    flex-wrap: wrap;
    border-radius: 8px;
    flex-direction: row;
    align-items: center;
    padding: 22px 10px 22px 10px;
    justify-content: space-between;
`;

export const PanelContainer = styled.div<{
    currentTab: string;
    isModeSolo?: boolean;
    isHidden?: boolean;
}>`
    width: auto;
    height: 60px;
    color: #fff;
    display: flex;
    border-radius: 8px;
    position: relative;
    padding: 12px 16px;
    align-items: center;
    visibility: visible;
    justify-content: center;
    gap: 8px;

    & > .chat-btn {
        display: none;

        @media (max-width: 760px) {
            display: flex;
        }
    }

    @media (max-width: 1092px) {
        ${(props) =>
            props.isHidden &&
            css`
                display: none;
            `}
    }

    @media (max-width: 830px) {
        min-width: 100%;

        ${({ isModeSolo }) => {
            return isModeSolo
                ? css`
                      justify-content: center;
                  `
                : css`
                      margin-bottom: 5px;
                      justify-content: space-between;
                  `;
        }}

        ${({ currentTab }) => {
            return (
                currentTab === "settings" &&
                css`
                    visibility: hidden;
                `
            );
        }}
    }

    @media (max-width: 500px) {
        height: 64px;
    }
`;

export const ControlPanelIcon = styled.div<{
    isMobile: boolean;
}>`
    position: relative;
    display: flex;
    align-items: center;
    outline: none;

    -webkit-tap-highlight-color: transparent;

    & > .btn-right-subtract-panel {
        position: absolute;
        bottom: -1px;
        right: -1px;
        z-index: 10000000000;

        & > img {
            margin-top: 10px;
        }
    }

    & > .text-right-subtract-panel {
        position: absolute;
        bottom: -3px;
        right: -3px;
        z-index: 10000000000;
        display: flex;
        justify-content: center;
        align-items: center;
        width: 30px;
        height: 22px;
        background: rgba(7, 7, 7, 0.6);
        border-radius: 9999px;

        & > .dot {
            width: 4px;
            height: 4px;
            background: #2cf8d5;
            border-radius: 50%;
            margin-right: 2px;
            margin-top: 1px;
        }

        & > .red {
            background: #ff6161;
        }

        & > span {
            font-weight: 600;
            font-size: 10px;
            line-height: 24px;
            color: #f5f5f5;
        }
    }

    transition: 0.3s all ease;

    & > span {
        left: 50%;
        color: #fff;
        padding: 5px 10px;
        background: #27282c;
        position: absolute;
        font-size: 12px;
        border-radius: 4px;
        white-space: nowrap;
        z-index: 0;
        visibility: hidden;
        opacity: 0;
        top: -10px;
        pointer-events: none;
        transform: translateX(-50%);
        transition: 0.3s all ease;

        span {
            color: #b0b0b0;
            border-bottom-left-radius: 0;
            border-top-left-radius: 0;
        }

        ${({ isMobile }) => {
            return (
                isMobile &&
                css`
                    display: none;
                `
            );
        }}
    }

    &:focus {
        outline: none;
    }

    &:hover {
        transform: scale(1.05);
        & > span {
            visibility: visible;
            opacity: 1;
            top: -36px;
        }
    }
    ${({ isClicked }) =>
        isClicked &&
        css`
            & > span {
                visibility: hidden;
                opacity: 0;
                top: -10px;
            }
        `}
`;
