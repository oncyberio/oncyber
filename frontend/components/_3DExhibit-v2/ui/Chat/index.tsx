import React, { useEffect, useMemo, useRef, useState } from "react";
import styled, { css } from "styled-components";
import { brandFoundation } from "@styles/brand";
import LobbyChat, { ConversationSocial } from "@features/lobby/LobbyChat";
import { conversationStyles } from "@features/lobby/conversationStyles";
import { nativeChatPlacement } from "@features/content-host/experienceChrome";
import { useMultiplayer } from "../../context/MultiplayerProvider";
import { CHAT_TYPES } from "../../context/hooks/useChat";
import { useWorld } from "../../hooks/useWorld";
import { UPDATE_CHAT } from "../../three/factory/player/constants";
import { nativeConversation } from "@utils/chat/nativeConversations";

/** The native room owns identity and transport; the lobby supplies the shared view only. */
export default function Chat({
    exhibit,
    isMobile = false,
    isFlyMode = null,
    isFlyModeChatDisplayed = false,
}) {
    const { room, chat } = useMultiplayer();
    const world = useWorld();
    const inputRef = useRef<HTMLInputElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const wasMobileOpen = useRef(false);
    const self = room.sessionId;
    const hidden = !!isFlyMode?.current && !isFlyModeChatDisplayed;
    const players = useMemo(
        () =>
            Object.values(chat.playersInfo || {}).map((person) => ({
                id: person.sessionId,
                name: person.userData?.username || "Visitor",
                avatar: person.userData?.avatar || "",
                isLocal: person.sessionId === self,
            })),
        [chat.playersInfo, self]
    );
    const messages = useMemo(
        () =>
            chat.messages
                .filter(
                    (message) =>
                        message.type === CHAT_TYPES.MESSAGE.label &&
                        nativeConversation(message, self)
                )
                .slice()
                .reverse()
                .map((message, index) => ({
                    id: `${message.sessionId}:${message.direct || "room"}:${
                        message.acc_date || index
                    }`,
                    sessionId: message.sessionId,
                    recipientId: message.direct || undefined,
                    name:
                        players.find(
                            (player) => player.id === message.sessionId
                        )?.name ||
                        message.username ||
                        "Visitor",
                    avatar: message.avatar,
                    text: message.text,
                    sentAt: Date.parse(message.acc_date || "") || 0,
                })),
        [chat.messages, self, players]
    );
    const social: ConversationSocial = {
        sessionId: self,
        status: chat.active ? "connected" : "offline",
        players,
        messages,
        sendMessage(text, recipientId) {
            const sent = chat.sendMessage({
                type: CHAT_TYPES.MESSAGE.label,
                payload: {
                    message: text,
                    messageType: "text",
                    loading: false,
                    recipientId,
                },
                roomId: room.id,
                sessionId: self,
            });
            if (!sent) return false;
            if (!recipientId)
                world.current?.updatePlayer({
                    type: UPDATE_CHAT,
                    payload: {
                        text: sent.text,
                        date: sent.date,
                        acc_date: sent.acc_date,
                    },
                });
            return true;
        },
    };
    useEffect(() => {
        // The native Enter shortcut already changes this flag. Keep engine movement
        // paused while either the search or message input owns focus.
        if (chat.isTyping) {
            chat.setIsMobileChatOpen(true);
            if (!containerRef.current?.contains(document.activeElement)) {
                setOpen(true);
                inputRef.current?.focus();
            }
        } else inputRef.current?.blur();
    }, [chat.isTyping, chat.isMobileChatOpen]);
    useEffect(() => {
        if (chat.isMobileChatOpen) {
            setOpen(true);
        } else if (wasMobileOpen.current) {
            setOpen(false);
            inputRef.current?.blur();
            document
                .querySelector<HTMLButtonElement>(
                    '[data-experience-action="chat"] > button'
                )
                ?.focus();
        }
        wasMobileOpen.current = !!chat.isMobileChatOpen;
    }, [chat.isMobileChatOpen]);
    useEffect(() => {
        chat.setChatMode("world");
        return () => chat.setIsTyping(false);
    }, [self]);
    const Notice = chat.messages[0]?.Text;
    return (
        <Container
            ref={containerRef}
            className="chat-container"
            id="native-room-chat"
            data-phone-chat-open={chat.isMobileChatOpen || undefined}
            $hidden={hidden}
            onFocusCapture={() => chat.setIsTyping(true)}
            onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node))
                    chat.setIsTyping(false);
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
        >
            <LobbyChat
                social={social}
                roomLabel="Room"
                spaceLabel="room"
                maxMessageLength={200}
                disabledReason={
                    chat.isChatDisabled ? "Chat is disabled in this world." : ""
                }
                open={open}
                onOpenChange={(value) => {
                    setOpen(value);
                    if (!value) {
                        chat.setIsTyping(false);
                        chat.setIsMobileChatOpen(false);
                    }
                }}
                inputRef={inputRef}
                buttonRef={buttonRef}
                hidden={hidden}
                notices={
                    Notice && (
                        <div className="native-chat-notice" role="status">
                            <Notice />
                        </div>
                    )
                }
            />
        </Container>
    );
}

const Container = styled.div<{ $hidden: boolean }>`
    ${brandFoundation}
    ${conversationStyles}
    ${nativeChatPlacement}
    color: #e8e9ec;
    pointer-events: auto;
    /* The lobby's party chat is open in this spot. */
    :root[data-party-chat-open] & {
        visibility: hidden;
    }
    ${({ $hidden }) =>
        $hidden &&
        css`
            visibility: hidden;
        `}
    .lobby-chat {
        max-height: 50vh;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
    }
    button {
        color: inherit;
        cursor: pointer;
        font-family: inherit;
    }
    button:disabled {
        cursor: default;
        opacity: 0.45;
    }
    button:focus-visible {
        outline: 2px solid #e8e9ec;
        outline-offset: 3px;
    }
    @media (max-width: 680px) {
        transition: opacity 180ms ease,
            transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1), visibility 0s;
        &:not([data-phone-chat-open]) {
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transform: translateX(12px);
            transition: opacity 120ms ease, transform 180ms ease,
                visibility 0s 120ms;
        }
        @media (prefers-reduced-motion: reduce) {
            &,
            &:not([data-phone-chat-open]) {
                transition: none;
            }
        }
        .chat-composer {
            margin-left: 104px;
            width: calc(100% - 104px);
        }
        .chat-switcher:disabled {
            display: none;
        }
    }
    .native-chat-notice {
        margin: 0 0 6px;
        font-size: 11px;
    }
`;
