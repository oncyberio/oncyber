import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { UserContext } from "@components/context/UserContext";
import { brandFoundation } from "@styles/brand";
import useLobbySocial from "@features/lobby/useLobbySocial";
import LobbyChat from "@features/lobby/LobbyChat";
import LobbyDockIcon from "@features/lobby/LobbyDockIcon";
import ExperienceControlIcon from "@ui/components/ExperienceControlIcon";
import EmotePanel from "@features/lobby/EmotePanel";
import { getEmoteShortcutIndex } from "@features/lobby/emoteShortcuts";
import AvatarCarousel from "@features/lobby/AvatarCarousel";
import LobbyPlace from "@features/lobby/LobbyPlace";
import LobbyConversationSurface from "@features/lobby/LobbyConversationSurface";
import { lobbyDockStyles } from "@features/lobby/lobbyDockStyles";
import VRMS from "@components/_3DExhibit-v2/three/factory/player/vrms.json";
import { EMOTES } from "@components/_3DExhibit-v2/three/factory/player/instanceavatarvrm/constants";
import type { VisitorIdentity as PadelIdentity } from "../gameIdentity";
import {
    createGymPeerSampler,
    readGymPose,
    type VisitBridge as PadelVisitBridge,
} from "./visitBridge";

type Props = {
    hidden?: boolean;
    onBack?: () => void;
    identity: PadelIdentity;
    bridge: React.MutableRefObject<PadelVisitBridge | null>;
    send: (message: object) => void;
    focusGame: () => void;
    onIdentityChange: (identity: PadelIdentity) => void;
};

