import { useCyberTranslation } from "@components/context/I18nContext";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { PlayerInfo } from "@components/_3DExhibit-v2/context/hooks/useChat";
import { EnabledVoiceState } from "@components/_3DExhibit-v2/context/hooks/useVoice";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { IS_MOBILE } from "@components/_3DExhibit-v2/three/constants";
import {
    GET_USERS_INFO,
    GET_USER_INFO,
} from "@components/_3DExhibit-v2/three/factory/multiplayer/constants";
import IconImg from "@ui/components/IconImg";
import { EventCallbacks, Events } from "@utils/voiceChat/types";
import React, { useContext, useEffect, useState } from "react";
import styled from "styled-components";
import { Mode, usePanel } from "../../context/PanelProvider";

const ModeIcon = ({ selectedMode, size = 24 }) => {
    let name;

    if (selectedMode === Mode.MULTIPLAYER) {
        name = "multiplayer";
    } else if (selectedMode === Mode.SOLO) {
        name = "singleplayer";
    } else if (selectedMode === Mode.VIRTUAL_TOUR) {
        name = "icon-06";
    } else if (selectedMode == Mode.VR) {
        name = "not-in-vr";
    } else {
        return <></>;
    }

    return <IconImg size={size} mode={"light"} name={name} />;
};

