import { Theme } from "@ui/types";
import styled from "styled-components";

export type StyledTagProps = {
    width?: string;
    height?: string;
    color?: string;
    dotSize?: string;
    dotColor?: string;
    padding?: string;
    fontSize?: string;
    background?: string;
    overrideTheme?: Theme;
    borderRadius?: string;
};

export const StyledTag = styled.span<StyledTagProps>`
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 400;
    width: ${({ width }) => width};
    padding: ${({ padding }) => padding};
    height: ${({ height }) => height};
    font-style: "normal";
    font-size: ${({ fontSize }) => fontSize};
    border-radius: ${({ borderRadius }) => borderRadius};
    color: ${({ theme, color, overrideTheme }) =>
        color
            ? color
            : (overrideTheme ? overrideTheme : theme.type) === "light"
            ? "#000"
            : "#fff"};
    background: ${({ theme, background, overrideTheme }) =>
        background
            ? background
            : (overrideTheme ? overrideTheme : theme.type) === "light"
            ? "#fff"
            : "#000"};

    & > span {
        margin-top: 2px;
        margin-left: 3px;
        border-radius: 50%;
        width: ${({ dotSize }) => dotSize};
        height: ${({ dotSize }) => dotSize};
        background-color: ${({ dotColor }) => dotColor};
    }
`;

StyledTag.defaultProps = {
    width: "59px",
    height: "20px",
    dotSize: "5px",
    fontSize: "10px",
    padding: "10px 4px",
    borderRadius: "4px",
    dotColor: "#FFFFFF",
};
