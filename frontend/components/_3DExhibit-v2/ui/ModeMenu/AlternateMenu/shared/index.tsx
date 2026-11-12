import styled from "styled-components";

export const Container = styled.div`
    width: 100%;
    height: 100%;
    color: #ffffff;
    backdrop-filter: blur(10px);
    background: rgba(0, 0, 0, 0.35);

    position: fixed;
    top: 0;
    left: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    p,
    h3 {
        margin: 0;
    }

    h3 {
        margin-bottom: 24px;
        font-weight: 500;
    }

    p {
        font-weight: 500;
        font-size: 20px;
    }

    @media (max-width: 550px) {
        p {
            font-size: 16px;
        }

        .icon-img {
            // width: 44px !important;
            // height: 44px !important;
            // min-height: 44px !important;
            // min-width: 44px !important;
        }
    }
`;
