import styled from "styled-components";

export const IconButton = styled.button<{
    size: string;
    highlight?: boolean;
}>`
    display: flex;
    align-items: center;
    justify-content: center;
    width: ${(props) => props.size};
    height: ${(props) => props.size};
    border: 1px solid;
    border-color: ${({ theme, highlight }) =>
        highlight ? theme.color : theme.border.color};
    background-color: ${({ theme }) => theme.background};
    border-radius: 50%;
    cursor: pointer;

    & svg,
    & img {
        filter: invert(${(props) => 1 - props.theme.filters.invert});
    }
`;
