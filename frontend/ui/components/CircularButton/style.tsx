import styled from "styled-components";

export const CircularButtonWrapper = styled.div`
    border: 1px solid #e0e0e0;
    background: #fff;
    border-radius: 50%;
    padding: 12.5px;
    min-width: 44px;
    min-height: 44px;
    height: 44px;
    width: 44px;
    display: flex;
    align-items: center;
    cursor: pointer;
    justify-content: center;

    transition: 0.2s;
    &:hover {
        background: #f7f7f7;
    }
`;