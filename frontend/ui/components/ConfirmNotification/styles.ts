import styled, { css } from "styled-components";

export const Wrapper = styled.div`
    width: 100%;
    height: 72px;
    display: flex;
    z-index: 9999;
    border-radius: 6px;
    align-items: center;
    margin-bottom: 10px;
    // backdrop-filter: blur(20px);
    justify-content: space-between;
    background: linear-gradient(
        201.23deg,
        rgba(7, 7, 7, 0.6) 4.03%,
        rgba(23, 24, 26, 0.24) 94%
    );
`;

export const Description = styled.div`
    width: 285px;
    height: 100%;
    display: flex;
    padding: 12px;
    align-items: center;
    justify-content: flex-start;

    & > p {
        font-weight: 400;
        font-size: 13px;
        line-height: 130%;
        color: #ffffff;
        max-width: 180px;
        margin-left: 20px;
        word-wrap: break-word;
    }
`;

export const IconWrapper = styled.div`
    width: 50px;
    height: 50px;
    display: flex;
    position: relative;
    align-items: center;
    border-radius: 900px;
    justify-content: center;
    background: rgba(7, 7, 7, 0.6);
`;

export const AvatarWrapper = styled.div`
    width: 20px;
    height: 20px;
    bottom: 0px;
    left: 35px;
    border-radius: 999px;
    position: absolute;
    overflow: hidden;
`;

export const Action = styled.div`
    width: 90px;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    border-left: 1.5px solid rgba(255, 255, 255, 0.2);
`;

export const Button = styled.button`
    height: 36px;
    outline: none;
    border: none;
    width: 100%;
    font-weight: 500;
    font-size: 12px;
    line-height: 14px;
    display: flex;
    align-items: center;
    text-align: center;
    color: #ffffff;
    cursor: pointer;
    justify-content: center;
    background: transparent;

    &:first-child {
        border-bottom: 1.5px solid rgba(255, 255, 255, 0.2);
    }

    transition: 0.2s;
    &:hover {
        background: rgba(7, 7, 7, 0.6);
    }
`;
