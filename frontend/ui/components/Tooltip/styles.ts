import styled, { css } from "styled-components";

export type StyledTooltipProps = {
    width?: string;
    color?: string;
    height?: string;
    padding?: string;
    isToggled?: boolean;
    background?: string;
    borderRadius?: string;
    size?: "medium" | "small";
    orientation?: "left" | "right" | "top" | "bottom";
    variant?: "panel" | "solid-dark";
};

export const Container = styled.div<StyledTooltipProps>`
    z-index: 100000;
    padding: 10px 12px;
    white-space: nowrap;
    font-family: var(--studio-font, Aeonik);
    font-size: var(--studio-tooltip-size, 11px);
    text-align: center;
    position: fixed;
    border-radius: var(--radius-panel-sm);
    color: ${({ color }) => color};

    ${({ variant }) =>
        variant === "solid-dark"
            ? css`
                  background: #191919;
                  backdrop-filter: blur(20px);
              `
            : css`
                  background: var(--panel-bg);
                  border: var(--panel-border);
                  box-shadow: var(--panel-shadow);
              `}
`;

Container.defaultProps = {
    size: "small",
    color: "var(--panel-text-primary)",
    variant: "panel",
};
