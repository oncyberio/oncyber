import styled from "styled-components";
import DefaultDropdown from "@ui/components/Dropdown";

export const ComboBox = styled(DefaultDropdown)`
    width: 100%;
    height: 40px;
    padding: 0 12px;
    margin: 0;
    border-radius: var(--studio-radius-control);
    background: var(--studio-inset);
    border: 1px solid var(--studio-line);

    & ul {
        display: flex;
        flex-direction: column;
        padding: 0 12px;
        max-height: 180px;
        overflow-y: auto;
        background: var(--studio-inset);

        & li {
            padding: 6px 0;
            min-height: 36px;
            user-select: none;
        }
    }

    & li:hover {
        background: var(--studio-hover);
        color: var(--studio-ink);
    }

    span {
        font-weight: 400;
        font-size: 13px;
        color: var(--studio-secondary);
        line-height: 24px;
        user-select: none;
    }

    svg {
        position: absolute;
        right: 0px;
    }
`;
