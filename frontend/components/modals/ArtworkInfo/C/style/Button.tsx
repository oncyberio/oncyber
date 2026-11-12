import styled from "styled-components";

export const Button = styled.button<{
    primary?: boolean;
    condensed?: boolean;
    strong?: boolean;
}>`
    color: ${({ theme }) => theme.color};
    background-color: ${({ theme }) => theme.background};
    border: 1px solid;
    border-color: ${({ strong, theme }) =>
        strong ? theme.button.border.strong : theme.button.border.light};
    padding: ${(props) => (props.condensed ? "8px 16px" : "16px 24px")};
    font-size: 16px;
    font-weight: 500;
    border-radius: 200px;
    cursor: pointer;

    ${(props) => (props.primary ? "filter: invert(100%);" : "")}
`;

export const IconButton = styled.button<{
    size: string;
    primary?: boolean;
    condensed?: boolean;
    strong?: boolean;
}>`
    width: ${(props) => props.size};
    height: ${(props) => props.size};
    border: 1px solid;
    border-color: ${({ strong, theme }) =>
        strong ? theme.button.border.strong : theme.button.border.light};
    background-color: ${({ theme }) => theme.background};
    border-radius: 50%;
    cursor: pointer;

    & svg,
    & img {
        filter: invert(${(props) => 1 - props.theme.filters.invert});
    }
`;
