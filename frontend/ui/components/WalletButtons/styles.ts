import styled from "styled-components";

import { Button } from "@components/Form";

export const StyledButtonGroup = styled.div`
    width: 100%;
    margin-top: 1rem;
    margin-bottom: 2rem;
    box-sizing: border-box;
    border-radius: 12px;
    border: 1px solid ${({ theme }) => theme.border.color};
`;

export const StyledWalletProvider = styled(Button)`
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 24px;
    border-radius: 0px;
    border: none;

    span {
        font-style: normal;
        font-weight: 400;
        font-size: 16px;
        line-height: 90%;
        margin-right: auto;
        padding-right: 8px;
        margin-left: -20px;
        color: ${({ theme }) => theme.color};
    }

    p {
        font-weight: 400;
        font-size: 16px;
        font-style: normal;
        line-height: 25px;
        text-align: center;
        color: ${({ theme }) => theme.color};
        margin: 8px 0;
        opacity: 0.6;

        @media (max-width: 600px) {
            font-size: 13px;
            line-height: 20px;
        }
    }

    &:hover:enabled {
        padding-left: 30px;
        background-color: transparent;
        box-shadow: none;
        transform: translateY(-10px);
    }

    &:nth-child(2n) {
        border-style: solid;
        border-width: 1px 0px 1px 0px;
        border-color: ${({ theme }) => theme.border.color};
    }

    &:last-child {
        border-bottom: none;
    }

    &:hover:enabled {
        box-shadow: none;
        padding-left: 30px;
        transform: translateY(0);
        background-color: transparent;
    }

    & > img {
        margin-right: auto;
        width: 28px;
    }

    @media (max-width: 600px) {
        padding: 30px;
        span {
            font-size: 15px;
        }

        p {
            font-size: 15px;
        }

        & > img {
            width: 24px;
        }
    }
`;

export const NewStyledWalletProvider = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0px;
    border: none;

    margin-bottom: 8px;

    border-radius: 900px;
    background: transparent;
    position: relative;
    width: 100%;
    padding: 6px 21px;
    border: 1px solid var(--provider-buttons-border-color);

    // box-shadow: 0px 2px 16px 0px rgba(0, 0, 0, 0.16);

    & > img {
        width: 24px;
        margin-right: auto;
        // filter: grayscale(1);
    }

    span {
        font-style: normal;
        font-weight: 400;
        font-size: 16px;
        line-height: 90%;
        margin-right: auto;
        padding-right: 8px;
        margin-left: -20px;
        color: ${({ theme }) => theme.color};
        color: var(--provider-buttons-font-color);

        font-weight: 500;
        font-size: 14px;
        line-height: 36px;

        text-transform: uppercase;
    }

    cursor: pointer;

    transition: 0.2s;
    &:hover {
        background: #f7f7f7;
        & > img {
            filter: grayscale(0);
        }

        span {
            color: var(--provider-buttons-font-hover-color);
        }
        // border: 1px solid #F5F5F5;
    }
`;

export const MoreOptionsWrapper = styled.div`
    appearance: none;
    width: 100%;
    border: 0;
    padding: 0;
    background: transparent;
    color: inherit;
    font-family: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    margin-top: 16px;
    margin-bottom: 16px;
    font-weight: 500;
    font-size: 14px;

    span {
        margin-top: 2px;
        margin-left: 10px;
    }
`;
