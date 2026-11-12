import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import IconImg from "@ui/components/IconImg";
import { NButton } from "@ui/components/NButton";
import { useEffect, useState } from "react";
import styled, { css } from "styled-components";
import { Mode, usePanel } from "../../ControlPanel/context/PanelProvider";
import { Container } from "./shared";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";

export default function Mobile_AlternateMenu({ handleChangeMode }) {
    const { selectedMode, setMobileViewState, getBaseAnalytics } = usePanel();

    const [clickedContinue, setHasClickedContinue] = useState(false);

    const [selected, setSelected] = useState(Mode.VIRTUAL_TOUR);

    const [loading, setLoading] = useState(false);

    const { chat, voice, room } = useMultiplayer();

    useEffect(() => {
        //
        if (
            !chat.loading &&
            !voice.loading &&
            !room.loading &&
            clickedContinue
        ) {
            handleContinue();
        }
    }, [chat.loading, voice.loading, room.loading, clickedContinue]);

    async function handleContinue() {
        try {
            setLoading(true);
            // Make sure  multiplayer is fully loaded before we proceeed
            if (
                Mode.VIRTUAL_TOUR === selected &&
                (chat.loading || voice.loading || room.loading)
            ) {
                setHasClickedContinue(true);
                return;
            }

            await handleChangeMode(selected);

            if (selected === Mode.MULTIPLAYER) {
                setMobileViewState({
                    type: "TUTORIAL_1",
                });
            }

            setLoading(false);
        } catch (err) {
            console.log("errr", err);
            setLoading(false);
        }
    }

    return (
        <Container style={{ justifyContent: "flex-end" }}>
            <h3>Select Entry mode</h3>

            <ButtonsContainer>
                <ButtonContainer
                    onClick={() => {
                        setSelected(Mode.VIRTUAL_TOUR);
                        amplitude_logAnalyticsEvent(
                            "start_guided_tour",
                            getBaseAnalytics()
                        );
                    }}
                    isActive={selected === Mode.VIRTUAL_TOUR}
                >
                    <ButtonImgContainer>
                        <IconImg name="icon-06" mode="light" size={44} />
                    </ButtonImgContainer>
                    <p>Guided Tour</p>

                    <div className="recommended">
                        <IconImg
                            size={20}
                            style={
                                selected === Mode.VIRTUAL_TOUR
                                    ? { opacity: 1 }
                                    : { opacity: 0 }
                            }
                            name="check"
                            mode="light"
                        />
                        <span>recommended</span>
                    </div>
                </ButtonContainer>

                <ButtonContainer
                    onClick={() => setSelected(Mode.MULTIPLAYER)}
                    isActive={selected === Mode.MULTIPLAYER}
                >
                    <ButtonImgContainer>
                        <IconImg name="singleplayer" mode="light" size={44} />
                    </ButtonImgContainer>
                    <p>Free Mode</p>

                    <div className="recommended">
                        {selected === Mode.MULTIPLAYER && (
                            <IconImg name="check" mode="light" size={20} />
                        )}
                    </div>
                </ButtonContainer>
            </ButtonsContainer>

            <Button
                style={{ marginBottom: -4, paddingBottom: 28 }}
                disabled={loading}
                onClick={handleContinue}
            >
                {!loading ? "Continue" : "Loading…"}
            </Button>
        </Container>
    );
}

const ButtonsContainer = styled.div`
    display: flex;
    width: 100%;
`;

const ButtonContainer = styled.div<{
    isActive: boolean;
}>`
    width: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    backdrop-filter: blur(21.2928px);
    padding: 14% 4%;
    position: relative;
    font-size: 16px;

    &:first-child {
        border-top-left-radius: 20px;
    }
    &:last-child {
        border-top-right-radius: 20px;
    }

    @media (max-height: 500px) {
        padding: 8% 4%;
    }

    @media (max-height: 350px) {
        padding: 4%;
    }

    ${({ isActive }) =>
        isActive &&
        css`
            background: rgba(7, 7, 7, 0.45);
        `}

    .recommended {
        display: flex;
        align-items: center;
        text-transform: uppercase;
        font-size: 12px;
        position: absolute;
        left: 50%;
        bottom: 10px;
        transform: translateX(-50%);

        span {
            margin-left: 6px;
        }
    }
`;

const ButtonImgContainer = styled.div`
    margin-bottom: 18px;
`;

const Button = styled.button`
    background: #fff;
    border: none;
    outline: none;
    width: 100%;
    padding: 24px;
    font-weight: 500;
    font-size: 16px;
    color: #070707;
`;
