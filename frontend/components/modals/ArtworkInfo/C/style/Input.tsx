import styled from "styled-components";

export const Input = styled.input`
    border: 2px solid #000;
    width: 100%;
    height: 40px;
    font-size: 16px;
    padding: 2px 10px;
    background: ${({ theme }) => theme.background};
    color: ${({ theme }) => theme.color};
    outline: none;
    transition: 0.2s;
    box-shadow: none !important;

    &:focus {
        // border: 2px solid;
        border-color: ${({ theme }) => theme.color};
    }

    @media (max-width: 600px) {
        font-size: 14px;
    }
`;
