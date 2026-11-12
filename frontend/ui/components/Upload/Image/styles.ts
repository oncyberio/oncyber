import { Theme } from "@ui/types";
import styled, { css } from "styled-components";

export type StyledCoverImageProps = {
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

export const StyledCoverImage = styled.div<StyledCoverImageProps>`
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

    ${({ url, background, overrideTheme }) =>
        url
            ? css`
                  background: url(${url});
                  background-size: cover;
                  background-repeat: no-repeat;
                  background-position: center;
              `
            : css`
                  background: ${({ theme }) =>
                      background
                          ? background
                          : (overrideTheme ? overrideTheme : theme.type) ===
                            "light"
                          ? "#F5F5F5"
                          : "#000"};
              `};

    & > span {
        display: flex;
        align-items: center;
        justify-content: center;
        /* width: 35px;
        height: 35px; */
        padding: 8px;
        border-radius: 999px;
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

StyledCoverImage.defaultProps = {
    width: "436px",
    height: "80px",
    padding: "0px",
    margin: "0px",
    borderRadius: "6px",
};
