import styled from "styled-components";
import { actionSpec, pillAction } from "@styles/brand";
import { actionTokens as action } from "@styles/tokens/action";

/**
 * Legacy pill button, on the shared action spec (type, border, height and
 * padding; see `actionSpec`). By default it is the solid white action for
 * dark surfaces. `isLight` is the black button for light pages.
 */
export const RoundButton = styled.button<{
    isLight?: boolean;
    background?: string;
}>`
    display: flex;
    align-items: center;
    justify-content: center;
    width: auto;
    ${actionSpec}
    ${pillAction}
    /* A height, not a minimum: call sites set their own smaller heights. */
    min-height: auto;
    height: ${action.size.minHeight}px;
    border-color: ${({ isLight, background }) =>
        background || isLight ? "#fff" : action.white.fill};
    background: ${({ isLight, background }) =>
        background ? background : isLight ? "#000" : action.white.fill};
    color: ${({ isLight, color }) =>
        color ? color : isLight ? "#fff" : action.white.ink};
    cursor: pointer;
    -webkit-touch-callout: none; /* iOS Safari */
    -webkit-user-select: none; /* Safari */
    -khtml-user-select: none; /* Konqueror HTML */
    -moz-user-select: none; /* Old versions of Firefox */
    -ms-user-select: none; /* Internet Explorer/Edge */
    user-select: none;

    img {
        margin-left: 8px;
        filter: ${({ isLight }) => (isLight ? "invert(1)" : "filter(0)")};
    }

    transition: 0.2s;

    &:hover {
        opacity: 0.6;
    }

    &:focus-visible {
        outline: ${action.state.focusWidth}px solid ${action.state.focusRing};
        outline-offset: ${action.state.focusOffset}px;
    }

    &:disabled {
        cursor: not-allowed;
        ${({ isLight, background }) =>
            background || isLight
                ? "color: #ffffff; background: #e0e0e0;"
                : `opacity: ${action.state.disabledOpacity};`}
    }

    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }
`;

export const SelectButton = styled.button<{
    isLight?: boolean;
    isActive: any;
}>`
    display: flex;
    align-items: center;
    justify-content: center;
    width: auto;
    padding: 10px 40px;
    border-radius: 48px;
    height: 35px;
    font-size: 14px;
    font-weight: 500;
    background: transparent;
    outline: none;

    border: 1px solid ${({ isLight }) => (isLight ? "#000" : "#fff")};
    color: ${({ isLight }) => (isLight ? "#000" : "#fff")};
    cursor: pointer;
    opacity: ${({ isActive }) => (isActive ? "1" : "0.4")};

    img {
        margin-left: 12px;
        filter: ${({ isLight }) => (isLight ? "invert(1)" : "filter(0)")};
    }
`;
