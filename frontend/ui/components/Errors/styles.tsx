import styled from "styled-components";

export type StyledErrorProps = {};

export const StyledError = styled.div<StyledErrorProps>`
    width: 400px;
    display: flex;
    margin-bottom: 90px;
    align-items: center;
    flex-direction: column;
    justify-content: space-between;

    @media (max-width: 830px) {
        width: 100%;
        margin-top: 7.5rem;
    }

    & > button {
        color: ${({ theme, color }) =>
            color ? color : theme.type === "light" ? "#fff" : "#000000"};
        background: ${({ theme, background }) =>
            background
                ? background
                : theme.type === "light"
                ? "#000000"
                : "#fff"};
    }

    & > div {
        width: 100%;
        display: flex;
        align-items: center;
        flex-direction: column;
        margin-top: 20px;
        margin-bottom: 20px;

        & > span {
            font-family: "PP NeueBit";
            font-style: normal;
            font-weight: 700;
            font-size: 14px;
            color: ${({ theme, color }) =>
                color ? color : theme.type === "light" ? "#000000" : "#fff"};
        }
    }
`;
