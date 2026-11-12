import styled from "styled-components";

export const Button = styled.button`
    border: none;
    outline: none;
    cursor: pointer;
    padding: 0;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;

    &:hover {
        opacity: 0.8;
    }
`;
