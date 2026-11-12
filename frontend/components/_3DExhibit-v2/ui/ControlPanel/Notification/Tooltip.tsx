import Events from "@3events";
import { sleep } from "@utils/js";
import styled from "styled-components";
import { AnimatePresence, motion } from "framer-motion";
import IconImg from "@ui/components/IconImg";
import React, { useEffect, useState } from "react";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import { useCyberTranslation } from "@components/context/I18nContext";

// Used until the locales carry MIC_REQUEST_EXPIRED.
const MIC_REQUEST_EXPIRED = "Your request expired. Ask again.";
// Used for a locale that does not carry NO_MODERATOR_TO_APPROVE yet.
const NO_MODERATOR_TO_APPROVE =
    "No moderator is here to let you speak. Try again later.";

export default function Tooltip({
    hasRequestMic,
    noModeratorAt,
}: {
    hasRequestMic?: boolean;
    /**
     * Changes each time the visitor asks to speak while no moderator is
     * there; the refusal is shown here, above the button they pressed.
     */
    noModeratorAt?: number;
}) {
    const [notifications, setNotifications] = useState<
        Array<{
            id?: number;
            username?: string;
            type?:
                | "joined"
                | "approved"
                | "denied"
                | "expired"
                | "leave"
                | "no-moderator";
        }>
    >([]);

    const { t } = useCyberTranslation();

    const world = useWorld();

    const { voice, room } = useMultiplayer();

    const { voiceState } = voice;

    useEffect(() => {
        function handlePushNotification() {
            const prevId = notifications[notifications?.length - 1]?.id || 0;

            if (voiceState?.type === "enabled" && !room?.isMod) {
                setNotifications((prevState) => [
                    ...prevState,
                    {
                        type: "approved",
                        id: prevId + 1,
                    },
                ]);
            } else if (
                voiceState?.type === "disabled" &&
                !room?.isMod &&
                hasRequestMic
            ) {
                // Only a moderator's answer is a denial. A request that ran
                // out of time says so; one the visitor withdrew says nothing.
                const type = voiceState?.leaveAsSpeaker
                    ? "leave"
                    : voiceState?.request === "expired"
                    ? "expired"
                    : voiceState?.request === "withdrawn"
                    ? null
                    : "denied";
                if (type)
                    setNotifications((prevState) => [
                        ...prevState,
                        {
                            type,
                            id: prevId + 1,
                        },
                    ]);
            }

            if (world?.current?.setEventListener) {
                world.current.setEventListener(Events.PLAYER_JOINED, (opts) => {
                    if (opts?.sessionId && opts?.player) {
                        const username =
                            opts?.player?.username ||
                            opts?.player?.walletId ||
                            opts?.sessionId;

                        setNotifications((prevState) => [
                            ...prevState,
                            {
                                username,
                                type: "joined",
                                id: prevId + 1,
                            },
                        ]);
                    }
                });
            }
        }

        handlePushNotification();
    }, [voiceState?.type, room?.isMod, hasRequestMic, world?.current]);

    useEffect(() => {
        if (!noModeratorAt) return;
        setNotifications((prevState) =>
            // Asking again while the refusal is still waiting or on screen
            // adds no second copy.
            prevState.some((it) => it.type === "no-moderator")
                ? prevState
                : [
                      ...prevState,
                      {
                          type: "no-moderator",
                          id: (prevState[prevState.length - 1]?.id || 0) + 1,
                      },
                  ]
        );
    }, [noModeratorAt]);

    const deleteNotification = (id) => {
        const filteredNotifications = notifications.filter(
            (payload) => id != payload?.id,
            []
        );
        setNotifications(filteredNotifications);
    };

    const currentNofication = notifications[0];

    //if (!currentNofication?.id) return null;

    let content = null;

    if (
        currentNofication?.type === "denied" ||
        currentNofication?.type === "expired" ||
        currentNofication?.type == "leave" ||
        currentNofication?.type === "no-moderator"
    ) {
        content = (
            <>
                <IconImg
                    size={12}
                    mode="light"
                    name={"mic-off"}
                    style={{ marginTop: -7 }}
                />
                <span>
                    {currentNofication?.type === "denied"
                        ? t`MIC_REQUEST_DENIED`
                        : currentNofication?.type === "expired"
                        ? t`MIC_REQUEST_EXPIRED` || MIC_REQUEST_EXPIRED
                        : currentNofication?.type === "no-moderator"
                        ? t`NO_MODERATOR_TO_APPROVE` || NO_MODERATOR_TO_APPROVE
                        : t`MIC_LEAVE_AS_SPEAKER`}
                </span>
            </>
        );
    } else if (currentNofication?.type === "approved") {
        content = (
            <>
                <IconImg
                    size={12}
                    mode="dark"
                    name={"speaking"}
                    style={{ marginTop: -7 }}
                />
                <span>{t`MIC_REQUEST_APPROVED`}</span>
            </>
        );
    } else if (currentNofication?.type === "joined") {
        content = (
            <>
                <IconImg
                    size={12}
                    mode="light"
                    name={"user-plus"}
                    style={{ marginTop: -7 }}
                />
                <span>
                    {t`JUST_JOINED`}: <b>{currentNofication?.username}</b>
                </span>
            </>
        );
    }

    return (
        <AnimatePresence>
            {content && (
                <motion.div
                    exit={{ opacity: 0 }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    onAnimationComplete={async () => {
                        await sleep(3000);
                        deleteNotification(currentNofication?.id);
                    }}
                >
                    <Container>{content}</Container>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

const Container = styled.div`
    height: 24px;
    display: flex;
    white-space: nowrap;
    padding: 0px 12px;
    align-items: center;
    justify-content: center;
    flex-direction: row;
    overflow: hidden;
    border-radius: 900px;
    backdrop-filter: blur(20px);
    background: rgba(7, 7, 7, 0.5);

    & > span {
        font-family: "Aeonik";
        font-style: normal;
        font-weight: 400;
        font-size: 12px;
        line-height: 24px;
        display: flex;
        align-items: center;
        color: #c2c2c2;
        margin-left: 6px;
        word-break: break-word;
    }

    b {
        font-weight: 500;
        font-size: 12px;
        line-height: 24px;
        color: #f5f5f5;
        margin-left: 4px;
    }
`;
