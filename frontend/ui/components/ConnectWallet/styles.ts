import styled from "styled-components";

export type StyledModalProps = {
    padding?: string;
    titleColor?: string;
    borderRadius?: number;
    descriptionColor?: string;
};

export const StyledConnectWallet = styled.div<StyledModalProps>`
    width: 100%;
    display: flex;
    margin: 0 auto;
    max-width: 450px;
    align-items: center;
    flex-direction: column;
    justify-content: flex-start;
    padding: 24px 40px 24px 40px;

    h1 {
        color: ${({ theme }) => theme.color};
        font-style: normal;
        font-weight: 600;
        font-size: 32px;
        margin: 0px;
        line-height: 48px;
        text-align: center;
        margin: 8px 0;

        @media (max-width: 600px) {
            line-height: 60px;
            font-size: 42px;
        }
    }

    p {
        font-weight: 400;
        font-size: 16px;
        font-style: normal;
        line-height: 25px;
        text-align: center;
        color: ${({ theme }) => theme.color};
        margin: 8px 0;
        opacity: 0.8;

        @media (max-width: 600px) {
            font-size: 13px;
            line-height: 20px;
        }
    }

    @media(max-width: 600px) {
        width: 100%;
        padding: 24px;
        h1 {
            font-size: 28px;
        }
    }
`;

export const StyledError = styled.span`
    color: red;
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    text-align: center;
`;

export const Loading = styled.div`
    width: 100%;
    height: 100%;
    display: flex;
    min-height: auto;
    align-items: center;
    flex-direction: column;
    justify-content: center;
    gap: 30px;
    padding: 20px 0;
`;