export default function Helper() {
    //

    const world = useWorld();

    const { voice, chat, room } = useMultiplayer();

    const { t, i18n } = useCyberTranslation();

    const { voiceUsers, voiceState, voiceService } = voice;

    const [speakingPrompt, setSpeakingPrompt] = useState<PlayerInfo[]>(null);

    const {
        selectedMode,
        currentTab,
        artwork,
        tip,
        setCurrentTab,
        setSelectedUser,
    } = usePanel();

    useEffect(() => {
        //

        //
        if (voiceService == null || world.current == null) return;

        const handleVolumeIndicator: EventCallbacks["VOLUME_INDICATOR"] = ({
            channel,
            volumes,
        }) => {
            //
            let speaking = [];
            let playing = [];

            const playersInfo = chat.playersInfo;

            const updateUserStats = (
                id: string,
                userVoiceState: EnabledVoiceState
            ) => {
                //
                const player = playersInfo[id];

                const volume = volumes[id];

                if (userVoiceState?.isPlaying) {
                    playing.push({
                        ...player,
                        type: "playing",
                    });
                } else if (volume?.inactiveTime < 1500) {
                    //speaking.push(`${username}`);
                    speaking.push(player);
                }
            };

            Object.keys(voiceUsers).forEach((id) => {
                //
                updateUserStats(id, voiceUsers[id]);
            });

            if (voiceState.type === "enabled") {
                //
                updateUserStats(room.sessionId, voiceState.state);
            }

            if (playing.length || speaking.length) {
                let elems = playing.concat(speaking);
                setSpeakingPrompt(elems);
            } else {
                setSpeakingPrompt(null);
            }
        };

        voiceService.on(Events.VOLUME_INDICATOR, handleVolumeIndicator);

        return () => {
            voiceService.off(Events.VOLUME_INDICATOR, handleVolumeIndicator);
        };
        //
    }, [voiceService, world, voiceUsers, voiceState]);

    const handleOpenProfile = useEventCallback(
        ({ sessionId, userId, userData }: PlayerInfo) => {
            const { username, avatar, walletId } = userData;

            // we don't open anon profiles
            if (username === walletId) return;

            const _username = username ?? walletId?.slice?.(0, 10);

            if (walletId !== userId && walletId === _username) return;

            const response = world.current.handleCommand({
                type: GET_USER_INFO,
                payload: {
                    username,
                    sessionId,
                },
            });

            if (!response.success) return;

            const user = {
                userData: {
                    walletId:
                        response.userPayload?.userData?.walletId || walletId,
                    avatar,
                    username: _username,
                },
                userId: walletId,
            };

            if (!user?.userData?.username) return;

            // chat.setIsChatDisplayed(false);
            setSelectedUser(user);
            setCurrentTab("profile-explore");
        },
        []
    );

    let mode = "";

    if (selectedMode === Mode.MULTIPLAYER) {
        mode = t`MULTIPLAYER`;
    } else if (selectedMode === Mode.SOLO) {
        mode = t`SOLO`;
    } else if (selectedMode === Mode.VIRTUAL_TOUR) {
        mode = t`VIRTUAL_TOUR`;
    }

    if (currentTab || !tip) return null;

    let message = null;

    if (tip?.type === "tip")
        message = (
            <ModeTipWrapper>
                {!IS_MOBILE ? (
                    <>
                        <IconImg
                            style={{ padding: 4 }}
                            size={24}
                            mode="light"
                            name={"c-key"}
                        />{" "}
                        {t`TO_SWITCH_BETWEEN_ST_AND_3RD_PERSON`}
                    </>
                ) : (
                    <>
                        <IconImg
                            style={{ padding: 4 }}
                            size={24}
                            mode="light"
                            name={"icon_tap"}
                        />{" "}
                        {t`TAP_PFP`}
                    </>
                )}
            </ModeTipWrapper>
        );

    if (tip?.type === "mode")
        message = (
            <ModeTipWrapper>
                <ModeIcon selectedMode={selectedMode} />{" "}
                {i18n == "ja" ? (
                    <>
                        <strong>
                            {" "}
                            {mode} {t`MODE`}.
                        </strong>{" "}
                        {t`YOU_JUST_JOINED_IN`}
                    </>
                ) : (
                    <>
                        {t`YOU_JUST_JOINED_IN`}{" "}
                        <strong>
                            {" "}
                            {mode} {i18n !== "zh" && t`MODE`}.
                        </strong>
                    </>
                )}
            </ModeTipWrapper>
        );

    if (artwork && tip?.type === "artwork") {
        // let owner =
        //     artwork?.owner?.user?.username ||
        //     artwork?.owner?.address?.slice?.(0, 6);
        // let creator =
        //     artwork?.creator?.user?.username ||
        //     artwork?.creator?.address?.slice?.(0, 6);
        // const name =
        //     artwork?.name ||
        //     `${artwork?.collection?.name} #${artwork?.token_id}` ||
        //     `${artwork?.contract_address}`;
        // if (owner == "NullAddress") owner = null;
        // message = (
        //     <ModeTipWrapper>
        //         <ModeIcon size={16} selectedMode={selectedMode} />
        //         &nbsp;Showing: <strong>{name}</strong>
        //         {creator && ` by ${creator}`}
        //         {owner && `, owner: ${owner}`}
        //     </ModeTipWrapper>
        // );
    }

    const speaking = speakingPrompt?.filter((element) => element !== undefined);

    if (speaking?.length && tip?.type === "speaking") {
        message = (
            <ModeTipWrapper className="scrollbar-hidden">
                <div>
                    {t`LIVE_AUDIO`}:{" "}
                    <>
                        {speakingPrompt.map((player, index) => {
                            const username =
                                player?.userData?.username || player?.userId;

                            return (
                                <React.Fragment key={index}>
                                    <strong
                                        style={{
                                            cursor: "pointer",
                                        }}
                                        onClick={() => {
                                            handleOpenProfile(player);
                                        }}
                                    >
                                        {player?.type === "playing"
                                            ? "🔊 "
                                            : null}
                                        {username}
                                    </strong>
                                    {index !== speakingPrompt.length - 1
                                        ? ", "
                                        : null}
                                </React.Fragment>
                            );
                        })}
                    </>
                </div>
            </ModeTipWrapper>
        );
    }

    return (
        message && (
            <Container className="helper-container" key={mode}>
                {message}
            </Container>
        )
    );
}

const Container = styled.div`
    border-radius: 900px;
    /* position: absolute;
    left: 50%;
    transform: translateX(-50%); */

    white-space: nowrap;
    overflow: hidden;
    //width: 80%;
    background: rgba(7, 7, 7, 0.6);
    // backdrop-filter: blur(40px);
    padding: 6px 12px;
    font-size: 12px;
    line-height: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    animation-name: show;
    animation-duration: 0.5s;
    animation-fill-mode: forwards;
    max-width: 100%;

    @keyframes show {
        0% {
            opacity: 0;
            //bottom: 0;
        }

        100% {
            opacity: 1;
            //bottom: 102px;
        }
    }
`;

const ModeTipWrapper = styled.div`
    overflow: auto;

    font-size: 12px;
    color: #c2c2c2;
    padding: 2px 8px;

    display: flex;
    align-items: center;
    gap: 0px 4px;

    img {
        margin-left: 4px;
    }

    strong {
        color: #fff;
        font-weight: 500;
    }

    & .vert-stack {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
`;
