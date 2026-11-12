import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";

import {
    AUDIO_CAPTURE_SUPPORTED,
    IS_MOBILE,
} from "@components/_3DExhibit-v2/three/constants";

import { IconButton, SubtractButton } from "@ui/components/IconButton";

import MessageCircle from "@ui/components/Icons/MessageCircle";

import Spinner from "@ui/components/Spinner";

import { useEffect, useRef, useState } from "react";

import { usePanel, Mode } from "../../context/PanelProvider";
import Helper from "../shared/Helper";
import ProfileBtn from "../shared/ProfileBtn";
import ScreenshotBtn from "../shared/ScreenshotBtn";

import { ControlPanelIcon, PanelContainer } from "../shared/styles";

import { useCyberTranslation } from "@components/context/I18nContext";

import ExtraBtn from "../shared/ExtraBtn";
import TooltipNotification from "../../Notification/Tooltip";

import AudioSettings from "../../Modals/AudioSettings";
import { useOnClickOutside } from "@components/hooks/useClickOutside";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { NotificationWrapper } from "../../shared/styles";

import { isInIFrame } from "@utils/js";
import { AudioType } from "@components/_3DExhibit-v2/context/hooks/useVoice";
import { useMediaPlaceholders } from "../../shared/useMediaPlaceholders";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";

const iFrameDetection = isInIFrame();

const formatter = new Intl.NumberFormat("en", {
    notation: "compact",
});

