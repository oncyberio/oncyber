import styled from "styled-components";

export const IconGroup = styled.div<{ width?: number }>`
    outline: 0;
    width: 95px;
    opacity: 0.6;
    height: 100%;
    display: flex;
    cursor: pointer;
    align-items: center;
    flex-direction: column;
    justify-content: center;
    padding: 20px 5px;

    @media (max-width: 830px) {
        width: 75px;
    }

    & > button.btn-menu {
        border: none !important;
        background: transparent;

        &:hover {
            background: transparent !important;
        }
    }

    &:hover {
        opacity: 1;
        height: 100%;
        background: #070707;
    }

    & > span {
        font-weight: 500;
        font-size: 11px;
        line-height: 20px;
        color: #ffffff;
        white-space: nowrap;
        margin-top: 2px;

        &.voice-request-wrapper {
            display: flex;
            align-items: center;
            justify-content: flex-start;
        }
    }
`;
