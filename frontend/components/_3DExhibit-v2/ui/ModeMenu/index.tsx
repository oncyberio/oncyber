import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import IconImg from "@ui/components/IconImg";
import styled, { css } from "styled-components";
import { Mode, usePanel } from "../ControlPanel/context/PanelProvider";

import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";

import {
    CURRENT_STATE,
    APP_STATES,
    CANVAS,
    IS_VR,
    IS_MOBILE,
    IS_VR_SUPPORTED,
    IS_MULTIPLAYER_ENABLED,
} from "@3constants";
import { useEffect, useMemo, useRef, useState } from "react";
import Spinner from "@ui/components/Spinner";
import Mobile_AlternateMenu from "./AlternateMenu/Mobile";
import VR_AlternateMenu from "./AlternateMenu/VR";
import {
    FUD_SPACE_SLUG,
    MINT_SPACE_SLUG,
} from "../ControlPanel/Raffle/raffles/rtfktRaffleConstants";
import { useCyberTranslation } from "@components/context/I18nContext";

export default function ModeMenu({ exhibit }) {
    const { changeMode, mode } = useMultiplayer();

    const {
        toggleModeMenu,
        selectedMode,
        setSelectedMode,
        toggleTip,
        enterVR,
        setHidePanel,
    } = usePanel();

    const world = useWorld();

    const [options, setOptions] = useState([]);

    const [loading, setLoading] = useState(-1);

    const { t } = useCyberTranslation();

    useEffect(() => {
        const options = [
            {
                index: Mode.SOLO,
                icon: "singleplayer",
                title: t`SINGLEPLAYER`,
                name: "singleplayer",
            },
        ];

        if (IS_MULTIPLAYER_ENABLED(exhibit)) {
            options.push({
                index: Mode.MULTIPLAYER,
                icon: "multiplayer",
                title: t`MULTIPLAYER`,
                name: "multiplayer",
            });
        }

        const filteredArtworks = Object.values(exhibit.artworks || {}).filter(
            (artwork: any) => {
                return artwork?.data?.mime_type !== "cyber/text";
            }
        );

        if (filteredArtworks.length) {
            options.push({
                index: Mode.VIRTUAL_TOUR,
                icon: "icon-06",
                title: t`VIRTUAL_TOUR_BETA`,
                name: "virtual-tour",
            });
        }

        if (IS_VR_SUPPORTED) {
            options.push({
                index: Mode.VR,
                icon: "not-in-vr",
                title: t`VR_HEADSET`,
                name: "vr-headset",
            });
        }

        if (options.length === 1) {
            setOptions([]);

            world.current.play();
        } else {
            setOptions(options);
        }
    }, [exhibit]);

    async function handleChangeMode(selected) {
        //

        let hasToggled = false;

        setLoading(selected);

        if (CURRENT_STATE === APP_STATES.EXPOSITION) {
            hasToggled = true;

            toggleModeMenu();

            setHidePanel(true);

            await world.current.setState(APP_STATES.SPACE);
        }

        if (
            Mode.MULTIPLAYER === selected &&
            selectedMode !== Mode.MULTIPLAYER
        ) {
            const switched = await changeMode("multiplayer");

            if (switched) {
                if (!IS_MOBILE) {
                    CANVAS.requestPointerLock();
                }
                setSelectedMode(Mode.MULTIPLAYER);
            }
        } else if (Mode.SOLO === selected && selectedMode !== Mode.SOLO) {
            if (mode === "multiplayer") {
                await changeMode("solo");
            }

            if (!IS_MOBILE) {
                CANVAS.requestPointerLock();
            }

            setSelectedMode(Mode.SOLO);
        } else if (Mode.VR === selected) {
            enterVR();
        } else if (
            Mode.VIRTUAL_TOUR === selected &&
            selectedMode !== Mode.VIRTUAL_TOUR
        ) {
            if (mode === "multiplayer") {
                await changeMode("solo");
            }
            setSelectedMode(Mode.VIRTUAL_TOUR);
        }

        if (!hasToggled) {
            toggleModeMenu(selected === Mode.VR);
        } else {
            setSelectedMode(selected);

            setHidePanel(false);
        }

        toggleTip({
            type: "mode",
            timeout: 5000,
            opts: {
                mode: selected,
            },
        });

        setLoading(-1);
    }

    if (options.length === 0) return null;

    return (
        <Container>
            {/* <Wheel /> */}
            <Wrapper>
                <ViewingWrapper>
                    <h3>{t`SWITCH_YOUR_VIEWING_MODE`}</h3>

                    <SliderWrapper>
                        {options.map(({ icon, index, name, title }) => {
                            return (
                                <ModeOption
                                    isActive={index === selectedMode}
                                    key={index}
                                    onClick={() => {
                                        handleChangeMode(index);
                                    }}
                                >
                                    <ModeOptionIcon>
                                        <IconImg
                                            size={32}
                                            mode="light"
                                            name={icon}
                                            style={
                                                Mode.MULTIPLAYER === index
                                                    ? {
                                                          transform:
                                                              "scale(1.4)",
                                                      }
                                                    : {}
                                            }
                                        />
                                    </ModeOptionIcon>
                                    {loading === index ? (
                                        <Spinner style={{ marginLeft: 12 }} />
                                    ) : (
                                        <p
                                            style={{
                                                textTransform: "capitalize",
                                            }}
                                        >
                                            {title}
                                        </p>
                                    )}
                                </ModeOption>
                            );
                        })}
                    </SliderWrapper>
                    <CloseSection
                        onClick={() => handleChangeMode(selectedMode)}
                        style={{}}
                    >
                        <IconImg size={46} mode="light" name="x" />
                    </CloseSection>
                </ViewingWrapper>
            </Wrapper>
        </Container>
    );
}

