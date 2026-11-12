import styled from "styled-components";

export const BgWrapper = styled.div`
    position: relative;
    height: 100%;
    width: 100%;
    overflow: hidden;
    border-radius: 6px;
    z-index: -1;
    background: linear-gradient(180deg, #070707 0%, rgba(7, 7, 7, 0.05) 91.18%);
`;

type DestinationProps = {
    active?: boolean;
    disabled?: boolean;
};

export const Destination = styled.div<DestinationProps>`
    transition: 0.5s;
    cursor: pointer;
    height: 380px;
    width: 49.5%;
    margin: 0;
    margin-bottom: 10px;
    display: flex;
    cursor: pointer;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    opacity: ${({ disabled, active }) => (disabled || !active ? 0.85 : 1)};
    border: 2px solid ${({ active }) => (active ? "#00E3BD" : "transparent")};
    position: relative;
    border-radius: 8px;
    transition: 0.3s all;

    &:hover {
        opacity: 0.8;
        transition: 0.3s all;
    }

    @media (max-width: 800px) {
        width: 100%;
    }
`;

export const Description = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: end;
    justify-content: space-between;
    width: 100%;
    color: white;
    padding: 215px 14px 26px 24px;
    border-radius: 8px;
    background: linear-gradient(
        to top,
        rgba(0, 0, 0, 0.89),
        rgba(0, 0, 0, 0.45),
        rgba(0, 0, 0, 0.2),
        rgba(0, 0, 0, 0.1),
        transparent
    );

    top: -289px;
    position: relative;
    margin-bottom: -279px;
    font-weight: 600;

    @media (max-width: 800px) {
        font-size: 13px;
        padding: 15px 8px;
        grid-template-columns: 3fr 1fr;
        height: 280px;
        top: -279px;
    }
`;

export const Header = styled.div`
    h4 {
        font-style: normal;
        font-weight: 600 !important;
        font-size: 28px;
        max-width: 300px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        margin-block-start: unset;
        margin-block-end: unset;
        margin-bottom: 4px;

        @media (max-width: 436px) {
            font-size: 24px;
            max-width: 200px;
        }

        i {
            font-size: 0.65em;
        }

        span {
            text-align: right;
            font-size: 0.65em;
            color: #7a7a7a;
            font-weight: 600;
        }
    }

    span {
        transition: 0.2s;
        display: flex;
        align-items: center;
        font-style: normal;
        font-weight: 400;
        font-size: 12px;
        line-height: 100%;
        color: #dedede;
        font-weight: 600;

        a {
            margin-left: 5px;
        }

        img {
            width: 12px;
            margin-right: 4px;
        }

        &:hover {
            opacity: 1;
        }
    }
`;

export const Details = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    text-align: right;
    margin-right: 10px;

    p {
        margin-block-start: unset;
        margin-block-end: unset;
        color: #dedede;
        font-style: normal;
        font-weight: 600;
        font-size: 12px;
        line-height: 100%;

        span {
            font-weight: 600;
            font-size: 28px;
            line-height: 28px;
            display: block;
            color: #fff;
        }
    }
`;

export const Float = styled.div`
    position: absolute;
    top: 15px;
    right: 15px;

    img {
        width: 14px;
        height: 14px;
    }

    @media (max-width: 800px) {
        right: 8px;
    }
`;

export const Countdown = styled.div`
    position: absolute;
    top: 18px;
    left: 24px;

    span {
        display: flex;
        color: #ffffff;
        font-size: 18px;
        font-weight: 600;
        line-height: 28px;
        align-items: center;
        letter-spacing: -0.02em;
    }

    @media (max-width: 800px) {
        left: 8px;
    }
`;

export const Free = styled.div`
    width: auto;
    height: 28px;
    display: flex;
    padding: 5px 12px;
    justify-content: center;
    align-items: center;
    background: #070707;
    border-radius: 999999px;
    text-transform: uppercase;
    color: #fff;
    font-weight: 600;
    font-size: 12px;

    @media (max-width: 800px) {
        font-size: 10px;
        padding: 3px 10px;
    }
`;

export const Uploaded = styled.div`
    width: 94px;
    height: 28px;
    display: flex;
    justify-content: center;
    align-items: center;
    background: #070707;
    border-radius: 999999px;
    text-transform: uppercase;
    color: #fff;
    font-weight: 600;
    font-size: 12px;

    & > span {
        width: 8px;
        height: 8px;
        background: #00e3bd;
        margin-right: 6px;
        border-radius: 50%;
        font-weight: 600;
    }
`;

export const Dot = styled.span`
    width: 8px;
    height: 8px;
    background: #00e3bd;
    margin-right: 6px;
    border-radius: 50%;
    font-weight: 600;
`;
