import React, { useState } from "react";
import InlineError from "@ui/components/InlineError";
import type { LobbyAdminAction, LobbyStage } from "./LobbyConnection";

/**
 * Admins only: the oldest request to speak, as a notice beside party
 * invites. One at a time, like the request prompt in spaces; the rest wait
 * behind it and stay listed in People.
 */
export default function LobbyVoiceRequests({
    stage,
    onAdmin,
    onShowAll,
}: {
    stage: LobbyStage | null;
    onAdmin(action: LobbyAdminAction, sessionId: string): Promise<string>;
    onShowAll?(): void;
}) {
    const [pending, setPending] = useState("");
    const [error, setError] = useState("");
    if (!stage?.role || !stage.requests.length) return null;
    const request = stage.requests[0];
    const waiting = stage.requests.length - 1;
    const full = stage.speakers.length >= stage.limit;
    const act = async (action: LobbyAdminAction) => {
        if (pending) return;
        setPending(action);
        setError("");
        try {
            setError(await onAdmin(action, request.sessionId));
        } finally {
            setPending("");
        }
    };
    return (
        <article
            className="group-notice voice-request-notice"
            aria-label={`${request.name} asks to speak`}
        >
            <small>
                VOICE REQUEST · {stage.speakers.length}/{stage.limit} ON VOICE
            </small>
            <p>
                {request.avatar && (
                    <img src={request.avatar} alt="" aria-hidden="true" />
                )}
                <span>
                    <strong>{request.name}</strong> asks to speak.
                </span>
            </p>
            <div>
                <button
                    type="button"
                    className="notice-primary"
                    disabled={!!pending || full}
                    onClick={() => void act("stage-add")}
                >
                    {full ? "Voice is full" : "Add to voice"}
                </button>
                <button
                    type="button"
                    disabled={!!pending}
                    onClick={() => void act("decline-request")}
                >
                    Decline
                </button>
                {waiting > 0 && (
                    <button
                        type="button"
                        className="notice-more"
                        onClick={onShowAll}
                    >
                        +{waiting} waiting
                    </button>
                )}
            </div>
            <InlineError message={!pending && error} />
        </article>
    );
}
