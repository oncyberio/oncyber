import { Theme } from "@ui/types";
import styled, { css } from "styled-components";

export type StyledWrapperProps = {
    width?: string;
    height?: string;
    icon?: boolean;
    iconPosition?: "left" | "right";
    staticText?: string;
    borderColor?: string;
    overrideTheme?: Theme;
    borderWidth?: string;
    focused?: boolean;
};

export const StyledWrapper = styled.div<StyledWrapperProps>`
    display: flex;
    border-radius: 5px;
    position: relative;
    align-items: center;
    width: ${({ width }) => width};
    height: ${({ height }) => height};
    border-width: ${({ borderWidth }) => borderWidth};
    border-style: solid;
    border-color: ${({ theme, borderColor, overrideTheme }) =>
        borderColor
            ? borderColor
            : (overrideTheme ? overrideTheme : theme.type) === "light"
            ? "#DFDFE4"
            : "#393B45"};

    border-radius: 5px;

    ${({ focused, borderColor, borderWidth }) => {
        return (
            focused &&
            css`
                border-width: ${borderWidth}px;
                border-color: ${borderColor || "#000"};
            `
        );
    }}

    & > .icon {
        position: absolute;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        ${({ iconPosition }) =>
            iconPosition === "left" ? "left: 10px" : "right: 10px"};
    }
`;

StyledWrapper.defaultProps = {
    width: "100%",
    height: "40px",
    icon: false,
    iconPosition: "left",
    borderWidth: "1px",
};

export type StyledInputProps = {
    color?: string;
    icon?: boolean;
    padding?: string;
    fontSize?: string;
    background?: string;
    borderColor?: string;
    borderRadius?: string;
    overrideTheme?: Theme;
    iconPosition?: "left" | "right";
    staticText?: string;
    ref?: any;
};

export const StypedInput = styled.input<StyledInputProps>`
    position: relative;
    width: 100%;
    height: 100%;
    font-weight: 400;
    line-height: 24px;
    font-style: "normal";
    outline: none;
    box-sizing: border-box;
    background: transparent;
    padding: ${({ padding }) => padding};
    // border-width: 1px;

    &:focus {
        // border: 2px solid #070707;
        // padding: 6px 11px;
    }

    &:disabled {
        background: #ececec;
    }

    border: none;

    ${({ type }) =>
        type === "date"
            ? css`
                  &::-webkit-calendar-picker-indicator {
                      width: 20px;
                      height: 20px;
                      background: url("/icons/date-icon.svg") no-repeat center;
                  }
              `
            : type === "time"
            ? css`
                  &::-webkit-calendar-picker-indicator {
                      width: 20px;
                      height: 20px;
                      background: url("/icons/time-icon.svg") no-repeat center;
                  }
              `
            : ""};

    ${({ staticText }) => {
        return (
            staticText &&
            css`
                border-bottom-left-radius: 0;
                border-top-left-radius: 0;
            `
        );
    }}

    ${({ icon, iconPosition }) =>
        icon
            ? iconPosition === "left"
                ? "padding-left:40px;"
                : "padding-right:40px;"
            : ""};

    font-size: ${({ fontSize }) => fontSize};

    @media (max-width: 800px) {
        font-size: 12px;
    }

    border-radius: ${({ borderRadius }) => borderRadius};
    color: ${({ theme, color, overrideTheme }) =>
        color
            ? color
            : (overrideTheme ? overrideTheme : theme.type) === "light"
            ? "#000000"
            : "#8A94A6"};
    background: ${({ theme, background, overrideTheme }) =>
        background
            ? background
            : (overrideTheme ? overrideTheme : theme.type) === "light"
            ? "#fff"
            : "#212127"};

    &.shadow {
        background: none;
        // border: 1px solid #ffffff80;
        color: #fff;

        &::placeholder {
            color: #ffffff80;
        }
    }
`;

export const StaticText = styled.div`
    background: #f5f5f5;
    font-weight: 500;
    font-size: 14px;
    line-height: 24px;
    color: #18191c;
    padding: 7px 12px;
    border-bottom-left-radius: 5px;
    border-top-left-radius: 5px;
    // border: 1px solid #dfdfe4;
    border-right: none;
    height: 100%;
    display: flex;
    align-items: center;
`;

StypedInput.defaultProps = {
    fontSize: "14px",
    padding: "7px 12px",
    borderRadius: "6px",
};
