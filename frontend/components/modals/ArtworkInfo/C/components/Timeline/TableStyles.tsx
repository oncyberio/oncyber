import styled from "styled-components";

export const Td = styled.td<{
    width: string;
    borderLeft?: boolean;
    align?: string;
}>`
    position: relative;
    width: ${(props) => props.width};
    border-left: ${(props) => (props.borderLeft ? "1px solid" : "none")};
    border-color: var(--timeline-border-color);
    ${(props) => (props.align ? `text-align: ${props.align};` : "")};

    @media (max-width: 800px) {
        font-size: 13px;
    }
`;

export const Tr = styled.tr`
    height: 40px;
`;
