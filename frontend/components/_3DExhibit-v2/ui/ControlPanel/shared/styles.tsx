import styled from "styled-components";

export const Header = styled.header`
    padding: 16px;
    background: rgba(7, 7, 7, 0.2);
    backdrop-filter: blur(40px);
    position: sticky;
    top: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    z-index: 10;

    p {
        font-weight: 500;
        font-size: 14px;
        letter-spacing: 0.16px;

        margin: 0;
    }

    @media (max-width: 550px) {
        border-radius: 0;
    }
`;

export const NotificationRound = styled.div`
    width: 7px;
    height: 7px;
    background: #00e3bd;
    border-radius: 50%;
`;

export const NotificationWrapper = styled.div`
    display: flex;
    width: 100%;
    left: 50%;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    position: absolute;
    transform: translateX(-50%);
    bottom: 65px;
    z-index: -1;
    max-width: 100%;
    //overflow: hidden;
`;
