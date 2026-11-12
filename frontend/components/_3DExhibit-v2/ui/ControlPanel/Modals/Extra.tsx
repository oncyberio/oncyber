import { UtilityStack, UtilityRow } from "@features/content-host/NativeVisitorPanel";
import { ExperienceIcon } from "@features/content-host/ExperienceShell";
import styled, { css } from "styled-components";
import { Mode, usePanel } from "../context/PanelProvider";
import { IconGroup } from "./shared/IconGroup";
import { NotificationRound } from "../shared/styles";
import { IconButton } from "@ui/components/IconButton";
import { useEventCallback } from "@components/hooks/useEventCallback";
import {
    IS_MOBILE,
    CANVAS,
    CURRENT_STATE,
    APP_STATES,
    IS_VR_SUPPORTED,
} from "@components/_3DExhibit-v2/three/constants";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import { useCyberTranslation } from "@components/context/I18nContext";
import { useState, useContext } from "react";
import Spinner from "@ui/components/Spinner";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { UserContext } from "@components/context/UserContext";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";

export default function Extra({ onFlyMode, worldMode, switchMode, embedded = false }) {
    const [loading, setLoading] = useState(false);

    const {
        isPlaying,
        setCurrentTab,
        clickRef,
        selectedMode,
        setActiveProfileTab,
        setSelectedMode,
        toggleTip,
        setHidePanel,
        enterVR,
        isEditionAllowed,
        toggleAuth,
        getBaseAnalytics,
    } = usePanel();

    const world = useWorld();

    const { voice, changeMode, mode, room } = useMultiplayer();

    const { isMod, canEdit } = room;

    const { t } = useCyberTranslation();

    const { voiceRequests, hasNewVoiceRequests } = voice;

    const { user } = useContext(UserContext);

    const connectWallet = useEventCallback(() => {
        toggleAuth();
        setCurrentTab("");
    }, []);

    const changeCPMode = useEventCallback(async () => {
        if (!isPlaying) return;

        try {
            setLoading(true);

            let hasToggled = false;

            if (CURRENT_STATE === APP_STATES.EXPOSITION) {
                hasToggled = true;

                setHidePanel(true);

                await world.current.setState(APP_STATES.SPACE);
            }

            if (Mode.MULTIPLAYER === selectedMode) {
                if (mode === "multiplayer") {
                    await changeMode("solo");
                }
                setSelectedMode(Mode.VIRTUAL_TOUR);
            } else if (selectedMode === Mode.VIRTUAL_TOUR) {
                const switched = await changeMode("multiplayer");

                if (switched) {
                    if (!IS_MOBILE) {
                        CANVAS.requestPointerLock();
                    }
                    setSelectedMode(Mode.MULTIPLAYER);
                }
            }

            if (hasToggled) {
                setHidePanel(false);
            }

            if (selectedMode === Mode.VIRTUAL_TOUR) {
                amplitude_logAnalyticsEvent(
                    "end_guided_tour",
                    getBaseAnalytics()
                );
            } else {
                amplitude_logAnalyticsEvent(
                    "start_guided_tour",
                    getBaseAnalytics()
                );
            }
            toggleTip({
                type: "mode",
                timeout: 5000,
                opts: {
                    mode:
                        selectedMode === Mode.VIRTUAL_TOUR
                            ? Mode.MULTIPLAYER
                            : Mode.VIRTUAL_TOUR,
                },
            });

            await world.current.play();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    const toggleEditMode = useEventCallback(() => {
        if(!user?.id) {
            connectWallet();
            return;
        }
        switchMode(worldMode === "display" ? "edit" : "display");
    }, []);

    const toggleSettings = useEventCallback(async () => {
        setActiveProfileTab("settings");
        setCurrentTab((state) => (state === "profile" ? "" : "profile"));
    }, []);

    if (embedded) return (
        <UtilityStack ref={clickRef}>
            <p>Choose how you explore this space.</p>
            {selectedMode === Mode.MULTIPLAYER && (
                <UtilityRow type="button" onClick={onFlyMode}>
                    <ExperienceIcon name="flymode" size={20} />
                    <span>{t`FLY_MODE`}</span>
                </UtilityRow>
            )}
            <UtilityRow type="button" onClick={changeCPMode} disabled={loading}>
                <ExperienceIcon name="play" size={20} />
                <span>{selectedMode === Mode.VIRTUAL_TOUR ? t`STOP_TOUR` : t`GUIDED_TOUR`}</span>
                {loading && <Spinner />}
            </UtilityRow>
            {IS_VR_SUPPORTED && (
                <UtilityRow type="button" onClick={() => enterVR()}>
                    <ExperienceIcon name="not-in-vr" size={20} />
                    <span>{t`VR_HEADSET`}</span>
                </UtilityRow>
            )}
            {(canEdit || isEditionAllowed) && (
                <UtilityRow type="button" onClick={toggleEditMode}>
                    <ExperienceIcon name="pen-tool" size={20} />
                    <span>{worldMode === "display" ? t`EDIT_MODE` : t`EXIT_EDIT_MODE`}</span>
                </UtilityRow>
            )}
        </UtilityStack>
    );

    return (
        <Container ref={clickRef} isMobile={IS_MOBILE}>
            {voiceRequests?.length > 0 && (
                <IconGroup
                    onClick={() => {
                        setCurrentTab((state) =>
                            state === "voiceRequests" ? "" : "voiceRequests"
                        );
                    }}
                >
                    <IconButton
                        outline
                        mode="light"
                        size="small-plus"
                        name="mic"
                        className="btn-menu"
                    />
                    <span className="voice-request-wrapper">
                        {t`REQUESTS`}
                        {hasNewVoiceRequests && (
                            <NotificationRound style={{ marginLeft: 5 }} />
                        )}
                    </span>
                </IconGroup>
            )}

            {selectedMode === Mode.MULTIPLAYER && (
                <IconGroup onClick={onFlyMode}>
                    <IconButton
                        mode="light"
                        outline
                        size="small-plus"
                        name="flymode"
                        className="btn-menu"
                    />
                    <span>{t`FLY_MODE`}</span>
                </IconGroup>
            )}

            {/* <IconGroup>
                <IconButton
                    mode="dark"
                    outline
                    size="medium"
                    name="feed"
                    className="btn-menu"
                />
                <span>Spaces Feed</span>
            </IconGroup> */}

            {IS_VR_SUPPORTED && (
                <IconGroup onClick={() => enterVR()}>
                    <IconButton
                        outline
                        mode="light"
                        size="small-plus"
                        name="not-in-vr"
                        className="btn-menu"
                    />
                    <span>{t`VR_HEADSET`}</span>
                </IconGroup>
            )}

            <IconGroup onClick={() => setCurrentTab("explore")}>
                <IconButton
                    outline
                    mode="dark"
                    size="small-plus"
                    name="panel-feed"
                    className="btn-menu"
                />
                <span>{t`EXPLORE`}</span>
            </IconGroup>

            <IconGroup onClick={changeCPMode}>
                {loading ? (
                    <IconButton
                        outline={false}
                        size="small-plus"
                        style={{
                            border: "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "transparent",
                        }}
                    >
                        <Spinner />
                    </IconButton>
                ) : (
                    <IconButton
                        outline
                        mode="light"
                        size="small-plus"
                        name={
                            selectedMode === Mode.MULTIPLAYER
                                ? "icon-06"
                                : "multiplayer"
                        }
                        className="btn-menu"
                    />
                )}
                <span style={{ textTransform: "capitalize" }}>
                    {selectedMode === Mode.VIRTUAL_TOUR
                        ? t`STOP_TOUR`
                        : t`GUIDED_TOUR`}
                </span>
            </IconGroup>

            {/* {!IS_MOBILE && (
                <IconGroup
                    onClick={() => {
                        setCurrentTab((state) =>
                            state === "help" ? "" : "help"
                        );
                    }}
                >
                    <IconButton
                        outline
                        mode="dark"
                        size="small-plus"
                        name="help"
                        className="btn-menu"
                    />
                    <span>{t`HELP`}</span>
                </IconGroup>
            )} */}

            <IconGroup onClick={toggleSettings}>
                <IconButton
                    mode="light"
                    outline
                    size="small-plus"
                    name="settings"
                    className="btn-menu"
                />
                <span>{t`SETTINGS`}</span>
            </IconGroup>

            {(canEdit || isEditionAllowed) && (
                <IconGroup onClick={toggleEditMode} className="edit-mode">
                    <IconButton
                        mode="light"
                        outline
                        size="small-plus"
                        name="pen-tool"
                        className="btn-menu"
                    />
                    <span>
                        {worldMode === "display"
                            ? t`EDIT_MODE`
                            : t`EXIT_EDIT_MODE`}
                    </span>
                </IconGroup>
            )}

            {/* <IconGroup /> */}
        </Container>
    );
}

export const Container = styled.div<{ isMobile: boolean }>`
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    border-radius: 8px;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;

    @media (max-width: 830px) {
        justify-content: space-evenly;
    }

    ${({ isMobile }) => {
        return (
            isMobile &&
            css`
                justify-content: space-evenly;
            `
        );
    }}

    .edit-mode {
        & > span {
            max-width: 100%;
        }
    }
`;
