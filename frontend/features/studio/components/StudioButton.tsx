import { NButton as BaseButton } from "@ui/components/NButton";
import styled from "styled-components";
import { studioAction } from "../styles/primitives";

// Keep the existing button API while giving studio actions explicit local styling.
export const NButton = styled(BaseButton).attrs({ type: "button" })`
    ${studioAction}
    background: ${({ outline }) =>
        outline ? "transparent" : "var(--studio-ink, #f2f2f3)"};
    color: ${({ outline }) =>
        outline ? "var(--studio-ink, #f2f2f3)" : "var(--studio-bg, #141416)"};
    border-color: ${({ outline }) =>
        outline ? "var(--studio-line, #303035)" : "transparent"};
    &:hover:not(:disabled) {
        background: ${({ outline }) =>
            outline ? "var(--studio-hover, #28282c)" : "#fff"};
        border-color: transparent;
    }
    &:disabled {
        background: var(--studio-surface);
        color: var(--studio-muted);
        border-color: transparent;
    }
    *:first-child {
        margin-right: 0;
    }
`;
