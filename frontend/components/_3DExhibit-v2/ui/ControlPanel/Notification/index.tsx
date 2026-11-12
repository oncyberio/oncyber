import { useState } from "react";
import {
    motion,
    useMotionValue,
    useTransform,
    AnimatePresence,
} from "framer-motion";
import { useEventCallback } from "@components/hooks/useEventCallback";
import ConfirmNotification from "@ui/components/ConfirmNotification";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import { CHAT_TYPES } from "@components/_3DExhibit-v2/context/hooks/useChat";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { usePanel } from "../context/PanelProvider";

function RequestNotification(props) {
    const x = useMotionValue(0);

    const { voice, chat } = useMultiplayer();

    const { getBaseAnalytics } = usePanel();

    const { pushMessage } = chat;

    const {
        admin_acceptUserVoicePermissionRequest,
        admin_rejectUserVoicePermissionRequest,
    } = voice;

    const scale = useTransform(x, [-150, 0, 150], [0.5, 1, 0.5]);

    const rotate = useTransform(x, [-150, 0, 150], [-45, 0, 45], {
        clamp: false,
    });

    const { request, setExitX } = props;

    const { user, reason } = request;

    const { userData, sessionId } = user;

    const { avatar, username, walletId } = userData;

    const displayWalletId =
        walletId.slice(0, 4) +
        "..." +
        walletId.slice(walletId.length - 4, walletId.length);

    const handleDragEnd = useEventCallback((event, info) => {
        if (info.offset.x < -100) {
            setExitX(-250);
        }
        if (info.offset.x > 100) {
            setExitX(250);
        }
        admin_rejectUserVoicePermissionRequest(sessionId);
    }, []);

    const handleAcceptVoice = useEventCallback(async () => {
        const result = await admin_acceptUserVoicePermissionRequest(sessionId);

        if (result.success === false) {
            pushMessage(result.error, CHAT_TYPES.ALERT.label);
        }

        amplitude_logAnalyticsEvent("approve_voice", getBaseAnalytics());
    }, []);

    const payload = {
        avatar,
        sessionId,
        type: reason,
        id: walletId,
        username: username || displayWalletId,
    };

    return (
        <motion.div
            style={{
                x: x,
                top: 0,
                height: 100,
                width: "100%",
                rotate: rotate,
                cursor: "grab",
                position: "absolute",
            }}
            drag={props.drag}
            initial={props.initial}
            animate={props.animate}
            onDragEnd={handleDragEnd}
            transition={props.transition}
            whileTap={{ cursor: "grabbing" }}
            exit={{
                x: props.exitX,
                opacity: 0,
                scale: 0.5,
                transition: { duration: 0.2 },
            }}
            dragConstraints={{ top: 0, right: 0, bottom: 0, left: 0 }}
        >
            <motion.div
                style={{
                    height: 100,
                    scale: scale,
                }}
            >
                <ConfirmNotification
                    notifiaction={payload}
                    handleApprove={handleAcceptVoice}
                    handleDecline={() => {
                        admin_rejectUserVoicePermissionRequest(sessionId);

                        amplitude_logAnalyticsEvent(
                            "decline_voice",
                            getBaseAnalytics()
                        );
                    }}
                />
            </motion.div>
        </motion.div>
    );
}

export default function Notification_Stack_3D() {
    const [exitX, setExitX] = useState("100%");

    const { voice } = useMultiplayer();

    const { voiceRequests } = voice;

    const currentVoiceRequest = voiceRequests[0];
    const nextVoiceRequest = voiceRequests[1];

    return (
        <motion.div
            style={{ top: 20, right: 20, width: 375, position: "fixed" }}
        >
            <AnimatePresence initial={false}>
                {nextVoiceRequest && (
                    <RequestNotification
                        key={nextVoiceRequest.user?.sessionId}
                        initial={{ scale: 0, y: 105, opacity: 0 }}
                        animate={{ scale: 0.75, y: 30, opacity: 0.5 }}
                        transition={{
                            scale: { duration: 0.2 },
                            opacity: { duration: 0.4 },
                        }}
                        request={nextVoiceRequest}
                    />
                )}
                {currentVoiceRequest && (
                    <RequestNotification
                        key={currentVoiceRequest?.user?.sessionId}
                        request={currentVoiceRequest}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 20,
                            opacity: { duration: 0.2 },
                        }}
                        exitX={exitX}
                        drag="x"
                        setExitX={setExitX}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
}