const Container = styled.div`
    position: absolute;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10000;
    color: #fff;
    display: flex;
    // padding-top: 20%;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);

    @media (max-height: 550px) {
        // align-items: flex-start;
        // padding-top: 38px;
    }

    p,
    h3 {
        margin: 0;
    }
`;

const Wrapper = styled.div`
    width: 80%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;

    max-width: 1000px;

    @media (max-width: 700px) {
        // width: 80%;
    }
`;

const SliderWrapper = styled.div`
    position: relative;
`;

const ModeOption = styled.div<{
    isActive?: boolean;
}>`
    display: flex;
    align-items: center;
    margin-bottom: 36px;
    margin-bottom: 24px;
    width: 240px;

    font-size: 20px;

    color: #ffffff;
    cursor: pointer;
    opacity: 0.6;

    @media (max-height: 550px) {
        margin-bottom: 12px;
    }

    p {
        margin-left: 24px;
        font-weight: 500;
        font-size: 20px;
    }

    &:hover {
        opacity: 1;
    }

    ${({ isActive }) => {
        return (
            isActive &&
            css`
                transform: scale(1.1);
                opacity: 1;
            `
        );
    }}
`;

const ViewingWrapper = styled.div`
    width: 100%;
    display: flex;
    align-items: center;
    flex-direction: column;
    position: relative;

    h3 {
        font-weight: 400;
        font-size: 14px;
        text-transform: uppercase;
        text-align: center;
        margin-bottom: 48px;
        margin-bottom: 32px;

        @media (max-height: 550px) {
            margin-bottom: 24px;
        }

        @media (max-width: 700px) {
            font-weight: 500;
            font-size: 24px;
            margin-bottom: 48px;
            text-transform: inherit;
        }
    }
`;

const CloseSection = styled.div`
    position: absolute;
    bottom: -48px;

    @media (max-height: 550px) {
        position: fixed;

        bottom: auto;
        top: 24px;
        left: 24px;
    }

    img {
        cursor: pointer;
    }
`;

const Footer = styled.div`
    margin-top: 5%;
`;

const ModeOptionIcon = styled.div``;
