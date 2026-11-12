import React from "react";
import { noop, eclipseText } from "@utils/js";
import styled, { css } from "styled-components";

export default function Card({
    cardRef,
    preview,
    title,
    badge = "",
    type,
    index,
    isActive,
    delay,
    subTitle = null,
    next = noop,
}) {
    return (
        <Container
            ref={cardRef}
            type={type}
            img={preview}
            index={index}
            onClick={next}
            deplay={delay}
            isActive={isActive}
        >
            {badge && (
                <div className="badge">
                    <span>{badge}</span>
                </div>
            )}
            <div className="details">
                <h2 className="title scrollbar-hidden">
                    {eclipseText(title, 28) || "Untitled"}
                </h2>
                {subTitle ? (
                    <span className="sub-title">{subTitle}</span>
                ) : null}
            </div>
        </Container>
    );
}

Card.defaultProps = {
    title: "",
    preview: "",
    description: "",
};

const Container = styled.div<{
    img: string;
    deplay: number;
    type: string;
    index: number;
    isActive: boolean;
}>`
    opacity: 0;
    width: 305px;
    height: 419px;
    display: flex;
    min-width: 305px;
    cursor: pointer;
    border-radius: 16px;
    flex-direction: column;
    justify-content: flex-end;
    animation-duration: 200ms;
    animation-fill-mode: forwards;
    animation-name: card-animation;
    transition: margin-bottom 0.2s ease;
    animation-delay: ${(props) => props.deplay + "s"};
    z-index: 2;
    position: relative;

    @media (max-width: 600px) {
        ${(props) =>
            props.isActive
                ? css`
                      width: 240px;
                      min-width: 240px;
                      height: 386px;
                      min-height: 386px;
                  `
                : css`
                      width: 230px;
                      height: 360px;
                      min-width: 230px;
                      min-height: 360px;
                      margin-top: 10px;
                  `}

        border-radius: 16px !important;
    }

    border: none;
    filter: brightness(0.7);
    box-shadow: 0px 8px 6px 0px #0000000d, 0px .5px .5px 0px #ffffff40 inset,
        0px -.5px .5px 0px #ffffffcc inset;

    ${({ img }) =>
        img &&
        css`
            background: linear-gradient(
                    to bottom,
                    rgba(0, 0, 0, 0) 0%,
                    rgba(0, 0, 0, 0.1) 70%
                ),
                url(${img}), lightgray 50%;

            background-position: center;
            background-size: cover;
        `}

    @keyframes card-animation {
        0% {
            opacity: 0;
        }
        100% {
            opacity: 1;
        }
    }

    @media (min-width: 600px) {
        &:hover {
            filter: none;
            margin-bottom: 30px;
        }
    }

    & > .badge {
        position: absolute;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #328dfd;
        right: -10px;
        top: 20px;
        border-radius: 8px;
        padding: 5px;

        & > span {
            color: #fff;
            text-align: center;
            font-size: 14px;
            font-weight: 500;
            letter-spacing: -0.48px;
            text-transform: uppercase;
        }
    }

    & > .details {
        z-index: 2;
        width: 100%;
        display: flex;
        height: 150px;
        padding: 10px;
        align-items: center;
        flex-direction: column;
        justify-content: center;

        & > .sub-title {
            width: 212px;
            color: #fff;

            text-align: center;
            font-family: Aeonik;
            font-size: 16px;
            font-style: normal;
            font-weight: 400;
            line-height: 36px;
            letter-spacing: -0.36px;
        }

        & > h2.title {
            margin: 0;
            display: flex;
            width: 212px;
            font-weight: 600;
            font-size: 32px;
            color: #ffffff;
            line-height: 36px;
            text-align: center;
            font-family: Aeonik;
            align-items: center;
            letter-spacing: -0.72px;
            justify-content: center;
            filter: brightness(130%);

            max-width: 212px;
            white-space: pre-wrap;
            word-break: break-word;

            @media (max-width: 600px) {
                font-size: 22px;
                line-height: 24px;
            }
        }
    }
`;
