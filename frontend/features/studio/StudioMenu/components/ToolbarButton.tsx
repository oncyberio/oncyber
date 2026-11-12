import styled, { css } from "styled-components";
import { studioAction } from "../../styles/primitives";
import { blueAction } from "@styles/brand";

export const ToolbarButton = styled.button.attrs({ type: "button" })<{
    hasLabel?: boolean;
    faded?: boolean;
    toggled?: boolean;
    disabled?: boolean;
    $primary?: boolean;
}>`
    ${studioAction}
    position: relative;
    flex-shrink: 0;
    width: 38px;
    height: 38px;
    padding: 0;
    border: 0;
    color: var(--studio-muted, #a1a1a8);
    user-select: none;
    &:hover {
        color: var(--studio-ink);
    }
    ${(props) =>
        props.hasLabel &&
        css`
            width: auto;
            padding: 0 8px;
            gap: 10px;
            color: var(--studio-ink);
        `}
    ${(props) =>
        props.toggled &&
        css`
            background: var(--studio-hover, #28282c);
            color: var(--studio-ink, #f2f2f3);
        `}
    @media (max-width: 600px) {
        width: ${(props) => (props.hasLabel ? "auto" : "44px")};
        height: 44px;
        min-height: 44px;
    }
    ${(props) =>
        props.$primary &&
        css`
            padding: 0 16px;
            border-radius: 999px;
            ${blueAction}
        `}
`;

export const ToolbarButtonLabel = styled.span`
    font: 13px/20px var(--studio-font, sans-serif);
    color: inherit;
    white-space: nowrap;
`;
