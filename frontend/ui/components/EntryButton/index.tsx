import { forwardRef } from "react";

import styled from "styled-components";
import { promptGlass } from "../PromptGlass";

import IconImg from "../IconImg";
import { useCyberTranslation } from "@components/context/I18nContext";

interface Props {
    isDark?: boolean;
    size?: "small" | "large";
    loading?: boolean;
    gated?: boolean;
    isMobile?: boolean;
    epilepsyWarning?: boolean;
    isAnon?: boolean;
}

const EntryButton = forwardRef(
    (
        {
            isDark,
            size,
            loading,
            gated,
            isMobile,
            epilepsyWarning,
            isAnon,
        }: Props,
        ref: React.ForwardedRef<HTMLDivElement>
    ) => {
        const { t } = useCyberTranslation();

        let text = `CLICK_TO_LOOK_AROUND`;

        let span = "FREELY";

        let url =
            "https://cyber.mypinata.cloud/ipfs/QmTFKVxVFJejj6cqnBN6FJQQrkVKwtbutW6KtjJh2zRkSZ?filename=hand_zfomxh.svg";

        // if (loading) {
        //     text = `LOADING • LOADING • LOADING • LOADING • LOADING • `;
        // }

        if (gated) {
            text = `LOCKED_GATING`;
            span = null;
        }

        // if (epilepsyWarning) {
        //     text = `epilepsy warning • click to enter • epilepsy warning •`;
        // }

        let width = 160;

        if (size === "small") {
            width = 152;
        }

        return loading ? (
            <></>
        ) : (
            <>
                {isMobile ? (
                    <Circle
                        ref={ref}
                        size={size}
                        isAnon={isAnon}
                        circleWidth={width}
                        isMobile={isMobile}
                        isDark={loading || isDark}
                    >
                        <p className="text">
                            {loading ? null : gated ? (
                                <IconImg name="lock" mode="light" />
                            ) : (
                                <img
                                    src={
                                        "https://cyber.mypinata.cloud/ipfs/QmTFKVxVFJejj6cqnBN6FJQQrkVKwtbutW6KtjJh2zRkSZ?filename=hand_zfomxh.svg"
                                    }
                                />
                            )}
                        </p>
                    </Circle>
                ) : (
                    <Desktop>
                        {gated ? (
                            <IconImg name="lock" mode="light" size={14} />
                        ) : (
                            <div className="dot" />
                        )}
                        <span>
                            {t(text)}
                            {span && <span>{t`FREELY`}</span>}
                        </span>
                    </Desktop>
                )}
            </>
        );
    }
);

export default EntryButton;

EntryButton.defaultProps = {
    size: "small",
    loading: false,
};

const Desktop = styled.div`
    width: 205px;
    height: 36px;
    display: flex;
    justify-content: flex-start;
    align-items: center;
    gap: 10px;
    position: relative;
    border-radius: 1000px;
    cursor: pointer;
    padding-left: 15px;
    ${promptGlass}

    & > .dot {
        width: 12px;
        height: 12px;
        background: #fff;
        border-radius: 9999px;
        transform: scale(1);
        animation: pulse 2s infinite;

        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }

        @keyframes pulse {
            0% {
                transform: scale(0.75);
            }

            70% {
                transform: scale(1);
            }

            100% {
                transform: scale(0.75);
            }
        }
    }

    & > span {
        display: flex;
        gap: 3px;
        align-items: baseline;
        justify-content: flex-start;
        overflow: hidden;
        color: #fff;
        text-overflow: ellipsis;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.48);
        font-size: 12px;
        font-weight: 400;
        text-transform: capitalize;
        line-height: 140%;

        & > span {
            color: #fff;
            font-size: 12px;
            font-weight: 600;
            line-height: 140%;
            text-transform: capitalize;
        }
    }
    @media (forced-colors: active) {
        & > .dot {
            background: CanvasText;
        }
        & > span,
        & > span > span {
            color: CanvasText;
            text-shadow: none;
        }
    }
`;

const Circle = styled.div<{
    isDark: boolean;
    circleWidth: number;
    size: "small" | "large";
    isMobile: boolean;
    isAnon: boolean;
}>`
    display: flex;
    justify-content: center;
    align-items: center;
    height: ${({ circleWidth }) => circleWidth}px;
    width: ${({ circleWidth }) => circleWidth}px;
    min-height: ${({ circleWidth }) => circleWidth}px;
    min-width: ${({ circleWidth }) => circleWidth}px;
    border-radius: 50%;
    position: relative;
    cursor: pointer;
    padding: 24px;
    color: #ffffff;
    background: ${({ isAnon, isMobile }) =>
        !isAnon
            ? isMobile
                ? "url(https://cyber.mypinata.cloud/ipfs/Qmf5gpDqCXZ293RvmkykgTA4mdoo5yoKEM3naUyEj1cu6T?filename=Group_481988_eb3b9p.svg)"
                : "url(https://cyber.mypinata.cloud/ipfs/QmStFmZbsdziUfo7MWeUUGJR4AEikF1WjAorTyBbmk7s96?filename=circle_desktop_igp6la.svg)"
            : "url(https://cyber.mypinata.cloud/ipfs/QmUm3ZKYBJvWVKPz7rkoKMEpoezYYQVnxibc6yVoNdiVab?filename=1689071112-u1689071111.258.svg)"};

    backdrop-filter: blur(2px);
    font-size: ${({ size }) => (size === "small" ? 13 : 13)}px;

    overflow: hidden;
    cursor: none;
    animation: rotate 25s linear infinite;

    background-size: cover;
    user-select: none;

    animation: rotate1 25s linear infinite;

    @keyframes rotate1 {
        0% {
            transform: rotateZ(0deg);
        }
        100% {
            transform: rotateZ(360deg);
        }
    }

    p {
        margin: 0;
    }

    &:active {
        transform: scale(0.98);
    }

    .text {
        position: absolute;
        font-weight: 500;
        margin: 0;

        animation: rotate2 25s linear infinite;

        @keyframes rotate2 {
            0% {
                transform: rotateZ(360deg);
            }
            100% {
                transform: rotateZ(0deg);
            }
        }

        img {
            width: 24px;
            z-index: 20000;
        }
    }
`;
