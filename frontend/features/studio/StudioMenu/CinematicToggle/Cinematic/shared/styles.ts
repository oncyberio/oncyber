import {
    studioAction,
    studioHeading,
} from "@features/studio/styles/primitives";
import styled from "styled-components";

export const Container = styled.div<{ hasBackground?: boolean }>`
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    flex-direction: column;
    justify-content: flex-start;
    background: ${({ hasBackground }) =>
        hasBackground ? "var(--bg-color)" : "transparent"};

    @media (max-height: 920px) {
        & > .tags {
            display: none;
        }

        & .header {
            border-bottom: none;
        }
    }
`;

export const Header = styled.div`
    width: 100%;
    height: 80px;
    display: flex;
    background: var(--bg-color);
    color: var(--color);
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid var(--border-color);

    @media (max-width: 830px) {
        border-top-left-radius: 0px;
        border-top-right-radius: 0px;
    }

    & > h1 {
        ${studioHeading}
        text-align: center;
        color: var(--color);
        padding: 10px;
    }
`;

export const Footer = styled.div`
    width: 100%;
    display: flex;
    height: 70px;
    padding: 10px 20px;
    margin: 13px 20px 20px 20px;
    align-items: center;
    justify-content: center;
    gap: 8px;

    @media (max-height: 920px) {
        padding: 0 20px;
    }

    & > button {
        ${studioAction}
        span {
            text-align: center;
            margin: 0;
        }

        &.cancel {
            width: 150px;
            justify-content: center;
            background: transparent;
            color: var(--color-sec);
            border: 1px solid var(--studio-line);

            &:hover {
                color: var(--color);
                border-color: var(--color);
            }
        }

        &.cancel:disabled {
            cursor: progress;
            color: var(--color-label);
        }

        &.download {
            width: 150px;
            text-align: center;

            &:disabled {
                background-color: #ffffff;
                border: 1px solid #ffffff;
                color: var(--bg-color);
                opacity: 0.3;
                cursor: not-allowed;
            }
        }
    }
`;
