import { useCyberTranslation } from "@components/context/I18nContext";
import IconImg from "@ui/components/IconImg";
import { useEffect, useState } from "react";
import styled from "styled-components";

export const tipsSlides = [
    {
        image: "wasd",
        content: "WASD",
        size: 80,
    },
    {
        image: "space-key",
        content: "SPACE_KEY",
    },
    {
        image: "mouse-trackpad",
        content: "MOUSE_TRACKPAD",
    },
    {
        image: "dance-key",
        content: "DANCE_KEY",
    },
    {
        image: "ESC-tips",
        content: "ESC_KEY",
        size: 40,
    },
    {
        image: "e-key-tips",
        content: "E_KEY",
        size: 26,
    },
    {
        image: "c-key-tips",
        content: "C_KEY",
        size: 26,
    },
    {
        image: "b-key",
        content: "B_KEY",
        size: 26,
    },
    {
        image: "shift-key",
        content: "SHIFT_KEY",
    },
    {
        image: "tab-key",
        content: "TAB_KEY",
    },
    {
        image: "l-key",
        content: "L_KEY",
        size: 26,
    },
];

export default function Tips({ mode, controlsType, toggleTips }) {
    const [currentItem, setCurrentItem] = useState(0);

    const { t } = useCyberTranslation();

    useEffect(() => {
        const next = (currentItem + 1) % tipsSlides.length;
        const id = setTimeout(() => setCurrentItem(next), 3000);
        return () => clearTimeout(id);
    }, [currentItem]);

    const handleNextSlide = () => {
        if (currentItem === tipsSlides.length - 1) {
            setCurrentItem(0);
        } else {
            setCurrentItem((prev) => prev + 1);
        }
    };

    const tip = tipsSlides[currentItem];

    if (controlsType === "mobile") return null;

    return (
        <Container isHidden={false} className="keys" id="tips">
            <div className="blur" />

            {controlsType == "vr" && (
                <TipsWrapper key={currentItem} onClick={handleNextSlide}>
                    <img alt="tip" src="../v2/icons/vr-control.png" />
                    <FooterWrapper>
                        <p>{t`GRIP_TO_MOVE`}</p>
                        <button
                            style={{ cursor: "pointer" }}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleTips();
                            }}
                        >
                            {t`SEE_ALL_TIPS`}
                        </button>
                    </FooterWrapper>
                </TipsWrapper>
            )}

            {controlsType == "desktop" && (
                <TipsWrapper key={currentItem} onClick={handleNextSlide}>
                    <ImageWrapper>
                        <IconImg size={32} name={tip.image} mode="light" />
                    </ImageWrapper>
                    <FooterWrapper>
                        <p>{t(tip.content)}</p>
                        <button
                            className="see-all-tips"
                            style={{ cursor: "pointer" }}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleTips();
                            }}
                        >
                            {t`SEE_ALL_TIPS`}
                        </button>
                    </FooterWrapper>
                </TipsWrapper>
            )}
        </Container>
    );
}

const Container = styled.div<{
    isHidden: boolean;
}>`
    width: 366px;
    height: 100px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;

    .blur {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgb(189 189 189 / 15%);
        filter: blur(51px);
        width: 100%;
        height: 100%;
    }

    @media (max-width: 950px) {
        display: none;
    }
`;

const TipsWrapper = styled.div`
    display: flex;
    align-items: center;
    flex-direction: column;

    animation: fadeinout 3s linear 1 forwards;

    @keyframes fadeinout {
        0% {
            opacity: 0;
        }
        50% {
            opacity: 1;
        }
        100% {
            opacity: 0;
        }
    }
`;

const ImageWrapper = styled.div`
    padding: 12px;
    width: 62px;
    height: 62px;
`;

const FooterWrapper = styled.div`
    z-index: 1;
    display: flex;
    align-items: flex-start;

    font-style: normal;
    font-size: 12px;

    color: #fff;

    p,
    button {
        margin: 0;
        font-size: 13px;
        text-align: center;
    }

    button {
        border: none;
        background: transparent;
        color: #fff;
        border-bottom: 1px solid #fff;
        padding: 0;
        margin-left: 6px;
        cursor: pointer;
        white-space: nowrap;
    }
`;
