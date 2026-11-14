import React, { useState } from "react";
import InlineError from "@ui/components/InlineError";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { usePanel } from "@components/_3DExhibit-v2/ui/ControlPanel/context/PanelProvider";

type Request = {
    reason?: string;
    user?: {
        sessionId?: string;
        userData?: { avatar?: string; username?: string; walletId?: string };
    };
};

const shortWallet = (wallet = "") =>
    wallet.length > 10 ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : wallet;

/** Who is asking and for what, in the lobby's words. */
export function voiceRequestView(request: Request) {
    const data = request?.user?.userData || {};
    return {
        sessionId: request?.user?.sessionId || "",
        name: data.username || shortWallet(data.walletId) || "Someone",
        avatar: data.avatar || "",
        sharing: !!request?.reason && request.reason !== "mic",
    };
}

/**
 * Moderators only: the oldest request to speak or share, above the chat
 * like the lobby's voice requests. One at a time; the rest wait behind it.
 */
export default function SpaceVoiceRequests() {
    const { voice, room } = useMultiplayer();
    const { getBaseAnalytics, setCurrentTab } = usePanel();
    const [pending, setPending] = useState("");
    const [error, setError] = useState("");
    const requests: Request[] = voice?.voiceRequests || [];
    if (!room?.isMod || !requests.length) return null;
    const request = voiceRequestView(requests[0]);
    const waiting = requests.length - 1;
    const act = async (approve: boolean) => {
        if (pending) return;
        setPending(approve ? "approve" : "decline");
        setError("");
        try {
            if (approve) {
                const result =
                    await voice.admin_acceptUserVoicePermissionRequest(
                        request.sessionId
                    );
                if (result?.success === false)
                    setError(result.error || "Couldn’t add them to voice.");
            } else
                await voice.admin_rejectUserVoicePermissionRequest(
                    request.sessionId
                );
            amplitude_logAnalyticsEvent(
                approve ? "approve_voice" : "decline_voice",
                getBaseAnalytics?.()
            );
        } catch {
            setError("Couldn’t answer the request. Try again.");
        } finally {
            setPending("");
        }
    };
    return (
        <div className="group-notices">
            <article
                className="group-notice voice-request-notice"
                aria-label={`${request.name} asks to ${
                    request.sharing ? "share" : "speak"
                }`}
            >
                <small>
                    {request.sharing ? "SHARING REQUEST" : "VOICE REQUEST"}
                </small>
                <p>
                    {request.avatar && (
                        <img src={request.avatar} alt="" aria-hidden="true" />
                    )}
                    <span>
                        <strong>{request.name}</strong>{" "}
                        {request.sharing
                            ? "asks to share their screen or audio."
                            : "asks to speak."}
                    </span>
                </p>
                <div>
                    <button
                        type="button"
                        className="notice-primary"
                        disabled={!!pending}
                        onClick={() => void act(true)}
                    >
                        {request.sharing ? "Allow" : "Add to voice"}
                    </button>
                    <button
                        type="button"
                        disabled={!!pending}
                        onClick={() => void act(false)}
                    >
                        Decline
                    </button>
                    {waiting > 0 && (
                        <button
                            type="button"
                            className="notice-more"
                            onClick={() => setCurrentTab("voiceRequests")}
                        >
                            +{waiting} waiting
                        </button>
                    )}
                </div>
                <InlineError message={!pending && error} />
            </article>
        </div>
    );
}
