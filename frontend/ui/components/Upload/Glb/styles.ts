import { Theme } from "@ui/types";
import styled, { css } from "styled-components";

export type StyledFileProps = {
    overrideTheme?: Theme;
    display?: "row" | "column";
};

export const StyledFile = styled.div<StyledFileProps>`
    height: 100%;
    height: 240px;
    display: flex;
    background: #fff;
    border-radius: 6px;
    box-sizing: border-box;
    border: 1px solid #e0e0e0;

    ${({ display }) =>
        display === "row"
            ? css`
                  padding: 16px;
                  flex-direction: row;
                  justify-content: space-evenly;
              `
            : css`
                  align-items: center;
                  flex-direction: column;
                  justify-content: center;
              `}

    & > div {
    }
`;

export const StyledWrapper = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;

    & > span.hr {
        width: 140px;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;

        div {
            color: #070707;
            font-weight: 400;
            font-size: 14px;
            line-height: 26px;

            &:first-child,
            &:last-child {
                flex: 1;
                position: relative;

                &:before {
                    content: " ";
                    top: 50%;
                    left: 0px;
                    right: 0px;
                    height: 1px;
                    position: absolute;
                    background-color: #1d1d1d;
                }
            }

            &:first-child {
                margin-right: 20px;
            }

            &:last-child {
                margin-left: 20px;
            }
        }
    }

    & > p {
        padding: 0 !important;
        font-style: normal;
        font-weight: 400;
        font-size: 18px;
        line-height: 18px;
        letter-spacing: -0.02em;
        color: #070707;

        @media (max-width: 800px) {
            font-size: 16px;
        }

        &.file {
            font-weight: 500;
            font-size: 14px;
            line-height: 24px;
            color: #070707;

            @media (max-width: 800px) {
                font-size: 12px;
            }
        }

        & > b {
            font-weight: 600;
            color: #070707;
        }
    }

    & > button {
        margin-top: 15px;
        background: transparent;
        border: 1px solid #1d1d1d;
        border-radius: 50px;
        font-style: normal;
        font-weight: 500;
        font-size: 14px;
        text-align: center;
        color: #070707;
        width: 120px;
        height: 40px;

        @media (max-width: 800px) {
            font-size: 12px;
        }
    }
`;

export const ProgressContainer = styled.div`
    width: 100%;
    height: 8px;
    display: flex;
    position: relative;
    background: #e0e0e0;
    border-radius: 900px;
    margin-bottom: 30px;
    flex-direction: column;

    & > span {
        font-weight: 400;
        font-size: 15px;
        line-height: 64px;
        text-align: center;
        color: #999999;

        @media (max-width: 800px) {
            font-size: 13px;
        }
    }

    & > a {
        font-weight: 400;
        font-size: 12px;
        text-align: center;
        color: #999999;
        line-height: 64px;
        cursor: pointer;
        text-decoration: underline;

        @media (max-width: 800px) {
            font-size: 10px;
        }
    }
`;

StyledFile.defaultProps = {
    display: "column",
};
