import { Theme } from "@ui/types";
import styled, { css } from "styled-components";

export type StyledSwitchProps = {
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
    innerBorderRadius?: string;
};

export const StyledSwitch = styled.span<StyledSwitchProps>`
    display: flex;
    font-weight: 400;
    cursor: pointer;
    align-items: center;
    font-style: "normal";
    //backdrop-filter: blur(20px);
    justify-content: center;
    width: ${({ width }) => width};
    height: ${({ height }) => height};
    padding: ${({ padding }) => padding};
    background: ${({ background }) => background};
    border-radius: ${({ borderRadius }) => borderRadius};
`;

export const StyledButton = styled.div<{
    isActive: boolean;
    fontSize?: string;
    innerBorderRadius?: string;
}>`
    width: 100%;
    height: 100%;
    display: flex;
    cursor: pointer;
    font-weight: 500;
    line-height: 100%;
    text-align: center;
    align-items: center;
    letter-spacing: 0.16px;
    justify-content: center;
    font-size: ${({ fontSize }) => fontSize};

    @media (max-width: 830px) {
        font-size: 14px;
    }

    :first-child {
        margin-right: 2px;
    }

    ${(props) =>
        props?.isActive
            ? css`
                  color: #070707;
                  border-radius: ${({ innerBorderRadius }) =>
                      innerBorderRadius};
                  background: #ffffff;
              `
            : css`
                  color: #ffffff;
              `}
`;

StyledButton.defaultProps = {
    innerBorderRadius: "8px",
};

StyledSwitch.defaultProps = {
    width: "100%",
    height: "50px",
    padding: "4px",
    borderRadius: "8px",
};
