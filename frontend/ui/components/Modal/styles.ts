import styled from "styled-components";

export type StyledModalProps = {
    height?: string;
    padding?: string;
    titleColor?: string;
    borderRadius?: number;
    descriptionColor?: string;
};

export const StyledModal = styled.div<StyledModalProps>`
    width: 100%;
    display: flex;
    font-style: normal;
    align-items: center;
    flex-direction: column;
    background-color: #fff;
    justify-content: flex-start;
    height: ${({ height }) => height};
    padding: ${({ padding }) => padding};
    border-radius: ${({ padding }) => `${padding}px`};

    & > div {
        width: 100%;
        display: flex;
        align-items: center;
        flex-direction: column;
        padding: 0px 30px 34px 30px;

        & > h1 {
            margin: 0px;
            font-size: 24px;
            font-weight: 500;
            line-height: 48px;
            text-align: center;
            color: ${({ titleColor }) => titleColor};

            @media (max-width: 800px) {
                font-size: 20px;
            }
        }

        & > p {
            margin: 0px;
            padding-top: 10px;
            font-size: 16px;
            line-height: 26px;
            text-align: center;
            color: ${({ descriptionColor }) => descriptionColor};

            @media (max-width: 800px) {
                font-size: 14px;
            }
        }

        .pending {
            animation: rotation 1s infinite linear;
        }
    }

    & > footer {
        width: 100%;
        height: 84px;
        display: flex;
        padding: 0px 32px;
        align-items: center;
        background-color: #fff;
        justify-content: flex-end;
        border-top: 1px solid #dfdfe4;
    }

    @keyframes rotation {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(359deg);
        }
    }
`;

StyledModal.defaultProps = {
    height: "auto",
    borderRadius: 16,
    titleColor: "#18191c",
    padding: "45px 0px 0px 0px",
    descriptionColor: "#777980",
};
