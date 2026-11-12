import React, { useEffect, useRef, useState, useContext } from "react";
import styled from "styled-components";
import Portal from "@components/Snackbar/Portal";
import useEmblaCarousel from "embla-carousel-react";
import { RoundButton } from "@components/DesignSystem/buttons";
import { QuizModalProps } from "../../types";
import Card from "./Card";
import { UserContext } from "@components/context/UserContext";
import { useMediaQuery } from "@components/hooks/useMediaQuery";

export default function QuizModal({
    title,
    items,
    skip,
    type,
    onBack = null,
    delay = 0.25,
    startIndex = 0,
    style = {},
    clickRef = null,
    children,
    skipTitle = null,
}: QuizModalProps) {
    const cardContainerRef = useRef<HTMLDivElement>(null);

    const cardRef = useRef<HTMLDivElement>(null);

    const [thumbViewportRef, embla] = useEmblaCarousel({
        startIndex,
        dragFree: false,
    });

    const [activeIndex, setActiveIndex] = useState(startIndex);

    const isMobile = useMediaQuery("(max-width: 600px)");

    const { isAnonymous, user } = useContext(UserContext);

    useEffect(() => {
        if (!embla) return;

        const handleSelectedScrollSnap = () => {
            const index = embla.selectedScrollSnap();
            setActiveIndex(index);
        };

        embla.on("select", handleSelectedScrollSnap);
        return () => {
            embla.off("select", handleSelectedScrollSnap);
        };
    }, [embla]);

    return (
        <Portal>
            <Container style={style}>
                <Wrapper ref={clickRef}>
                    <CardHeader>
                        <div className="left-groups">
                            {onBack && (
                                <RoundButton
                                    className="btn back-cta"
                                    onClick={onBack}
                                >
                                    Back
                                </RoundButton>
                            )}
                        </div>

                        <h1>{title}</h1>

                        <div className="right-groups" />
                    </CardHeader>

                    <CardWrapper
                        className="scrollbar-hidden"
                        ref={cardContainerRef}
                    >
                        {isMobile ? (
                            <div className="embla embla--thumb">
                                <div
                                    className="embla__viewport"
                                    ref={thumbViewportRef}
                                >
                                    <div className="embla__container embla__container--thumb">
                                        {items.map((item, index) => {
                                            return (
                                                <Card
                                                    {...item}
                                                    type={type}
                                                    key={item.id}
                                                    index={index}
                                                    cardRef={cardRef}
                                                    isActive={
                                                        activeIndex === index
                                                    }
                                                    delay={delay * (index + 1)}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            items.map((item, index) => {
                                return (
                                    <Card
                                        {...item}
                                        type={type}
                                        index={index}
                                        key={item.id}
                                        cardRef={cardRef}
                                        delay={delay * (index + 1)}
                                        isActive={activeIndex === index}
                                    />
                                );
                            })
                        )}
                    </CardWrapper>

                    <CardFooter>
                        {skip && (
                            <RoundButton
                                isLight={true}
                                className="btn skip"
                                style={{
                                    height: "50px",
                                }}
                                onClick={() => {
                                    skip();
                                }}
                            >
                                {skipTitle || "View More Templates"}
                            </RoundButton>
                        )}
                        {children}
                    </CardFooter>
                </Wrapper>
            </Container>
        </Portal>
    );
}

QuizModal.defaultProps = {
    tags: [],
};

const Container = styled.div`
    display: flex;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    align-items: center;
    justify-content: center;
    width: 100%;
    z-index: 10000;
    height: var(--100-vh);

    // start with no backdrop filter and animate from 0 to 10px blur
    backdrop-filter: blur(0px);
    animation: backdrop-filter 0.4s ease-in-out forwards;    
    @keyframes backdrop-filter {
        0% {
            backdrop-filter: blur(0px);
        }
        100% {
            backdrop-filter: blur(10px);
        }
    }

    .btn {
        backdrop-filter: blur(50px);
        background: rgba(255, 255, 255, 0.1) !important;
        box-shadow: 0px 1px 1px 0px rgba(255, 255, 255, 0.25) inset,
            0px -1px 1px 0px rgba(255, 255, 255, 0.25) inset;
        filter: drop-shadow(0px 8px 6px rgba(0, 0, 0, 0.05));
    }
`;

const Wrapper = styled.div`
    display: flex;
    padding: 10px;
    gap: 28px;
    min-width: 640px;
    max-width: 980px;
    flex-direction: column;

    @media (max-width: 600px) {
        width: 100%;
        padding: 0 0px;
        max-width: 100%;
    }
`;

const CardHeader = styled.div`
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;

    @media (max-width: 600px) {
        justify-content: center;
    }

    & > .right-groups {
        gap: 8px;
        width: 88px;
        display: flex;
        align-items: center;

        @media (max-width: 600px) {
            display: none;
        }
    }

    & > .left-groups {
        gap: 8px;
        width: 88px;
        display: flex;
        align-items: center;

        @media (max-width: 600px) {
            position: absolute;
            top: 10px;
            left: 10px;
        }

        & > .back-cta {
            width: 80px;
            height: 40px;
            color: #fff;
            border: none;
            font-size: 14px;
        }
    }

    & > h1 {
        margin: 0;
        font-weight: 500;
        font-size: 24px;
        line-height: 100%;
        color: #ffffff;
        letter-spacing: -0.48px;

        @media (max-width: 600px) {
            font-size: 22px;
            max-width: 219px;
            text-align: center;
            line-height: 28.8px;
        }
    }
`;

const CardFooter = styled.div`
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;

    .skip {
        border-radius: 100px;
    }
`;

const CardWrapper = styled.div`
    width: 100%;
    display: flex;
    align-items: center;

    gap: 10px;
    height: 460px;
    overflow-x: auto;
    z-index: 1;
    padding: 0 10px;

    justify-content: space-between;

    @media (max-width: 600px) {
        max-width: 100%;
        width: 100%;
        height: auto;
        overflow-x: auto;
    }

    .embla {
        position: relative;
        max-width: 100%;
        width: 100%;
        overflow: auto;
        height: 100%;
    }

    .embla__viewport {
        width: 100%;
        overflow-x: auto;

        &::-webkit-scrollbar {
            display: none;
        }

        -ms-overflow-style: none; /* IE and Edge */
        scrollbar-width: none; /* Firefox */
    }

    .embla__viewport.is-draggable {
        cursor: move;
        cursor: grab;
    }

    .embla__viewport.is-dragging {
        cursor: grabbing;
    }

    .embla__container {
        display: flex;
        user-select: none;
        -webkit-touch-callout: none;
        -khtml-user-select: none;
        -webkit-tap-highlight-color: transparent;
        gap: 15px;
    }

    .embla__slide {
        min-width: 100%;
        position: relative;
    }

    .embla__container--thumb {
        cursor: default;
    }
`;
