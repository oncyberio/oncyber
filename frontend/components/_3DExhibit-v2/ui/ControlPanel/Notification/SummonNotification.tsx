import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import styled from "styled-components";

import Avatar from "@ui/components/Avatar";
import IconImg from "@ui/components/IconImg";
import {
    Action,
    AvatarWrapper,
    Button,
    Description,
    IconWrapper,
    Wrapper,
} from "@ui/components/ConfirmNotification/styles";

import { useCyberTranslation } from "@components/context/I18nContext";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { CHAT_TYPES } from "@components/_3DExhibit-v2/context/hooks/useChat";
import {
    SUMMON_COMMAND,
    useMultiplayer,
} from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { DEFAULT_PLAYER_AVATAR_PICTURE } from "@components/_3DExhibit-v2/three/constants";
import { SUMMON_TO_USER } from "@components/_3DExhibit-v2/three/factory/multiplayer/constants";

const SUMMON_COUNTDOWN_S = 5;

type SummonRequest = {
    sessionId: string;
    username?: string;
    avatar?: string;
    radius?: number;
    ts: number;
};

/**
 * Top-right countdown card shown when a mod broadcasts SUMMON_COMMAND
 * ("teleport all here"). Receivers already inside the summon radius never see
 * it (checked against the live 3D state on receive); everyone else gets 5
 * seconds to Reject, after which the client teleports itself onto a ring
 * around the target via the SUMMON_TO_USER world command.
 */
export default function SummonNotification() {
    //
    const { MultiplayerService, room, chat, voice } = useMultiplayer();

    const world = useWorld();

    const { t } = useCyberTranslation();

    const [request, setRequest] = useState<SummonRequest>(null);

    const [secondsLeft, setSecondsLeft] = useState(SUMMON_COUNTDOWN_S);

    const handleSummonCommand = useEventCallback(
        (data: any, senderSessionId: string) => {
            //
            if (!data?.sessionId) return;

            // The broadcast echoes back to the sender, and the target user
            // obviously stays put.
            if (senderSessionId === room.sessionId) return;
            if (data.sessionId === room.sessionId) return;

            // Already within the radius (or target unknown locally) -> the
            // summon isn't for us, no notification.
            const check = world.current?.handleCommand({
                type: SUMMON_TO_USER,
                payload: {
                    sessionId: data.sessionId,
                    radius: data.radius,
                    checkOnly: true,
                },
            });

            if (!check?.success || check.withinRadius) return;

            const playerInfo = chat.playersInfo?.[data.sessionId];

            setRequest({
                sessionId: data.sessionId,
                radius: data.radius,
                username: data.username || playerInfo?.userData?.username,
                avatar: playerInfo?.userData?.avatar,
                ts: Date.now(),
            });
        },
        [room?.sessionId]
    );

    useEffect(() => {
        if (!room?.id) return;

        MultiplayerService.current.onCommand(
            SUMMON_COMMAND,
            handleSummonCommand
        );

        return () => {
            MultiplayerService.current.offCommand(
                SUMMON_COMMAND,
                handleSummonCommand
            );
        };
    }, [room?.id]);

    const handleAccept = useEventCallback(() => {
        if (!request) return;

        // Re-resolves the target at fire time: no-op if we ended up within
        // the radius meanwhile, portal if they changed space, error if they
        // left the room.
        const response = world.current?.handleCommand({
            type: SUMMON_TO_USER,
            payload: {
                sessionId: request.sessionId,
                radius: request.radius,
            },
        });

        if (response?.success) {
            chat.pushMessage(
                response.summon
                    ? t`SUCCESSFULLY_TELEPORTED_TO_SPACE`
                    : t`SUCCESSFULLY_TELEPORTED`,
                CHAT_TYPES.INFO.label
            );
        }

        setRequest(null);
    }, [request]);

    useEffect(() => {
        if (!request) return;

        setSecondsLeft(SUMMON_COUNTDOWN_S);

        const timeout = setTimeout(handleAccept, SUMMON_COUNTDOWN_S * 1000);

        const interval = setInterval(() => {
            setSecondsLeft((s) => Math.max(0, s - 1));
        }, 1000);

        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
        };
    }, [request]);

    // Same corner as the voice-request stack — sit below it when it's showing.
    const top = voice?.voiceRequests?.length ? 130 : 20;

    return (
        <AnimatePresence>
            {request && (
                <motion.div
                    key={request.ts}
                    initial={{ opacity: 0, y: -12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{
                        opacity: 0,
                        y: -12,
                        scale: 0.95,
                        transition: { duration: 0.15 },
                    }}
                    style={{
                        top,
                        right: 20,
                        width: 375,
                        maxWidth: "calc(100vw - 40px)",
                        position: "fixed",
                        zIndex: 9999,
                    }}
                >
                    <Wrapper>
                        <Description>
                            <IconWrapper>
                                <IconImg
                                    size={19}
                                    mode={"light"}
                                    name={"multiplayer"}
                                />
                                <AvatarWrapper>
                                    <Avatar
                                        size={"tiny"}
                                        src={
                                            request.avatar ||
                                            DEFAULT_PLAYER_AVATAR_PICTURE
                                        }
                                    />
                                </AvatarWrapper>
                            </IconWrapper>
                            <p>
                                {t`ABOUT_TO_BE_TELEPORTED_TO`}{" "}
                                <b style={{ fontWeight: "500" }}>
                                    @{request.username || "anon"}
                                </b>
                            </p>
                        </Description>
                        <Action>
                            <Countdown>{secondsLeft}s</Countdown>
                            <Button onClick={() => setRequest(null)}>
                                {t`REJECT`}
                            </Button>
                        </Action>
                    </Wrapper>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

const Countdown = styled.div`
    height: 36px;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 500;
    font-size: 12px;
    line-height: 14px;
    color: #ffffff;
    opacity: 0.7;
    border-bottom: 1.5px solid rgba(255, 255, 255, 0.2);
`;
