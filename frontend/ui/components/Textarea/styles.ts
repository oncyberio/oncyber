import { TextareaHTMLAttributes } from "react";
import styled from "styled-components";
import { Theme } from "@ui/types";

export interface StyledTextareaProps
    extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    width?: string;
    height?: string;
    color?: string;
    padding?: string;
    fontSize?: string;
    background?: string;
    borderColor?: string;
    borderRadius?: string;
    overrideTheme?: Theme;
}

export const StyledTextarea = styled.textarea<StyledTextareaProps>`
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    outline: none;
    resize: none;
    font-weight: 400;
    line-height: 24px;
    font-style: "normal";
    width: ${({ width }) => width};
    padding: 7px 12px;
    height: ${({ height }) => height};
    font-size: ${({ fontSize }) => fontSize};
    border-radius: ${({ borderRadius }) => borderRadius};
    border-color: ${({ theme, borderColor, overrideTheme }) =>
        borderColor
            ? borderColor
            : (overrideTheme ? overrideTheme : theme.type) === "light"
            ? "#DFDFE4"
            : "#393B45"};
    color: ${({ theme, color, overrideTheme }) =>
        color
            ? color
            : (overrideTheme ? overrideTheme : theme.type) === "light"
            ? "#99999F"
            : "#F0F2FD"};
    background: ${({ theme, background, overrideTheme }) =>
        background
            ? background
            : (overrideTheme ? overrideTheme : theme.type) === "light"
            ? "#fff"
            : "#212127"};

    border-width: 1px;
    filter: blur(0);
    @media (max-width: 800px) {
        font-size: 12px;
    }

    &:focus {
        border: 1px solid #070707;
        padding: 6px 11px;
    }

    &.shadow {
        background: none;
        border: 1px solid #ffffff80;
        color: #fff;

        &::placeholder {
            color: #ffffff80;
        }
    }
`;

StyledTextarea.defaultProps = {
    width: "100%",
    height: "76px",
    fontSize: "14px",
    padding: "7px 12px",
    borderRadius: "6px",
};
