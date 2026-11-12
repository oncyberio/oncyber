import styled from "styled-components";

export const DropdownHeader = styled.div`
    font-family: var(--studio-font, sans-serif);
    font-weight: 400;
    font-size: 12px;
    line-height: 24px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--studio-muted, #a1a1a8);

    padding-bottom: 10px;
    border-bottom: 1px solid var(--studio-line);
`;

export const DropdownItem = styled.div<{ isSelected: boolean }>`
    display: flex;
    flex-direction: row;
    gap: 12px;
    align-items: center;
    justify-content: flex-start;
    cursor: pointer;

    & > .title {
        font-weight: 500;
        font-size: 13px;
        line-height: 20px;
        color: ${(props) =>
            props.isSelected ? "var(--studio-ink)" : "var(--studio-muted)"};
        flex: 1;
        white-space: nowrap;
    }

    & > .radio {
        margin-left: auto;
    }
`;
