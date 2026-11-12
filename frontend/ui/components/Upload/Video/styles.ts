import { Theme } from "@ui/types";
import styled, { css } from "styled-components";

export type StyledVideoProps = {
    url?: string;
    width?: string;
    height?: string;
    color?: string;
    padding?: string;
    margin?: string;
    background?: string;
    borderRadius?: string;
    overrideTheme?: Theme;
};

export const StyledVideo = styled.div<StyledVideoProps>`
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 400;
    position: relative;
    width: ${({ width }) => width};
    padding: ${({ padding }) => padding};
    margin: ${({ margin }) => margin};
    height: ${({ height }) => height};
    border-radius: ${({ borderRadius }) => borderRadius};
    color: ${({ theme, color, overrideTheme }) =>
        color
            ? color
            : (overrideTheme ? overrideTheme : theme.type) === "light"
            ? "#000"
            : "#fff"};

    ${({ background, overrideTheme }) =>
        css`
            background: ${({ theme }) =>
                background
                    ? background
                    : (overrideTheme ? overrideTheme : theme.type) === "light"
                    ? "#F5F5F5"
                    : "#000"};
        `}

    & > .animation {
        top: 0;
        left: 0;
        height: 100%;
        min-width: 100%;
        position: absolute;
        object-fit: cover;
        overflow: hidden;
        filter: blur(0px);
        border-radius: ${({ borderRadius }) => borderRadius};
    }

    & > span {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 8px;
        border-radius: 999px;
        z-index: 999;
        cursor: pointer;
        background: #ffffff;

        ${({ url, background }) =>
            url &&
            css`
                border: 1px solid #fff;
            `};
    }
`;

export const Area = styled.div`
    position: absolute;
    width: 100%;
    cursor: pointer;
    height: 100%;
`;

StyledVideo.defaultProps = {
    width: "436px",
    height: "80px",
    padding: "0px",
    margin: "0px",
    borderRadius: "6px",
};
