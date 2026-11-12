import styled from "styled-components";

export const Horz = styled.div<{ gap?: string }>`
    display: flex;
    flex-direction: row;

    & > *:not(:last-child) {
        margin-bottom: ${(props) => props.gap || 0};
    }
`;

export const Vert = styled.div<{ gap?: string }>`
    display: flex;
    flex-direction: column;

    @media (min-width: 1024px) {
        min-height: 0;
    }

    & > *:not(:last-child) {
        margin-bottom: ${(props) => props.gap || 0};
    }
`;
