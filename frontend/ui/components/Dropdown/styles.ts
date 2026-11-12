import { Theme } from "@ui/types";
import styled from "styled-components";

export type StyledDropdownProps = {
    width?: string;
    height?: string;
    color?: string;
    margin?: string;
    padding?: string;
    fontSize?: string;
    isHidden?: boolean;
    background?: string;
    borderColor?: string;
    borderRadius?: string;
    dropdownIconPosition?: "inline" | "right";
    overrideTheme?: Theme;
};

export const StyledDropdown = styled.div<StyledDropdownProps>`
    display: flex;
    cursor: pointer;
    position: relative;
    width: ${({ width }) => width};
    height: ${({ height }) => height};
    margin: ${({ margin }) => margin};
    padding: ${({ padding }) => padding};
    border-radius: ${({ borderRadius }) => borderRadius};
    background: ${({ theme, background, overrideTheme }) =>
        background
            ? background
            : (overrideTheme ? overrideTheme : theme.type) === "light"
            ? "#fff"
            : "#212127"};
    border: 1px solid
        ${({ theme, borderColor, overrideTheme }) =>
            borderColor
                ? borderColor
                : (overrideTheme ? overrideTheme : theme.type) === "light"
                ? "#DFDFE4"
                : "#393B45"};
    color: ${({ color, theme, overrideTheme }) =>
        color
            ? color
            : (overrideTheme ? overrideTheme : theme.type) === "light"
            ? "#27282C"
            : "#C0C0C6"};

    span {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        margin-right: 8px;
    }

    & > .label {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: ${(props) =>
            props.dropdownIconPosition === "right"
                ? "space-between"
                : "flex-start"};
        font-weight: 400;
        line-height: 24px;
        font-style: normal;
        position: relative;
        max-height: ${({ height }) => height};
        font-size: ${({ fontSize }) => fontSize};
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    & > ul {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: flex-start;
        overflow-y: auto;
        z-index: 10;
        padding: 10px;
        width: 100%;
        left: 0rem;
        top: 1.638rem;
        list-style: none;
        position: absolute;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
            0 4px 6px -2px rgba(0, 0, 0, 0.05);
        border-radius: ${({ borderRadius }) => borderRadius};
        ${({ isHidden }) => isHidden && "display: none !important"};
        background: ${({ theme, background, overrideTheme }) =>
            background
                ? background
                : (overrideTheme ? overrideTheme : theme.type) === "light"
                ? "#fff"
                : "#212127"};

        &::-webkit-scrollbar {
            width: 5px !important;
        }

        &::-webkit-scrollbar-thumb {
            border-radius: 8px;
            background: ${({ theme, background, overrideTheme }) =>
                background
                    ? background
                    : (overrideTheme ? overrideTheme : theme.type) === "light"
                    ? "#B3B6B7"
                    : "#333333"};
        }

        & > li {
            width: 100%;
            padding: 10px 0px;
            font-weight: 400;
            line-height: 24px;
            font-style: normal;
            position: relative;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    }
`;

StyledDropdown.defaultProps = {
    width: "170px",
    height: "40px",
    isHidden: true,
    fontSize: "14px",
    borderRadius: "6px",
    padding: "0px 12px",
};
