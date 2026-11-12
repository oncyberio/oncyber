import styled from "styled-components";
import { Horz, Vert } from "./Flex";

export const Tabs = styled(Vert)`
    flex: 1;
    height: 100%;
    width: 100%;
`;

export const Headers = styled(Horz)`
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    flex: 0;
    /* margin-bottom: 0.5em; */
`;

export const Content = styled(Vert)`
    flex: 1;
    align-items: stretch;
    justify-content: flex-start;
`;

export const Header = styled.button.attrs({ type: "button" })<{
    active: boolean;
    hide?: boolean;
}>`
    display: ${({ hide }) => (hide ? "none" : "inline-flex")};
    align-items: center;
    justify-content: center;
    min-height: 36px;
    padding: 8px 12px;
    border: 0;
    border-radius: 8px;
    background: ${({ active }) =>
        active ? "var(--oc-surface, transparent)" : "transparent"};
    font: inherit;
    font-size: 13px;
    white-space: nowrap;
    cursor: pointer;
    font-weight: ${({ active }) => (active ? 500 : 400)};
    color: ${({ active, theme }) =>
        active ? theme.color : theme.tab.header.color};
    &[hidden] {
        display: none;
    }
    &:hover {
        color: var(--oc-ink, inherit);
        background: var(--oc-hover, transparent);
    }
    &:focus-visible {
        outline: 2px solid var(--oc-accent, currentColor);
        outline-offset: -2px;
    }
`;