export default function MultiPanel() {
    //
    const { voice, chat, room } = useMultiplayer();

    const { t } = useCyberTranslation();

    const hasRequestMic = useRef(false);

    const { numOfUsers, failedToJoin } = room;

    const [isMicHover, setMicHover] = useState(false);

    // When the visitor last asked to speak with no moderator there.
    const [noModeratorAt, setNoModeratorAt] = useState(0);

    const {
        loading,
        voiceState,
        toggleMuted,
        requestVoicePermission,
        cancelVoicePermissionRequest,
        togglePlaying,
    } = voice;

    const { admins } = chat;

    const {
        selectedMode,
        currentTab,
        setCurrentTab,
        addTogglerRef,
        toggleMicSettings,
        openMicSettings,
        getBaseAnalytics,
    } = usePanel();

    const { nbAvailable } = useMediaPlaceholders();

    const { addTogglerRef: addToggleRef, clickRef } = useOnClickOutside({
        handler: () => {
            toggleMicSettings(false);
        },
    });

    async function handlePermission(name: AudioType) {
        if (admins.length === 0) {
            amplitude_logAnalyticsEvent("no_mod_available_error", {
                type: name,
                ...getBaseAnalytics(),
            });
            // Said above the button they pressed (Notification/Tooltip).
            return setNoModeratorAt(Date.now());
        }

        amplitude_logAnalyticsEvent("request_voice", {
            type: name,
            ...getBaseAnalytics(),
        });
        await requestVoicePermission(name);
        if (name === "mic") hasRequestMic.current = true;
    }

    async function handlePreventEnter(e) {
        if (e.keyCode === 13) {
            e.preventDefault();
        }
    }

    const handleToggleBroadcast = useEventCallback(() => {
        if (voiceState?.type === "disabled") {
            return handlePermission("broadcast");
        }
        if (voiceState?.state?.isPlaying) {
            amplitude_logAnalyticsEvent("stop_broadcast", getBaseAnalytics());
            return togglePlaying(false);
        } else if (currentTab === "audioSharing") {
            setCurrentTab("");
        } else {
            setCurrentTab("audioSharing");
        }
    }, []);

    useEffect(() => {
        //
        function handleKeys(e) {
            if (
                e.target.nodeName === "INPUT" ||
                e.target.nodeName === "TEXTAREA"
            ) {
                return;
            }

            if (e.key === "m" || e.key === "M") {
                toggleMuted();
            }
        }

        window.addEventListener("keydown", handleKeys);

        return () => {
            window.removeEventListener("keydown", handleKeys);
        };
    }, [toggleMuted]);

    useEffect(() => {
        //
        if (nbAvailable === 0 && currentTab === "select-media-placeholder") {
            //
            setCurrentTab("");
        }
    }, [nbAvailable, currentTab]);

    return (
        <PanelContainer
            currentTab={currentTab}
            isHidden={currentTab === "profile" || currentTab === "settings"}
        >
            {/** show helper notification */}
            <NotificationWrapper>
                <TooltipNotification
                    hasRequestMic={hasRequestMic?.current}
                    noModeratorAt={noModeratorAt}
                />
                <Helper />
            </NotificationWrapper>

            {/** voice is being initialized */}
            {loading && (
                <IconButton
                    variants="studio"
                    size="medium-plus"
                    className="mic-margin"
                    onMouseEnter={() => {
                        setCurrentTab("");
                    }}
                    style={{
                        border: "none",
                        // backdropFilter: "blur(20px)",
                        background: "rgba(7, 7, 7, 0.6)",
                    }}
                >
                    <Spinner />
                </IconButton>
            )}

            {/** No voice permission */}
            {!loading && voiceState.type === "disabled" && (
                <ControlPanelIcon
                    isMobile={IS_MOBILE}
                    onMouseEnter={() => {
                        setCurrentTab("");
                    }}
                    onClick={() => handlePermission("mic")}
                >
                    <span>{t`REQUEST_AN_ADMIN_FOR_VOICE`}</span>
                    <IconButton
                        //disabled={admins.length === 0}
                        style={{
                            border: "none",
                            background: "rgba(7, 7, 7, 0.6)",
                            // backdropFilter: "blur(20px)",
                        }}
                        mode="light"
                        variants="studio"
                        name="mic-plus"
                        size="medium-plus"
                    />
                </ControlPanelIcon>
            )}

            {!loading && voiceState.type === "pending" && (
                <ControlPanelIcon
                    isMobile={IS_MOBILE}
                    onMouseEnter={() => {
                        setCurrentTab("");
                    }}
                    onClick={() => {
                        // A withdrawn request was not denied by anyone.
                        hasRequestMic.current = false;
                        cancelVoicePermissionRequest();
                    }}
                >
                    <span>
                        {t`A_VOICE_REQUEST_HAS_BEEN_SENT`} · {t`CANCEL`}
                    </span>
                    <IconButton
                        variants="studio"
                        size="medium-plus"
                        style={{
                            border: "none",
                            // backdropFilter: "blur(20px)",
                            background: "rgba(7, 7, 7, 0.6)",
                        }}
                    >
                        <Spinner />
                    </IconButton>
                </ControlPanelIcon>
            )}

            {openMicSettings && !loading && voiceState.type === "enabled" && (
                <AudioSettings ref={clickRef} />
            )}

            {!loading && voiceState.type === "enabled" && (
                <>
                    <ControlPanelIcon
                        isMobile={IS_MOBILE}
                        onMouseEnter={() => {
                            setCurrentTab("");
                        }}
                    >
                        {!openMicSettings && !isMicHover && (
                            <span>
                                {voiceState.state.isMuted
                                    ? t`UNMUTE`
                                    : t`MUTED`}{" "}
                                {t`MIC`} <span>(M)</span>
                            </span>
                        )}

                        <IconButton
                            mode="light"
                            size="xsmall"
                            variants="studio"
                            className="btn-right-subtract-panel"
                            name={
                                !openMicSettings ? "chevron-down" : "chevron-up"
                            }
                            style={{
                                width: "20px",
                                height: "20px",
                                minWidth: "20px",
                                minHeight: "20px",
                            }}
                            ref={(el) => {
                                addToggleRef("audio-settings", el);
                            }}
                            onMouseEnter={() => setMicHover(true)}
                            onMouseLeave={() => setMicHover(false)}
                            onClick={() =>
                                toggleMicSettings((prevState) => !prevState)
                            }
                        />

                        <SubtractButton
                            onClick={() => {
                                if (!voiceState.state.isMuted) {
                                    amplitude_logAnalyticsEvent(
                                        "mute_voice",
                                        getBaseAnalytics()
                                    );
                                } else {
                                    amplitude_logAnalyticsEvent(
                                        "unmute_voice",
                                        getBaseAnalytics()
                                    );
                                }
                                toggleMuted();
                            }}
                            active={!voiceState.state.isMuted}
                            mode="light"
                            size="medium-plus"
                            className="icon-btn-panel icon-mic"
                            name={voiceState.state.isMuted ? "mic-off" : "mic"}
                        />
                    </ControlPanelIcon>
                </>
            )}

            {loading ? (
                <IconButton
                    variants="studio"
                    size="medium-plus"
                    className="mic-margin"
                    onMouseEnter={() => {
                        setCurrentTab("");
                    }}
                    style={{
                        border: "none",
                        // backdropFilter: "blur(20px)",
                        background: "rgba(7, 7, 7, 0.6)",
                    }}
                >
                    <Spinner />
                </IconButton>
            ) : (
                selectedMode === Mode.MULTIPLAYER &&
                AUDIO_CAPTURE_SUPPORTED &&
                !iFrameDetection && (
                    <>
                        <ControlPanelIcon
                            isMobile={IS_MOBILE}
                            onMouseEnter={() => {
                                if (currentTab !== "audioSharing") {
                                    setCurrentTab("");
                                }
                            }}
                            onClick={handleToggleBroadcast}
                            className="control-panel_icon"
                        >
                            <span>
                                {voiceState?.state?.isPlaying
                                    ? t`STOP_BROADCAST`
                                    : t`BROADCAST`}
                            </span>

                            <IconButton
                                variants="studio"
                                size="medium-plus"
                                mode={"dark"}
                                name={
                                    voiceState?.state?.isPlaying
                                        ? "stop-broadcasting"
                                        : "cast"
                                }
                                style={{
                                    border: "none",
                                    // backdropFilter: "blur(20px)",
                                    background: "rgba(7, 7, 7, 0.6)",
                                    cursor: AUDIO_CAPTURE_SUPPORTED
                                        ? "pointer"
                                        : "not-allowed",
                                }}
                                active={voiceState?.state?.isPlaying}
                                disabled={!AUDIO_CAPTURE_SUPPORTED}
                                ref={(el) => addTogglerRef("loopback", el)}
                            />
                        </ControlPanelIcon>

                        {nbAvailable > 0 &&
                            voiceState.type === "enabled" &&
                            voiceState.state.isPlaying &&
                            voiceState.state.videoStreamState?.hasVideo && (
                                <ControlPanelIcon
                                    isMobile={IS_MOBILE}
                                    onMouseEnter={() => {
                                        if (
                                            currentTab !==
                                            "select-media-placeholder"
                                        ) {
                                            setCurrentTab("");
                                        }
                                    }}
                                    onClick={() =>
                                        setCurrentTab(
                                            "select-media-placeholder"
                                        )
                                    }
                                    className="control-panel_icon"
                                >
                                    <span>Change placeholder</span>

                                    <IconButton
                                        variants="studio"
                                        size="medium-plus"
                                        mode={"dark"}
                                        name="aspect-ratio"
                                        style={{
                                            border: "none",
                                            // backdropFilter: "blur(20px)",
                                            background: "rgba(7, 7, 7, 0.6)",
                                            cursor: "pointer",
                                        }}
                                    />
                                </ControlPanelIcon>
                            )}
                    </>
                )
            )}

            <ControlPanelIcon
                isMobile={IS_MOBILE}
                onClick={() => chat.setIsChatDisplayed((state) => !state)}
                onKeyDown={handlePreventEnter}
                className="chat-btn"
            >
                {/* <span>
                        {t`TOGGLE_CHAT`} <span>(V)</span>
                    </span> */}

                <IconButton
                    mode="dark"
                    active={chat.isChatDisplayed}
                    variants="studio"
                    size="medium-plus"
                    name="message-square"
                    className="icon-btn-panel"
                >
                    <MessageCircle
                        mode="dark"
                        fill={"none"}
                        color="#fff"
                        size={18}
                        name="message-square"
                    />
                </IconButton>
            </ControlPanelIcon>

            <ControlPanelIcon
                isMobile={IS_MOBILE}
                ref={(el) => addTogglerRef("users", el)}
                onMouseEnter={() => {
                    if (currentTab !== "users") {
                        setCurrentTab("");
                    }
                }}
                onClick={() =>
                    setCurrentTab((state) => (state === "users" ? "" : "users"))
                }
            >
                <span>
                    {t`USERS_LIST`} <span>(U)</span>
                </span>
                <div className="text-right-subtract-panel">
                    {failedToJoin ? (
                        <div className="dot red" />
                    ) : (
                        <>
                            <div className="dot" />
                            <span>{formatter.format(numOfUsers)}</span>
                        </>
                    )}
                </div>

                <SubtractButton
                    mode="light"
                    name="users"
                    subtractSize="large"
                    size="medium-plus"
                    className="icon-btn-panel"
                    active={currentTab === "users"}
                />
            </ControlPanelIcon>

            {!IS_MOBILE && <ScreenshotBtn />}

            <ExtraBtn />

            <ProfileBtn />
        </PanelContainer>
    );
}
