import React, { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { brandFoundation } from "@styles/brand";
import LobbyPlace from "@features/lobby/LobbyPlace";
import type { VisitBridge } from "./visitBridge";
import { readVisitorIdentity, type VisitorIdentity } from "../gameIdentity";
import PadelSocial from "./PadelSocial";
import {
    createPadelHostEnvelope,
    readPadelHostEnvelope,
    readPadelHostState,
    readPadelHostCommand,
    type PadelHostState,
    type PadelHostMessageType,
} from "./padelHostProtocol";

type Props = {
    attempt: string;
    frameRef: React.RefObject<HTMLIFrameElement>;
    entered: boolean;
    blocked?: boolean;
    onExit: () => void;
};

/** Oncyber owns the controls in the outer document, above the destination frame.
 * Only the admitted native adapter can relay renderer state into this surface. */
export default function PadelHostOverlay({
    attempt,
    frameRef,
    entered,
    blocked = false,
    onExit,
}: Props) {
    const [state, setState] = useState<PadelHostState | null>(null);
    const [connected, setConnected] = useState(false);
    const [backPending, setBackPending] = useState(false);
    const visit = useRef<VisitBridge | null>(null);
    const live = useRef({
        state,
        connected,
        entered,
        blocked,
        onExit,
        backPending,
    });
    live.current = { state, connected, entered, blocked, onExit, backPending };
    const backTimer = useRef<ReturnType<typeof setTimeout>>();
    const post = useCallback(
        (type: PadelHostMessageType, payload = {}) => {
            frameRef.current?.contentWindow?.postMessage(
                createPadelHostEnvelope(attempt, type, payload),
                window.location.origin
            );
        },
        [attempt, frameRef]
    );
    useEffect(() => {
        const currentFrame = frameRef.current;
        const receive = (event: MessageEvent) => {
            if (
                event.source !== currentFrame?.contentWindow ||
                event.origin !== window.location.origin
            )
                return;
            const data = readPadelHostEnvelope(event.data, attempt);
            if (!data) return;
            if (data.type === "hello") {
                setConnected(true);
                post("connect");
                return;
            }
            if (data.type === "state") {
                const next = readPadelHostState(data.state);
                if (!next) return;
                setConnected(true);
                setState((previous) => ({
                    ...next,
                    identity: next.identity || previous?.identity || null,
                }));
                return;
            }
            const current = live.current;
            if (
                !current.entered ||
                !current.connected ||
                !current.state?.active ||
                current.state.mode !== "visit"
            )
                return;
            if (data.type === "pose") visit.current?.receivePose(data.pose);
            if (current.blocked || current.state.setupOpen) return;
            if (data.type === "chat") visit.current?.focusChat();
            if (data.type === "shortcut")
                visit.current?.receiveShortcut(data.slot);
        };
        const reconnect = () => {
            setConnected(false);
            setState((previous) =>
                previous ? { ...previous, active: false } : null
            );
            post("connect");
        };
        window.addEventListener("message", receive);
        currentFrame?.addEventListener("load", reconnect);
        post("connect");
        return () => {
            clearTimeout(backTimer.current);
            window.removeEventListener("message", receive);
            currentFrame?.removeEventListener("load", reconnect);
        };
    }, [attempt, frameRef, post]);
    useEffect(() => {
        if (entered) return;
        clearTimeout(backTimer.current);
        setBackPending(false);
    }, [entered]);
    const send = useCallback(
        (value: object) => {
            const message = readPadelHostCommand(value);
            if (!message) return;
            const current = live.current;
            if (
                message.type === "padel:input" &&
                message.enabled === true &&
                (!current.entered ||
                    current.blocked ||
                    !current.state?.active ||
                    current.state.setupOpen ||
                    current.state.mode !== "visit")
            )
                return;
            post("command", { message });
        },
        [post]
    );
    const focusGame = useCallback(() => {
        const current = live.current;
        if (
            !current.entered ||
            current.blocked ||
            !current.state?.active ||
            current.state.setupOpen ||
            current.state.mode !== "visit"
        )
            return;
        frameRef.current?.focus();
        post("focus");
    }, [frameRef, post]);
    const changeIdentity = useCallback(
        (value: VisitorIdentity) => {
            const identity = readVisitorIdentity(value);
            if (!identity) return;
            setState((previous) =>
                previous ? { ...previous, identity } : previous
            );
            post("identity", { identity });
        },
        [post]
    );
    const back = useCallback(() => {
        const current = live.current;
        // A failed/reloading destination must never trap platform navigation.
        if (
            !current.connected ||
            !current.state?.active ||
            current.backPending
        ) {
            clearTimeout(backTimer.current);
            current.onExit();
            return;
        }
        setBackPending(true);
        post("back");
        backTimer.current = setTimeout(() => live.current.onExit(), 22000);
    }, [post]);
    const visible =
        entered && !blocked && !!state?.active && connected && !backPending;
    const socialVisible =
        visible && state?.mode === "visit" && !state.setupOpen;
    return (
        <Layer
            data-oncyber-host-ui="padel"
            aria-label="Oncyber destination controls"
        >
            {state?.identity && state.mode === "visit" && (
                <PadelSocial
                    identity={state.identity}
                    bridge={visit}
                    send={send}
                    focusGame={focusGame}
                    onIdentityChange={changeIdentity}
                    onBack={back}
                    hidden={!socialVisible}
                />
            )}
            {entered &&
                !blocked &&
                !socialVisible &&
                (!connected ||
                    !state?.active ||
                    backPending ||
                    (!state?.setupOpen && state?.mode !== "match")) && (
                    <LobbyPlace
                        title="Padel club"
                        presence={
                            backPending
                                ? "Returning to lobby…"
                                : "Opening the club…"
                        }
                        onBack={back}
                    />
                )}
        </Layer>
    );
}

const Layer = styled.div`
    ${brandFoundation}
    position: absolute;
    inset: 0;
    z-index: 20;
    pointer-events: none;
`;
