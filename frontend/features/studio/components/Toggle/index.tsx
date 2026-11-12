import React from "react";
import styled, { css } from "styled-components";

export function Toggle({
    disabled = false,
    value,
    onChange,
    isLight = false,
    label = "Toggle setting",
}) {
    const handleClick = () => {
        if (!disabled) onChange(!value);
    };

    return (
        <ToggleContainer
            type="button"
            role="switch"
            aria-label={label}
            aria-checked={value}
            toggled={value}
            disabled={disabled}
            onClick={handleClick}
            isLight={isLight}
        >
            <div className="toggle-circle" />
        </ToggleContainer>
    );
}

const ToggleContainer = styled.button<{
    toggled: boolean;
    disabled: boolean;
    isLight: boolean;
}>`
    appearance: none;
    border: 0;
    flex-shrink: 0;
    display: inline-block;
    &:focus-visible {
        outline: 2px solid var(--studio-ink);
        outline-offset: 4px;
    }
    border-radius: 25px;
    background-color: ${({ toggled }) =>
        toggled ? "var(--studio-ink)" : "var(--studio-line-strong)"};

    ${(props) =>
        props.isLight
            ? css`
                  background-color: ${props.toggled ? "#070707" : "#C2C2C2"};
              `
            : ""}

    padding: 3px;
    height: 20px;
    min-width: 35px;
    transition: background-color 0.3s;
    cursor: pointer;

    ${(props) =>
        props.disabled
            ? css`
                  pointer-events: none;
                  opacity: 0.5;
              `
            : ""}

    & > .toggle-circle {
        height: 14px;
        width: 14px;
        border-radius: 50%;
        background-color: ${({ toggled }) =>
            toggled ? "var(--studio-panel)" : "var(--studio-ink)"};

        ${(props) =>
            props.isLight
                ? css`
                      background-color: #ffffff;
                  `
                : ""}

        transform: translate(${({ toggled }) => (toggled ? "15px" : "0px")});
        transition: transform 0.3s;
    }
`;
