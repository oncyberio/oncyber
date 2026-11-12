import styled, { css } from "styled-components";
import InfoIcon from "@ui/icons/Info";
import { useCyberTranslation } from "@components/context/I18nContext";
import { motion } from "framer-motion";
import React, { useState, useEffect } from "react";

const AnimatedKey = ({ name }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="key"
        transition={{
            duration: 1,
            ease: "easeInOut",
        }}
    >
        {name}
    </motion.div>
);

export default function InfoTips({
    keys,
    isTipsShowing,
    toggleTips,
    isPlaying = false,
}) {
    const { t } = useCyberTranslation();

    const [fadeIn, setFadeIn] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setFadeIn((prevFadeIn) => !prevFadeIn);
        }, 2500);

        return () => clearTimeout(timer);
    }, [fadeIn]);

    return (
        <Container data-world-tips $isPlaying={isPlaying}>
            <div className="wrapper">
                {isTipsShowing && (
                    <Dropdown>
                        <TipsWrapper active={keys?.wasdArrow}>
                            <span className="label">{t`WALK_WITH`}</span>

                            <div className="shotcut-wrapper">
                                {fadeIn ? (
                                    <>
                                        <AnimatedKey name="W" />
                                        <AnimatedKey name="A" />
                                        <AnimatedKey name="S" />
                                        <AnimatedKey name="D" />
                                    </>
                                ) : (
                                    <>
                                        <AnimatedKey name="↑" />
                                        <AnimatedKey name="↓" />
                                    </>
                                )}
                            </div>
                        </TipsWrapper>

                        <TipsWrapper>
                            <span className="label">{t`ROTATE`}</span>
                            <div className="shotcut-wrapper">
                                <span className="key">←</span>
                                <span className="key">→</span>
                            </div>
                        </TipsWrapper>

                        <TipsWrapper active={keys?.Dance}>
                            <span className="label">{t`DANCE`}</span>
                            <div className="shotcut-wrapper">
                                <span className="key">2</span>
                                <span className="key">3</span>
                                <span className="key">4</span>
                            </div>
                        </TipsWrapper>

                        <TipsWrapper active={keys?.Space}>
                            <span className="label">{t`JUMP_WITH_THE`}</span>
                            <div className="shotcut-wrapper">
                                <span className="key">SPACEBAR</span>
                            </div>
                        </TipsWrapper>

                        <TipsWrapper active={keys?.Shift}>
                            <span className="label">{t`RUN_WITH`}</span>
                            <div className="shotcut-wrapper">
                                <span className="key">shift</span>
                            </div>
                        </TipsWrapper>

                        <TipsWrapper>
                            <span className="label">{t`SEE_ALL_CONTROLS`}</span>
                            <div className="shotcut-wrapper">
                                <span className="key">h</span>
                            </div>
                        </TipsWrapper>
                    </Dropdown>
                )}
                <ButtonWrapper>
                    <button
                        className="btn-icon-wrapper"
                        onClick={() => toggleTips((prevState) => !prevState)}
                    >
                        <InfoIcon width="32" height="32" />
                    </button>
                </ButtonWrapper>
            </div>
        </Container>
    );
}

const Container = styled.div<{ $isPlaying: boolean }>`
    position: absolute;
    bottom: ${({ $isPlaying }) =>
        $isPlaying
            ? "max(76px, calc(env(safe-area-inset-bottom) + 64px))"
            : "15px"};
    right: 20px;

    @media (max-width: 1100px) {
        display: none;
    }

    & > div.wrapper {
        position: relative;
    }
`;

const ButtonWrapper = styled.div`
    position: relative;
    display: flex;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    z-index: 2;

    .btn-icon-wrapper {
        position: relative;
        width: 32px;
        height: 32px;
        padding: 0;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        border: 1px solid rgba(255, 255, 255, 0.5);
    }

    .btn-icon-wrapper::before {
        content: "";
        position: absolute;
        width: 100%;
        height: 100%;
        left: 0;
        top: 0;
        border-radius: 999px;
        outline: 2px solid rgba(255, 255, 255, 0.5);
        outline-offset: 2px;
        outline-width: 2px;
        animation: pulse 1s linear infinite;

        @keyframes pulse {
            0% {
                outline-offset: 2px;
                opacity: 1;
            }

            70% {
                outline-offset: 4px;
                opacity: 0;
            }

            100% {
                outline-offset: 2px;
                opacity: 1;
            }
        }
    }
`;

const Dropdown = styled.div`
    position: absolute;
    bottom: 13px;
    right: 13px;

    display: flex;
    width: 256px;
    height: auto;
    padding: 16px 24px;
    flex-direction: column;
    z-index: 1;
    gap: 8px;

    border-radius: 16px;
    background: rgba(0, 0, 0, 0.4);
    box-shadow: 0px 8px 6px 0px rgba(0, 0, 0, 0.05),
        0px 1px 1px 0px rgba(255, 255, 255, 0.25) inset,
        0px -1px 1px 0px rgba(255, 255, 255, 0.25) inset;

    backdrop-filter: blur(50px);
`;

const TipsWrapper = styled.div<{ active?: boolean }>`
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;

    ${(props) =>
        props?.active &&
        css`
            opacity: 0.5;
        `}

    & > .label {
        color: #fff;
        text-align: left;
        font-size: 12px;
        font-style: normal;
        font-weight: 400;
        line-height: 28px;
        width: 100%;
        letter-spacing: -0.12px;
    }

    & > .shotcut-wrapper {
        display: flex;
        width: 100%;
        align-items: center;
        justify-content: flex-end;
        gap: 4px;

        & > .key {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 5px;
            min-width: 24px;
            min-height: 24px;
            border-radius: 6px;
            border: 1px solid #fff;
            color: #fff;
            text-align: center;
            font-size: 12px;
            font-weight: 400;
            line-height: 100%;
            letter-spacing: -0.36px;
            text-transform: uppercase;
        }
    }
`;
