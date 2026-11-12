import { useCyberTranslation } from "@components/context/I18nContext";
import { UserContext } from "@components/context/UserContext";

import { useOnClickOutside } from "@components/hooks/useClickOutside";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useStateRef } from "@components/hooks/useStateRef";

import { CHAT_TYPES } from "@components/_3DExhibit-v2/context/hooks/useChat";
import { AdminVoiceCommand } from "@components/_3DExhibit-v2/context/hooks/useVoice";

import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";

import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";

import {
    GET_USERS_INFO,
    GET_USER_INFO,
    TELEPORT_TO_USER,
} from "@components/_3DExhibit-v2/three/factory/multiplayer/constants";

import Avatar from "@ui/components/Avatar";

import { IconButton } from "@ui/components/IconButton";

import IconImg from "@ui/components/IconImg";

import Spinner from "@ui/components/Spinner";
import { delay } from "@utils/js";
import { EventCallbacks, Events } from "@utils/voiceChat/types";

import { useContext, useEffect, useRef, useState } from "react";

import styled, { css } from "styled-components";

import UserDropdown from "./UserDropdown";

export default function User({
    avatarSrc,
    username,
    userId,
    setSelectedUser,
    user,
    setCurrentTab,
    addModalTogglerRef,
    sceneContainer,
}) {
    const { user: _user } = useContext(UserContext);

    const { chat, voice, room, MultiplayerService } = useMultiplayer();

    const { voiceUsers, admin_setUserVoice, voiceService } = voice;

    const { isMod, sessionId } = room;

    const { pushMessage } = chat;

    const world = useWorld();

    const dropTargetRef = useRef(null);

    const { t } = useCyberTranslation();

    const [loading, setLoading] = useState<AdminVoiceCommand>(null);

    const [isDropdownShowing, setDropdownShowing] = useState(false);

    const { clickRef, addTogglerRef } = useOnClickOutside({
        handler: () => {
            setDropdownShowing(false);
        },
    });

    const avatarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        //
        if (voiceService == null) return;

        const handleVolumeIndicator: EventCallbacks["VOLUME_INDICATOR"] = ({
            channel,
            volumes,
        }) => {
            if (channel !== "mic" || avatarRef.current == null) return;

            let _isSpeaking = false;

            const vol = volumes[user?.sessionId];

            if (vol?.isActive) {
                _isSpeaking = true;
            }

            avatarRef.current.classList.toggle("speaking", _isSpeaking);
        };

        voiceService.on(Events.VOLUME_INDICATOR, handleVolumeIndicator);

        return () => {
            voiceService.off(Events.VOLUME_INDICATOR, handleVolumeIndicator);
        };
        //
    }, [user?.sessionId, voiceService]);

    /*
    async function handleRange(range) {
        world.current.handleCommand({
            type: SET_VOICE_RANGE,
            payload: {
                range,
            },
        });

        const result =
            await MultiplayerService.current.roomService.voiceChat.updateVoiceRange(
                currentExhibit.id,
                range,
                token
            );

        if (result.success === true) {
            pushMessage(
                "Voice range updated! sending update to all users",
                CHAT_TYPES.INFO.label
            );

            MultiplayerService.current.roomService.room.send("voice-range", [
                range,
                token,
            ]);
        } else {
            pushMessage(
                result.error || "Unexpected error",
                CHAT_TYPES.ALERT.label
            );
        }
    }
    */

    function handleOpenProfile() {
        // we don't open anon profiles
        if (user?.userData?.username === user?.userData?.walletId) return;

        setSelectedUser(user);

        setCurrentTab("profile-explore");
    }

    const handleMute = useEventCallback(async (action: AdminVoiceCommand) => {
        if (!isMod) return;
        if (loading) return;

        if (!voiceUsers[user.sessionId]) return;

        try {
            setLoading(action);

            const response = world.current.handleCommand({
                type: GET_USER_INFO,
                payload: {
                    username,

                    sessionId: user.sessionId,
                },
            }) as any;

            if (!response.success) {
                pushMessage(t`NO_USER_FOUND`, CHAT_TYPES.ALERT.label);

                return;
            }

            await admin_setUserVoice(response.userPayload.sessionId, action);

            await delay(2000);

            //
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(null);
        }
    }, []);

    const voiceUser = voiceUsers[user.sessionId];
    const isPlaying = voiceUser?.isPlaying;
    const isUsingMic = voiceUser && !voiceUser.isMuted;

    const withLoadingState = (
        type: AdminVoiceCommand,
        element: JSX.Element
    ) => {
        if (type === loading) {
            return (
                <Spinner
                    style={{
                        width: "16px",
                        height: "16px",
                    }}
                />
            );
        }

        return element;
    };

    function handleTeleport() {
        const response = world.current.handleCommand({
            type: TELEPORT_TO_USER,
            payload: {
                username,

                sessionId,
            },
        }) as any;

        if (!response.success) {
            pushMessage(response.message, CHAT_TYPES.ALERT.label);
        } else {
            setCurrentTab("");

            pushMessage(t`SUCCESSFULLY_TELEPORTED`, CHAT_TYPES.INFO.label);
        }
    }

    return (
        <UserWrapper>
            <div className="profile" onClick={() => handleOpenProfile()}>
                <AvatarWrapper ref={avatarRef}>
                    <Avatar
                        size="small"
                        style={{ border: "none" }}
                        src={avatarSrc}
                    />
                </AvatarWrapper>

                <p className="title">{username || userId}</p>
            </div>

            {(room.sessionId !== user.sessionId || isMod) && (
                <div>
                    {isMod && voiceUser && room.sessionId !== user.sessionId && (
                        <AudioWrapper style={{ marginRight: 16 }}>
                            <div style={{ marginLeft: 16 }}>
                                <div className="audio-icons">
                                    {isPlaying &&
                                        withLoadingState(
                                            AdminVoiceCommand.STOP_SHARED_STREAM,
                                            <div
                                                className="audio-icon"
                                                title={t`STOP_USER_SHARED_AUDIO_STREAM`}
                                                onClick={() => {
                                                    //
                                                    if (!isPlaying) return;

                                                    handleMute(
                                                        AdminVoiceCommand.STOP_SHARED_STREAM
                                                    );
                                                }}
                                            >
                                                <IconImg
                                                    size={16}
                                                    title={t`STOP_USER_SHARED_AUDIO_STREAM`}
                                                    name={"broadcasting"}
                                                    mode="light"
                                                    className="audio-icon"
                                                />
                                            </div>
                                        )}

                                    {withLoadingState(
                                        AdminVoiceCommand.MUTE_MIC,
                                        <div
                                            className={`audio-icon ${
                                                isUsingMic ? "" : "disabled"
                                            }`}
                                            title={
                                                isUsingMic
                                                    ? t`MUTE_USER_MIC`
                                                    : ""
                                            }
                                            onClick={() => {
                                                if (!isUsingMic) return;

                                                handleMute(
                                                    AdminVoiceCommand.MUTE_MIC
                                                );
                                            }}
                                        >
                                            <IconImg
                                                size={16}
                                                name={
                                                    isUsingMic
                                                        ? "mic"
                                                        : "mic-off"
                                                }
                                                mode="light"
                                            />
                                        </div>
                                    )}

                                    {withLoadingState(
                                        AdminVoiceCommand.REVOKE_AUDIO_PERMISSION,
                                        <div
                                            className={`audio-icon`}
                                            title={t`REVOKE_USER_AUDIO_PERMISSION`}
                                            onClick={() => {
                                                //
                                                handleMute(
                                                    AdminVoiceCommand.REVOKE_AUDIO_PERMISSION
                                                );
                                            }}
                                        >
                                            <IconImg
                                                size={16}
                                                name="user-x"
                                                mode="light"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </AudioWrapper>
                    )}

                    <div style={{ position: "relative" }} ref={dropTargetRef}>
                        <div
                            onClick={() =>
                                setDropdownShowing((state) => !state)
                            }
                            ref={(el) => addTogglerRef("parent", el)}
                        >
                            <IconButton
                                size="xsmall"
                                style={{ border: "1px solid #f5f5f54d" }}
                                mode="light"
                                outline
                                name="more-horizontal"
                            />
                        </div>

                        {isDropdownShowing ? (
                            <UserDropdown
                                dropTargetRef={dropTargetRef}
                                clickRef={clickRef}
                                addModalTogglerRef={addModalTogglerRef}
                                sceneContainer={sceneContainer}
                                user={user}
                            />
                        ) : null}
                    </div>
                </div>
            )}
        </UserWrapper>
    );
}

const UserWrapper = styled.div`
    display: flex;
    justify-content: space-between;

    & > div {
        display: flex;
        align-items: center;
    }

    .profile {
        cursor: pointer;
    }

    .title {
        font-size: 14px;
        font-weight: 500;
        margin-left: 8px;
        text-overflow: ellipsis;
        max-width: 8em;
        overflow: hidden;
        white-space: nowrap;
    }
`;

const AvatarWrapper = styled.div`
    border: 2px solid white;
    box-sizing: initial;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;

    &.speaking {
        border: 2px solid #00e3bd;
    }
`;

const AudioWrapper = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;

    & .audio-icons {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;

        & > .audio-icon {
            cursor: pointer;
        }

        & > .audio-icon.disabled {
            cursor: default;
        }
    }
`;
