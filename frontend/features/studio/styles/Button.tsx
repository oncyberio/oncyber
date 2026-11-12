import styled, { css } from "styled-components";
import { studioAction, studioFocus } from "./primitives";

export const Button = styled.button<{ primary?: boolean }>`
    ${studioAction}
    margin: 0;
    white-space: nowrap;
    background: var(--studio-surface, #222222);
    border-color: var(--studio-line);
    box-shadow: var(--studio-edge);
    ${(props) =>
        props.primary &&
        css`
            color: var(--studio-bg, #141416);
            background: var(--studio-ink, #f2f2f3);
            &:hover:not(:disabled) {
                background: #fff;
            }
        `}
`;

export const IconBtn = styled.button`
    appearance: none;
    background: none;
    border: 0;
    margin: 0;
    padding: 0;
    border-radius: var(--studio-radius-control);
    color: var(--studio-ink, #f2f2f3);
    cursor: pointer;
    ${studioFocus}
    &:disabled {
        cursor: not-allowed;
        opacity: 0.4;
    }
`;