/** The lobby’s actual conversation and avatar controls, scoped to the padel club. */
export default function PadelSocial({
    identity,
    hidden = false,
    bridge,
    send,
    focusGame,
    onIdentityChange,
    onBack,
}: Props) {
    const { user, token, authenticated, isAnonymous } = useContext(UserContext);
    const [chatOpen, setChatOpen] = useState(false);
    const [avatarsOpen, setAvatarsOpen] = useState(false);
    const [emotesOpen, setEmotesOpen] = useState(false);
    const [focused, setFocused] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const moreRef = useRef<HTMLDivElement>(null);
    const moreButton = useRef<HTMLButtonElement>(null);
    const chatInput = useRef<HTMLInputElement>(null),
        chatButton = useRef<HTMLButtonElement>(null);
    const emoteButton = useRef<HTMLButtonElement>(null);
    const social = useLobbySocial({
        enabled: true,
        nativeSpace: "padel-club",
        identity: {
            userId: authenticated && !isAnonymous ? user?.id : undefined,
            username: identity.name,
            avatar: identity.pfp,
            token: token || undefined,
            vrmUrl: identity.avatarUrl,
        },
    });
    const live = useRef(social);
    live.current = social;
    const choices = useMemo(() => {
        const items = Object.values(VRMS).map((item) => ({
            id: item.id,
            name: item.name,
            url: item.url,
            img: item.image,
        }));
        if (!items.some((item) => item.url === identity.avatarUrl))
            items.unshift({
                id: identity.avatarUrl,
                name: "Your avatar",
                url: identity.avatarUrl,
                img: identity.pfp,
            });
        return items;
    }, [identity.avatarUrl, identity.pfp]);
    const focusChat = () => {
        setChatOpen(true);
        chatInput.current?.focus();
    };
    const release = () => {
        setFocused(false);
        focusGame();
    };
    useEffect(() => {
        bridge.current = {
            receivePose(value) {
                const pose = readGymPose(value);
                if (pose) live.current.updatePosition(pose);
            },
            focusChat,
            receiveShortcut(slot) {
                const index = getEmoteShortcutIndex(slot as number);
                if (index >= 0)
                    send({
                        type: "padel:emote",
                        index,
                        name: EMOTES[index].name,
                    });
            },
        };
        const samplePeers = createGymPeerSampler();
        const sample = () =>
            send({
                type: "padel:peers",
                sessionId: live.current.sessionId,
                players:
                    live.current.status === "connected"
                        ? samplePeers(
                              [...live.current.sampleParticipants()],
                              live.current.sessionId
                          )
                        : [],
            });
        sample();
        send({ type: "padel:social-ready", enabled: true });
        const timer = setInterval(sample, 100);
        return () => {
            send({ type: "padel:social-ready", enabled: false });
            bridge.current = null;
            clearInterval(timer);
            send({ type: "padel:peers", sessionId: "", players: [] });
            send({ type: "padel:input", enabled: true });
        };
    }, [bridge, send]);
    useEffect(() => {
        send({
            type: "padel:input",
            enabled: !(
                hidden ||
                focused ||
                avatarsOpen ||
                emotesOpen ||
                moreOpen
            ),
        });
    }, [send, hidden, focused, avatarsOpen, emotesOpen, moreOpen]);
    useEffect(() => {
        if (!hidden) return;
        // Hiding a focused parent overlay does not reliably fire blur across
        // the iframe boundary. The game owns focus until its dialog closes.
        setFocused(false);
        setMoreOpen(false);
        setAvatarsOpen(false);
        setEmotesOpen(false);
    }, [hidden]);
    useEffect(() => {
        if (!moreOpen) return;
        const closeOutside = (event: PointerEvent) => {
            if (!moreRef.current?.contains(event.target as Node))
                setMoreOpen(false);
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            setMoreOpen(false);
            moreButton.current?.focus();
        };
        window.addEventListener("pointerdown", closeOutside);
        window.addEventListener("keydown", closeOnEscape);
        return () => {
            window.removeEventListener("pointerdown", closeOutside);
            window.removeEventListener("keydown", closeOnEscape);
        };
    }, [moreOpen]);
    const voiceLabel =
        social.voiceState === "live"
            ? "Mute microphone"
            : social.voiceState === "connecting"
            ? "Connecting voice…"
            : "Unmute microphone";
    return (
        <Shell
            aria-label="Padel club social controls"
            hidden={hidden}
            onFocusCapture={() => setFocused(true)}
            onBlurCapture={(event) => {
                if (
                    !event.currentTarget.contains(event.relatedTarget as Node)
                ) {
                    setFocused(false);
                    setMoreOpen(false);
                }
            }}
        >
            <LobbyPlace
                title="Padel club"
                presence={
                    social.status === "connected"
                        ? `${
                              social.population || social.players.length || 1
                          } here`
                        : social.status === "connecting"
                        ? "Connecting…"
                        : "You’re offline"
                }
                onBack={onBack || (() => send({ type: "padel:exit" }))}
            />
            <button
                className="club-play"
                onClick={() => send({ type: "padel:play" })}
            >
                Play padel <span aria-hidden="true">↗</span>
            </button>
            <LobbyConversationSurface
                className="club-conversations"
                hidden={avatarsOpen || emotesOpen}
            >
                <LobbyChat
                    social={social}
                    spaceLabel="club"
                    open={chatOpen}
                    onOpenChange={(open) => {
                        setChatOpen(open);
                        if (!open) release();
                    }}
                    inputRef={chatInput}
                    buttonRef={chatButton}
                    hidden={false}
                />
            </LobbyConversationSurface>
            <div
                className="club-dock"
                role="group"
                aria-label="Padel controls"
                hidden={avatarsOpen || emotesOpen}
            >
                <div className="dock-item">
                    <span>Avatars</span>
                    <button
                        className="dock-button"
                        aria-label="Choose avatar"
                        aria-expanded={avatarsOpen}
                        onClick={() => {
                            setAvatarsOpen(true);
                            setEmotesOpen(false);
                            setMoreOpen(false);
                        }}
                    >
                        <LobbyDockIcon name="avatar" />
                    </button>
                </div>
                <div className="dock-item">
                    <span>Animations · 1–9</span>
                    <button
                        className="dock-button"
                        ref={emoteButton}
                        aria-label="Emotes"
                        aria-expanded={emotesOpen}
                        onClick={() => {
                            setEmotesOpen(true);
                            setAvatarsOpen(false);
                            setMoreOpen(false);
                        }}
                    >
                        <LobbyDockIcon name="emotes" />
                    </button>
                </div>
                <div className="club-more dock-item" ref={moreRef}>
                    <span>More</span>
                    <button
                        className="dock-button"
                        ref={moreButton}
                        aria-label="More"
                        aria-expanded={moreOpen}
                        aria-controls="padel-more-menu"
                        onClick={() => setMoreOpen((open) => !open)}
                    >
                        <ExperienceControlIcon
                            name="more"
                            className="lobby-dock-icon"
                        />
                    </button>
                    {moreOpen && (
                        <div
                            id="padel-more-menu"
                            className="club-more-menu"
                            aria-label="More padel controls"
                        >
                            <div className="club-presence" role="status">
                                <strong>Padel club</strong>
                                <span>
                                    {social.status === "connected"
                                        ? `${
                                              social.population ||
                                              social.players.length ||
                                              1
                                          } here`
                                        : social.status === "connecting"
                                        ? "Connecting…"
                                        : "Exploring solo"}
                                </span>
                            </div>
                            <button
                                aria-label={voiceLabel}
                                aria-pressed={social.voiceState === "live"}
                                disabled={
                                    social.status !== "connected" ||
                                    social.voiceState === "connecting"
                                }
                                onClick={() => {
                                    void social.toggleVoice();
                                    setMoreOpen(false);
                                    release();
                                }}
                            >
                                <LobbyDockIcon
                                    name={
                                        social.voiceState === "live"
                                            ? "mic"
                                            : "mic-off"
                                    }
                                />
                                {voiceLabel}
                            </button>
                            <button
                                onClick={() => {
                                    setMoreOpen(false);
                                    setFocused(false);
                                    send({ type: "padel:settings" });
                                }}
                            >
                                Settings
                            </button>
                            {social.status === "offline" && (
                                <button onClick={social.retry}>
                                    Reconnect
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <div
                className="club-move-hint"
                aria-hidden="true"
                hidden={avatarsOpen || emotesOpen}
            >
                Click anywhere to move
            </div>
            {social.voiceError && (
                <p className="club-voice-error" role="status">
                    {social.voiceError}
                </p>
            )}
            {avatarsOpen && (
                <AvatarCarousel
                    items={choices}
                    selectedId={
                        choices.find(
                            (choice) => choice.url === identity.avatarUrl
                        )?.id
                    }
                    onSelect={(choice) => {
                        const next = { ...identity, avatarUrl: choice.url };
                        onIdentityChange(next);
                        send({
                            type: "padel:avatar",
                            avatarUrl: choice.url,
                            pfp: identity.pfp,
                        });
                    }}
                    onClose={() => {
                        setAvatarsOpen(false);
                        release();
                    }}
                />
            )}
            {emotesOpen && (
                <EmotePanel
                    id="club-emotes"
                    items={EMOTES}
                    returnFocusRef={emoteButton}
                    onSelect={(index, name) => {
                        send({ type: "padel:emote", index, name });
                        setEmotesOpen(false);
                        release();
                    }}
                    onStop={() => {
                        send({
                            type: "padel:emote",
                            index: -1,
                            name: null,
                        });
                        setEmotesOpen(false);
                        release();
                    }}
                    onClose={() => {
                        setEmotesOpen(false);
                        release();
                    }}
                />
            )}
        </Shell>
    );
}

const Shell = styled.div`
    ${brandFoundation}
    ${lobbyDockStyles}
    position: absolute;
    inset: 0;
    pointer-events: none;
    color: #f3f3f1;
    z-index: 5;
    &::before {
        content: "";
        position: absolute;
        inset: 0 0 auto;
        height: 140px;
        pointer-events: none;
        background: linear-gradient(
            180deg,
            #05080e78 0%,
            #05080e30 55%,
            transparent 100%
        );
    }
    .lobby-place > span {
        text-shadow: 0 1px 3px #00000080;
    }
    button {
        font: inherit;
        color: inherit;
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
    button:focus-visible {
        outline: 1px solid #ffffff78;
        outline-offset: 3px;
    }
    &[hidden],
    [hidden] {
        display: none !important;
    }
    .club-play {
        position: absolute;
        right: 24px;
        top: 24px;
        min-height: 40px;
        padding: 0 17px;
        display: inline-flex;
        align-items: center;
        gap: 12px;
        border-radius: 14px;
        border: 1px solid #ffffff18;
        background: linear-gradient(160deg, #3975ff, #2567ff 55%, #1854e8);
        box-shadow: inset 0 1px 0 #ffffff1a;
        pointer-events: auto;
        font-size: 14px;
    }
    .club-play:hover {
        filter: brightness(1.08);
    }
    .club-dock {
        position: absolute;
        left: 50%;
        bottom: max(20px, calc(env(safe-area-inset-bottom) + 8px));
        transform: translateX(-50%);
        display: flex;
        gap: 8px;
        pointer-events: auto;
    }
    .club-move-hint {
        position: absolute;
        right: 24px;
        bottom: max(20px, calc(env(safe-area-inset-bottom) + 8px));
        height: 40px;
        display: flex;
        align-items: center;
        padding: 0 13px;
        border-radius: 12px;
        border: 1px solid #ffffff18;
        background: #14161bcc;
        color: #c2c5cc;
        font-size: 12px;
    }
    .club-more {
        position: relative;
    }
    .club-more-menu {
        position: absolute;
        right: 0;
        bottom: calc(100% + 12px);
        width: 218px;
        padding: 8px;
        border-radius: 18px;
        border: 1px solid #ffffff14;
        background: #14171cf0;
        box-shadow: 0 12px 32px #0004;
        backdrop-filter: blur(18px);
    }
    .club-more-menu button {
        display: flex;
        width: 100%;
        align-items: center;
        gap: 10px;
        padding: 10px;
        border: 0;
        background: transparent;
        border-radius: 10px;
        font-size: 13px;
        text-align: left;
    }
    .club-more-menu button:hover:not(:disabled) {
        background: #ffffff10;
    }
    .club-presence {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding: 9px 10px 12px;
        font-size: 11px;
    }
    .club-presence strong {
        font-weight: 500;
    }
    .club-presence span {
        color: #aeb6c2;
    }
    .club-voice-error {
        position: absolute;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        max-width: 310px;
        font-size: 12px;
        background: #191c23ed;
        padding: 12px;
        border-radius: 12px;
        pointer-events: auto;
    }
    @media (max-width: 550px) {
        .club-dock {
            gap: 6px;
        }
    }
    @media (max-width: 760px) {
        .club-play {
            right: 16px;
            top: 16px;
        }
        .club-move-hint {
            display: none;
        }
    }
`;
