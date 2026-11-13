import React, { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../landing-carousel/components/Icon";
import type { LobbyMessage, LobbyPlayer } from "./LobbyConnection";
import LobbyDockIcon from "./LobbyDockIcon";
import type {
    LobbyGroup,
    LobbyGroupMessage,
} from "../../../multiplayer/protocol/lobby-groups";
import useChatViewTransition from "./useChatViewTransition";
import { LOBBY_GUEST_PORTRAIT } from "./lobbyIdentity";

const GLOBAL = "global";
/** How many messages stay visible above the closed chat bar. */
export const FEED_LENGTH = 5;
type Contact = Pick<LobbyPlayer, "id" | "name" | "avatar"> & {
    groupId?: string;
};
export interface GroupConversations {
    groups: LobbyGroup[];
    messages: LobbyGroupMessage[];
    request?: { id: string; nonce: number };
    onSelect: (groupId: string | null) => void;
    onCreate: () => void;
    onManage: (groupId: string) => void;
    sendMessage: (groupId: string, text: string) => Promise<boolean>;
}
export type ConversationSocial = {
    sessionId: string;
    status: "connecting" | "connected" | "offline";
    players: Array<Contact & { isLocal?: boolean }>;
    messages: LobbyMessage[];
    sendMessage: (message: string, recipientId?: string) => boolean;
};
type ChatKeyboardEvent = React.KeyboardEvent<HTMLElement> | KeyboardEvent;
const isPlainTab = (event: ChatKeyboardEvent) => {
    const native = "nativeEvent" in event ? event.nativeEvent : event;
    return (
        event.key === "Tab" &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.repeat &&
        !native.isComposing &&
        native.keyCode !== 229
    );
};
const conversationFor = (
    item: LobbyMessage | LobbyGroupMessage,
    self: string
) => {
    if ("groupId" in item && item.groupId) return `group:${item.groupId}`;
    const recipientId = "recipientId" in item ? item.recipientId : undefined;
    if (!recipientId) return GLOBAL;
    if (item.sessionId === self) return recipientId;
    return recipientId === self ? item.sessionId : null;
};

// Globe icon for the global chat channel.
function GlobalIcon({ size }: { size: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 19 16"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
        >
            <path d="M19,4.74a1.16,1.16,0,0,0-.54-.68,2,2,0,0,0-.65-.25,6,6,0,0,0-1.19-.11A8.24,8.24,0,0,0,7.6.27a8,8,0,0,0-6,7.35,6.13,6.13,0,0,0-1,.67,2,2,0,0,0-.44.55A1.12,1.12,0,0,0,0,9.71a1.21,1.21,0,0,0,.67.75,2.71,2.71,0,0,0,.81.23l.53.05a8.22,8.22,0,0,0,9.78,5,8,8,0,0,0,5.92-9.09l.42-.29a3.15,3.15,0,0,0,.6-.61A1.19,1.19,0,0,0,19,4.74ZM3.21,9.18a7,7,0,0,1-.12-1.11A6.46,6.46,0,0,1,8,1.77a6.72,6.72,0,0,1,7.5,3.09,7,7,0,0,1,.46,1l-.3.15A37.18,37.18,0,0,1,9.73,8,37.89,37.89,0,0,1,3.58,9.16Zm8.23,5.05A6.69,6.69,0,0,1,3.71,10.7a39.85,39.85,0,0,0,6.41-1.17,40.1,40.1,0,0,0,6.17-2.11h0A6.45,6.45,0,0,1,11.44,14.23Z" />
        </svg>
    );
}

function Portrait({ name, avatar }: { name: string; avatar?: string }) {
    return (
        <span className="chat-avatar" aria-hidden="true">
            {name.slice(0, 1).toUpperCase()}
            {avatar && avatar !== "/favicon.ico" && (
                <img
                    key={avatar}
                    src={avatar}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onError={(event) => {
                        const img = event.currentTarget;
                        // Show the guest portrait, then the initial if that fails too.
                        if (img.src !== LOBBY_GUEST_PORTRAIT)
                            img.src = LOBBY_GUEST_PORTRAIT;
                        else img.style.display = "none";
                    }}
                />
            )}
        </span>
    );
}

export default function LobbyChat({
    social,
    open,
    onOpenChange,
    inputRef,
    buttonRef,
    hidden,
    roomLabel = "Global",
    spaceLabel = "lobby",
    maxMessageLength = 500,
    disabledReason = "",
    groupConversations,
    notices,
}: {
    social: ConversationSocial;
    groupConversations?: GroupConversations;
    notices?: React.ReactNode;
    /** The shared view's public conversation is scoped by its transport. */
    roomLabel?: string;
    spaceLabel?: string;
    maxMessageLength?: number;
    disabledReason?: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    inputRef: React.RefObject<HTMLInputElement>;
    buttonRef: React.RefObject<HTMLButtonElement>;
    hidden: boolean;
}) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const { phase, switching, switchView, cancel } = useChatViewTransition();
    const [recipient, setRecipient] = useState<Contact | null>(null);
    const [search, setSearch] = useState("");
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [sendError, setSendError] = useState("");
    const [sending, setSending] = useState(false);
    const [atBottom, setAtBottom] = useState(true);
    const [pageVisible, setPageVisible] = useState(true);
    const [unread, setUnread] = useState<Set<string>>(new Set());
    const seen = useRef(new Set<string>());
    const previousSession = useRef(social.sessionId);
    const [activity, setActivity] = useState<Record<string, number>>({});
    const logRef = useRef<HTMLDivElement>(null);
    const focusInput = useRef(false);
    const contactsRef = useRef<HTMLDivElement>(null);
    const focusPicker = useRef(false);
    const focusedContact = useRef<string | null>(null);
    const hoveredSelector = useRef(false);
    const [highlightedContact, setHighlightedContact] = useState<string | null>(
        null
    );
    const chatRef = useRef<HTMLElement>(null);
    const handledGroupRequest = useRef<number>();
    const knownGroupIds = useRef(
        new Set(groupConversations?.groups.map((group) => group.id) || [])
    );
    const liveGroups = useRef(groupConversations?.groups || []);
    liveGroups.current = groupConversations?.groups || [];
    const sendGeneration = useRef(0);
    const pendingSendGroup = useRef<string | null>(null);
    const current = recipient?.id || GLOBAL;
    const selectedGroup = groupConversations?.groups.find(
        (group) => group.id === recipient?.groupId
    );
    const allMessages = useMemo(
        () => [
            ...social.messages,
            ...(groupConversations?.messages || []).filter((message) =>
                groupConversations?.groups.some(
                    (group) => group.id === message.groupId
                )
            ),
        ],
        [
            social.messages,
            groupConversations?.messages,
            groupConversations?.groups,
        ]
    );
    const liveRecipient = social.players.find(
        (person) => person.id === current
    );
    const selectedPerson = liveRecipient || recipient;
    const currentName =
        selectedGroup?.name || selectedPerson?.name || roomLabel;
    const unavailable = recipient?.groupId
        ? !selectedGroup
        : !!recipient && !liveRecipient;
    const message = drafts[current] || "";
    const messages = useMemo(
        () =>
            allMessages.filter(
                (item) => conversationFor(item, social.sessionId) === current
            ),
        [allMessages, social.sessionId, current]
    );
    const contacts = useMemo(() => {
        const people = new Map<string, Contact>();
        for (const person of social.players) {
            if (!person.isLocal && person.id !== social.sessionId)
                people.set(person.id, person);
        }
        // Nearby rosters can be asymmetric. Keep a received DM readable even
        // when its sender is outside our current visible crowd.
        for (const item of allMessages) {
            if (
                !("groupId" in item) &&
                item.recipientId === social.sessionId &&
                item.sessionId !== social.sessionId &&
                !people.has(item.sessionId)
            ) {
                people.set(item.sessionId, {
                    id: item.sessionId,
                    name: item.name,
                    avatar: item.avatar,
                });
            }
        }
        for (const group of groupConversations?.groups || []) {
            people.set(`group:${group.id}`, {
                id: `group:${group.id}`,
                name: group.name,
                avatar: "",
                groupId: group.id,
            });
        }
        if (recipient && !people.has(recipient.id) && !recipient.groupId)
            people.set(recipient.id, recipient);
        return [...people.values()].sort(
            (a, b) =>
                (activity[b.id] || 0) - (activity[a.id] || 0) ||
                a.name.localeCompare(b.name)
        );
    }, [
        social.players,
        allMessages,
        activity,
        social.sessionId,
        recipient,
        groupConversations?.groups,
    ]);
    // With groups, the list is always useful: it holds Global and "New party".
    const canChooseConversation = contacts.length > 0 || !!groupConversations;
    const lastMessages = useMemo(() => {
        const latest = new Map<string, LobbyMessage | LobbyGroupMessage>();
        for (const item of allMessages) {
            const key = conversationFor(item, social.sessionId);
            if (key) latest.set(key, item);
        }
        return latest;
    }, [allMessages, social.sessionId]);
    const lastLine = (id: string, fallback: string) => {
        const item = lastMessages.get(id);
        if (!item) return fallback;
        return `${item.sessionId === social.sessionId ? "You" : item.name}: ${
            item.text
        }`;
    };
    const canChooseConversationRef = useRef(canChooseConversation);
    canChooseConversationRef.current = canChooseConversation;
    useEffect(() => {
        if (canChooseConversation) return;
        // A last visitor leaving can also invalidate an opening animation.
        hoveredSelector.current = false;
        cancel();
        focusPicker.current = false;
        if (pickerOpen) focusInput.current = true;
        setPickerOpen(false);
        setSearch("");
    }, [canChooseConversation, pickerOpen, cancel]);
    const matches = contacts.filter((person) =>
        person.name
            .toLocaleLowerCase()
            .includes(search.trim().toLocaleLowerCase())
    );
    const lastMessageId = messages[messages.length - 1]?.id;
    // While the chat is closed, the latest messages stay readable above the
    // bar, so following the room never needs a click.
    const feedVisible = !open && !pickerOpen && !hidden && !switching;
    const feedMessages = useMemo(
        () =>
            feedVisible
                ? allMessages
                      .filter(
                          (item) =>
                              conversationFor(item, social.sessionId) === GLOBAL
                      )
                      .slice(-FEED_LENGTH)
                : [],
        [feedVisible, allMessages, social.sessionId]
    );
    const previewId =
        highlightedContact === GLOBAL ||
        matches.some((person) => person.id === highlightedContact)
            ? highlightedContact
            : search.trim()
            ? matches[0]?.id || GLOBAL
            : current;

    useEffect(() => {
        const visibility = () => setPageVisible(!document.hidden);
        visibility();
        document.addEventListener("visibilitychange", visibility);
        return () =>
            document.removeEventListener("visibilitychange", visibility);
    }, []);
    // Enter from the world opens the current conversation. Arrival keeps the
    // compact message bar idle without taking keyboard focus from movement.
    useEffect(() => {
        if (!open) {
            cancel();
            focusInput.current = false;
            focusPicker.current = false;
            setPickerOpen(false);
            setSearch("");
        } else if (pickerOpen) {
            switchView(() => {
                focusInput.current = true;
                setPickerOpen(false);
            });
        } else {
            inputRef.current?.focus();
        }
    }, [open, inputRef, cancel, switchView]);
    useEffect(() => {
        if (hidden) {
            hoveredSelector.current = false;
            cancel();
            focusInput.current = false;
            focusPicker.current = false;
        }
    }, [hidden, cancel]);
    useEffect(() => {
        setAtBottom(true);
        setSendError("");
        if (logRef.current)
            logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [current, pickerOpen]);
    useEffect(() => {
        if (logRef.current && atBottom)
            logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [lastMessageId, atBottom, open, pickerOpen]);
    useEffect(() => {
        const incoming = allMessages.filter(
            (item) =>
                item.sessionId !== social.sessionId &&
                !seen.current.has(item.id)
        );
        seen.current = new Set(allMessages.map((item) => item.id));
        setUnread((previous) => {
            const next = new Set(previous);
            for (const item of incoming) {
                const key = conversationFor(item, social.sessionId);
                if (key) next.add(key);
            }
            if (
                open &&
                !pickerOpen &&
                phase === "idle" &&
                atBottom &&
                !hidden &&
                pageVisible
            )
                next.delete(current);
            else if (feedVisible && pageVisible) next.delete(GLOBAL);
            return next.size === previous.size &&
                [...next].every((key) => previous.has(key))
                ? previous
                : next;
        });
    }, [
        allMessages,
        social.sessionId,
        current,
        open,
        pickerOpen,
        phase,
        atBottom,
        hidden,
        pageVisible,
        feedVisible,
    ]);
    useEffect(() => {
        setActivity((previous) => {
            const next = { ...previous };
            let changed = false;
            for (const item of allMessages) {
                const key = conversationFor(item, social.sessionId);
                if (key && key !== GLOBAL && item.sentAt > (next[key] || 0)) {
                    next[key] = item.sentAt;
                    changed = true;
                }
            }
            return changed ? next : previous;
        });
    }, [allMessages, social.sessionId]);
    // A new room/session must not inherit a private draft or selected session ID.
    useEffect(() => {
        if (previousSession.current === social.sessionId) return;
        previousSession.current = social.sessionId;
        cancel();
        focusInput.current = false;
        focusPicker.current = false;
        setActivity({});
        setRecipient(null);
        groupConversations?.onSelect(null);
        setHighlightedContact(null);
        focusedContact.current = null;
        setDrafts({});
        sendGeneration.current++;
        pendingSendGroup.current = null;
        setSending(false);
        setSearch("");
        setUnread(new Set());
        seen.current.clear();
        setPickerOpen(false);
        onOpenChange(false);
    }, [social.sessionId]);

    useEffect(() => {
        const next = new Set(
            groupConversations?.groups.map((group) => group.id) || []
        );
        const removed = new Set(
            [...knownGroupIds.current].filter((id) => !next.has(id))
        );
        knownGroupIds.current = next;
        if (!removed.size) return;
        if (removed.has(pendingSendGroup.current)) {
            sendGeneration.current++;
            pendingSendGroup.current = null;
            setSending(false);
        }
        setDrafts((previous) =>
            Object.fromEntries(
                Object.entries(previous).filter(
                    ([id]) =>
                        !id.startsWith("group:") || !removed.has(id.slice(6))
                )
            )
        );
        setUnread(
            (previous) =>
                new Set(
                    [...previous].filter(
                        (id) =>
                            !id.startsWith("group:") ||
                            !removed.has(id.slice(6))
                    )
                )
        );
        if (recipient?.groupId && removed.has(recipient.groupId)) {
            cancel();
            focusInput.current = false;
            focusPicker.current = false;
            setRecipient(null);
            groupConversations?.onSelect(null);
            setSendError("");
        }
    }, [groupConversations?.groups, recipient?.groupId, cancel]);
    useEffect(
        () => () => {
            sendGeneration.current++;
        },
        []
    );

    const focusContact = (target?: HTMLButtonElement) => {
        if (!target) return;
        focusedContact.current = target.dataset.conversation;
        setHighlightedContact(target.dataset.conversation);
        target.focus();
        target.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    };
    const focusPickerContact = () => {
        const buttons = Array.from(
            contactsRef.current?.querySelectorAll<HTMLButtonElement>(
                "button"
            ) || []
        );
        const target = search.trim()
            ? buttons[1] || buttons[0]
            : buttons.find(
                  (button) => button.getAttribute("aria-pressed") === "true"
              ) || buttons[0];
        focusContact(target);
    };
    const focusAdjacentContact = (direction: number) => {
        const buttons = Array.from(
            contactsRef.current?.querySelectorAll<HTMLButtonElement>(
                ".chat-contact"
            ) || []
        );
        const choices = search.trim() ? buttons.slice(1) : buttons;
        if (!choices.length) return false;
        const previous =
            choices.find(
                (button) =>
                    button.dataset.conversation === focusedContact.current
            ) ||
            choices.find(
                (button) => button.getAttribute("aria-pressed") === "true"
            );
        const index = choices.indexOf(previous);
        const next =
            index < 0
                ? direction > 0
                    ? 0
                    : choices.length - 1
                : Math.max(0, Math.min(choices.length - 1, index + direction));
        focusContact(choices[next]);
        return true;
    };
    useEffect(() => {
        if (switching || hidden) return;
        if (focusPicker.current && pickerOpen) {
            focusPicker.current = false;
            focusPickerContact();
        } else if (focusInput.current && inputRef.current) {
            focusInput.current = false;
            inputRef.current?.focus();
        }
    }, [pickerOpen, current, open, inputRef, switching, hidden]);

    const choose = (person: Contact | null) => {
        switchView(() => {
            if (
                person?.groupId &&
                !liveGroups.current.some((group) => group.id === person.groupId)
            )
                return;
            focusInput.current = true;
            setRecipient(person);
            groupConversations?.onSelect(person?.groupId || null);
            setSearch("");
            setSendError("");
            setPickerOpen(false);
            onOpenChange(true);
        });
    };
    useEffect(() => {
        const request = groupConversations?.request;
        if (
            !request ||
            handledGroupRequest.current === request.nonce ||
            switching ||
            hidden
        )
            return;
        const group = groupConversations.groups.find(
            (item) => item.id === request.id
        );
        if (!group) return;
        handledGroupRequest.current = request.nonce;
        choose({
            id: `group:${group.id}`,
            name: group.name,
            avatar: "",
            groupId: group.id,
        });
    }, [
        groupConversations?.request?.nonce,
        groupConversations?.groups,
        switching,
        hidden,
    ]);
    const showSearch = () => {
        if (switching) return;
        focusPicker.current = false;
        inputRef.current?.focus();
    };
    const dismissPicker = () => {
        const restoreConversation = () => {
            focusPicker.current = false;
            focusInput.current = true;
            setPickerOpen(false);
            setSearch("");
            setSendError("");
            onOpenChange(true);
        };
        if (switching) {
            cancel();
            restoreConversation();
        } else switchView(restoreConversation);
    };
    const close = () => {
        if (pickerOpen) {
            dismissPicker();
            return;
        }
        cancel();
        focusInput.current = false;
        focusPicker.current = false;
        onOpenChange(false);
        buttonRef.current?.focus();
    };
    const showPeople = (focusContacts = false) => {
        if (!canChooseConversation) return;
        switchView(() => {
            if (!canChooseConversationRef.current) return;
            // A click lands in search so typing a name is the first step to a
            // DM; Tab keeps keyboard browsing on the current conversation pill.
            focusInput.current = !focusContacts;
            focusPicker.current = focusContacts;
            hoveredSelector.current = false;
            setHighlightedContact(null);
            setSearch("");
            setSendError("");
            setPickerOpen(true);
        });
    };
    useEffect(() => {
        if (hidden || (!pickerOpen && !switching)) return;
        const dismissOutside = (event: PointerEvent) => {
            if (
                event.target instanceof Node &&
                chatRef.current?.contains(event.target)
            )
                return;
            // Keep the outside click's focus and action intact, including while
            // a delayed conversation switch is pending.
            cancel();
            focusInput.current = false;
            focusPicker.current = false;
            hoveredSelector.current = false;
            setPickerOpen(false);
            setSearch("");
            setSendError("");
        };
        document.addEventListener("pointerdown", dismissOutside, true);
        return () =>
            document.removeEventListener("pointerdown", dismissOutside, true);
    }, [pickerOpen, switching, hidden, cancel]);
    const openConversationPicker = (
        event: ChatKeyboardEvent,
        fromSelector = false
    ) => {
        if (
            !canChooseConversation ||
            !isPlainTab(event) ||
            hidden ||
            (!fromSelector && (pickerOpen || !open))
        )
            return;
        event.preventDefault();
        event.stopPropagation();
        if (switching) return;
        if (pickerOpen) {
            focusPickerContact();
            return;
        }
        showPeople(true);
    };
    useEffect(() => {
        const shortcut = (event: KeyboardEvent) => {
            if (
                event.defaultPrevented ||
                pickerOpen ||
                (!hoveredSelector.current &&
                    !buttonRef.current?.matches(":hover"))
            )
                return;
            const target =
                event.target instanceof Element ? event.target : null;
            if (target?.closest('[role="dialog"], [role="menu"]')) return;
            if (
                target !== inputRef.current &&
                target?.closest(
                    'input, textarea, select, [contenteditable]:not([contenteditable="false"])'
                )
            )
                return;
            openConversationPicker(event, true);
        };
        const clearHover = () => {
            hoveredSelector.current = false;
        };
        window.addEventListener("keydown", shortcut, true);
        window.addEventListener("blur", clearHover);
        return () => {
            window.removeEventListener("keydown", shortcut, true);
            window.removeEventListener("blur", clearHover);
        };
    }, [
        pickerOpen,
        open,
        hidden,
        switching,
        search,
        canChooseConversation,
        inputRef,
        buttonRef,
        switchView,
    ]);
    const send = async () => {
        if (sending || switching || pickerOpen || !message.trim()) return;
        if (disabledReason) {
            setSendError(disabledReason);
            return;
        }
        if (unavailable) {
            setSendError(
                `${currentName} is no longer nearby. Your draft is saved.`
            );
            return;
        }
        let sent = false;
        const generation = sendGeneration.current;
        if (recipient?.groupId) {
            pendingSendGroup.current = recipient.groupId;
            setSending(true);
            try {
                sent = await groupConversations.sendMessage(
                    recipient.groupId,
                    message
                );
            } catch {
                sent = false;
            } finally {
                if (sendGeneration.current === generation) {
                    pendingSendGroup.current = null;
                    setSending(false);
                }
            }
        } else
            sent = recipient
                ? social.sendMessage(message, recipient.id)
                : social.sendMessage(message);
        if (sendGeneration.current !== generation) return;
        if (sent) {
            setDrafts((previous) =>
                previous[current] === message
                    ? { ...previous, [current]: "" }
                    : previous
            );
            setSendError("");
            setAtBottom(true);
        } else
            setSendError(
                social.status !== "connected"
                    ? "Reconnect to send a message."
                    : "Wait a moment before sending again."
            );
    };

    const contactStrip = (
        <div className="chat-contact-strip">
            <div
                className="chat-contacts"
                id="lobby-conversations"
                ref={contactsRef}
                onFocus={(event) => {
                    const button = (
                        event.target as HTMLElement
                    ).closest<HTMLButtonElement>(".chat-contact");
                    if (button) {
                        focusedContact.current = button.dataset.conversation;
                        setHighlightedContact(button.dataset.conversation);
                    }
                }}
                role="group"
                aria-label="Conversations, most recent first"
                onKeyDown={(event) => {
                    if (
                        event.nativeEvent.isComposing ||
                        event.nativeEvent.keyCode === 229 ||
                        event.altKey ||
                        event.ctrlKey ||
                        event.metaKey ||
                        event.shiftKey
                    )
                        return;
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault();
                        event.stopPropagation();
                        const rows = Array.from(
                            event.currentTarget.querySelectorAll<HTMLButtonElement>(
                                "button"
                            )
                        );
                        const index = rows.indexOf(
                            document.activeElement as HTMLButtonElement
                        );
                        // The list sits above the input: past the last row,
                        // ArrowDown lands back in search.
                        if (
                            event.key === "ArrowDown" &&
                            index >= rows.length - 1
                        )
                            showSearch();
                        else
                            focusContact(
                                rows[
                                    Math.max(
                                        0,
                                        index +
                                            (event.key === "ArrowDown" ? 1 : -1)
                                    )
                                ]
                            );
                        return;
                    }
                    if (
                        !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                            event.key
                        )
                    )
                        return;
                    event.preventDefault();
                    event.stopPropagation();
                    const buttons = Array.from(
                        event.currentTarget.querySelectorAll<HTMLButtonElement>(
                            "button"
                        )
                    );
                    const index = buttons.indexOf(
                        document.activeElement as HTMLButtonElement
                    );
                    const next =
                        event.key === "Home"
                            ? 0
                            : event.key === "End"
                            ? buttons.length - 1
                            : Math.max(
                                  0,
                                  Math.min(
                                      buttons.length - 1,
                                      index +
                                          (event.key === "ArrowRight" ? 1 : -1)
                                  )
                              );
                    focusContact(buttons[next]);
                }}
                onWheel={(event) => event.stopPropagation()}
            >
                <button
                    className="chat-contact"
                    type="button"
                    aria-label={`${roomLabel} chat`}
                    data-conversation={GLOBAL}
                    data-preview={previewId === GLOBAL || undefined}
                    aria-pressed={!recipient}
                    onMouseEnter={() => setHighlightedContact(GLOBAL)}
                    onClick={() => choose(null)}
                >
                    <span className="contact-symbol" aria-hidden="true">
                        <GlobalIcon size={15} />
                    </span>
                    <span className="contact-body">
                        <span className="contact-name">{roomLabel}</span>
                        <span className="contact-last">
                            {lastLine(GLOBAL, `Everyone in this ${spaceLabel}`)}
                        </span>
                    </span>
                    {unread.has(GLOBAL) && (
                        <span
                            className="contact-unread"
                            aria-label="Unread messages"
                        />
                    )}
                </button>
                {matches.map((person) => (
                    <button
                        className="chat-contact"
                        type="button"
                        key={person.id}
                        data-conversation={person.id}
                        data-preview={previewId === person.id || undefined}
                        aria-label={
                            person.groupId
                                ? `Party ${person.name}`
                                : `Message ${person.name}`
                        }
                        onMouseEnter={() => setHighlightedContact(person.id)}
                        aria-pressed={current === person.id}
                        title={person.name}
                        onClick={() => choose(person)}
                    >
                        {person.groupId ? (
                            <span className="contact-symbol" aria-hidden="true">
                                <LobbyDockIcon name="people" />
                            </span>
                        ) : (
                            <Portrait
                                name={person.name}
                                avatar={person.avatar}
                            />
                        )}
                        <span className="contact-body">
                            <span className="contact-name">{person.name}</span>
                            <span className="contact-last">
                                {lastLine(
                                    person.id,
                                    person.groupId ? "Party" : "Say hello"
                                )}
                            </span>
                        </span>
                        {!person.groupId &&
                            !social.players.some(
                                (player) => player.id === person.id
                            ) && <span className="contact-away">Away</span>}
                        {unread.has(person.id) && (
                            <span
                                className="contact-unread"
                                aria-label="Unread messages"
                            />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );

    const renderMessage = (item: LobbyMessage | LobbyGroupMessage) => {
        const player = social.players.find(
            (entry) => entry.id === item.sessionId
        );
        const own = item.sessionId === social.sessionId;
        return (
            <div
                className="chat-message"
                key={item.id}
                title={new Date(item.sentAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                })}
            >
                <Portrait
                    name={item.name}
                    avatar={player?.avatar || item.avatar}
                />
                <p className="chat-line">
                    <span className="chat-name" data-own={own || undefined}>
                        {own ? "You" : item.name}
                    </span>
                    <span className="chat-separator">: </span>
                    <span className="chat-text">{item.text}</span>
                </p>
            </div>
        );
    };

    const backToRoom = (
        <button
            type="button"
            className="chat-thread-close"
            aria-label={`Back to ${roomLabel} chat`}
            title={`Back to ${roomLabel}`}
            onClick={() => choose(null)}
        >
            <Icon name="close" size={12} />
        </button>
    );

    return (
        <section
            className="lobby-chat"
            ref={chatRef}
            aria-label={`${spaceLabel === "lobby" ? "Lobby" : roomLabel} chat`}
            data-view-phase={phase}
            data-open={open || pickerOpen || undefined}
            aria-busy={phase !== "idle" || undefined}
            onClickCapture={(event) => {
                if (switching) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            }}
            onKeyDownCapture={(event) => {
                if (switching && event.key !== "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                }
            }}
            onKeyDown={(event) => {
                if (
                    event.key === "Escape" &&
                    (pickerOpen || open || switching) &&
                    !event.nativeEvent.isComposing &&
                    event.nativeEvent.keyCode !== 229
                ) {
                    event.preventDefault();
                    event.stopPropagation();
                    close();
                }
            }}
        >
            <div className="chat-view-viewport">
                <div className="chat-view">
                    {notices}
                    {selectedGroup && open && !pickerOpen && (
                        <div className="chat-group-heading">
                            <button
                                type="button"
                                onClick={() =>
                                    groupConversations.onManage(
                                        selectedGroup.id
                                    )
                                }
                                aria-label={`Manage ${selectedGroup.name}`}
                            >
                                <span>{selectedGroup.name}</span>
                                <small>
                                    {selectedGroup.members.length} people
                                </small>
                            </button>
                            {backToRoom}
                        </div>
                    )}
                    {recipient && !recipient.groupId && open && !pickerOpen && (
                        <div className="chat-thread-heading">
                            <Portrait
                                name={currentName}
                                avatar={selectedPerson?.avatar}
                            />
                            <span className="chat-thread-name">
                                {currentName}
                            </span>
                            <small>
                                {unavailable ? "Away" : "Direct message"}
                            </small>
                            {backToRoom}
                        </div>
                    )}
                    {open && !pickerOpen && (
                        <div
                            className="chat-log scrollbar-hidden"
                            id="lobby-chat-log"
                            ref={logRef}
                            onScroll={(event) => {
                                const log = event.currentTarget;
                                setAtBottom(
                                    log.scrollHeight -
                                        log.scrollTop -
                                        log.clientHeight <
                                        12
                                );
                            }}
                            role="log"
                            aria-live="polite"
                            aria-relevant="additions"
                            aria-label={
                                selectedGroup
                                    ? `Messages in ${currentName}`
                                    : recipient
                                    ? `Messages with ${currentName}`
                                    : `${
                                          spaceLabel === "lobby"
                                              ? "Lobby"
                                              : roomLabel
                                      } messages`
                            }
                        >
                            {!messages.length && (
                                <p className="chat-empty">
                                    {selectedGroup
                                        ? `Say hello to ${currentName}. Only party members can see this conversation.`
                                        : recipient
                                        ? `Say hello to ${currentName}. Only you two can see this conversation.`
                                        : disabledReason ||
                                          `Say hello to everyone in this ${spaceLabel}.`}
                                </p>
                            )}
                            {messages.map(renderMessage)}
                        </div>
                    )}
                    {feedMessages.length > 0 && (
                        <div
                            className="chat-log chat-feed"
                            role="log"
                            aria-live="polite"
                            aria-relevant="additions"
                            aria-label={`Latest ${roomLabel} messages`}
                            title="Open chat (Enter)"
                            onClick={() => onOpenChange(true)}
                        >
                            {feedMessages.map(renderMessage)}
                        </div>
                    )}
                    {pickerOpen && (
                        <div className="chat-picker">
                            <div className="chat-picker-heading">
                                <span>Chats</span>
                                <span>
                                    {
                                        contacts.filter(
                                            (person) =>
                                                !person.groupId &&
                                                social.players.some(
                                                    (player) =>
                                                        player.id === person.id
                                                )
                                        ).length
                                    }{" "}
                                    here
                                </span>
                            </div>
                            {contactStrip}
                            {search.trim() && !matches.length && (
                                <p className="chat-empty">
                                    No people match your search.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <form
                className="chat-composer"
                data-mode={pickerOpen ? "search" : "message"}
                onSubmit={(event) => {
                    event.preventDefault();
                    send();
                }}
            >
                <button
                    ref={buttonRef}
                    className="chat-people-toggle chat-switcher"
                    type="button"
                    disabled={!canChooseConversation}
                    aria-label={`Current conversation: ${currentName}${
                        canChooseConversation ? ". Choose conversation" : ""
                    }`}
                    title={
                        !canChooseConversation
                            ? "No one else is here yet"
                            : pickerOpen
                            ? "Back to conversation (Esc)"
                            : "Switch chat (Tab)"
                    }
                    aria-describedby={
                        unread.size ? "lobby-chat-unread" : undefined
                    }
                    aria-keyshortcuts={
                        canChooseConversation ? "Tab" : undefined
                    }
                    aria-pressed={
                        canChooseConversation ? pickerOpen : undefined
                    }
                    aria-controls={
                        canChooseConversation && pickerOpen
                            ? "lobby-conversations"
                            : undefined
                    }
                    onMouseEnter={() => {
                        hoveredSelector.current = true;
                    }}
                    onMouseLeave={() => {
                        hoveredSelector.current = false;
                    }}
                    onKeyDown={(event) => openConversationPicker(event, true)}
                    onClick={() =>
                        pickerOpen ? dismissPicker() : showPeople()
                    }
                >
                    <span className="chat-input-glyph" aria-hidden="true">
                        {recipient?.groupId ? (
                            <LobbyDockIcon name="people" />
                        ) : selectedPerson ? (
                            <Portrait
                                name={currentName}
                                avatar={selectedPerson.avatar}
                            />
                        ) : (
                            <GlobalIcon size={18} />
                        )}
                    </span>
                    {canChooseConversation && (
                        <span
                            className="chat-switcher-caret"
                            aria-hidden="true"
                        >
                            <Icon name="chevron" size={12} strokeWidth="2" />
                        </span>
                    )}
                    {!!unread.size && (
                        <>
                            <span
                                className="chat-unread-dot"
                                aria-hidden="true"
                            />
                            <span
                                id="lobby-chat-unread"
                                className="chat-unread-label"
                                role="status"
                            >
                                Unread messages
                            </span>
                        </>
                    )}
                </button>
                <div className="chat-input-bar">
                    {pickerOpen && (
                        <span className="chat-search-glyph" aria-hidden="true">
                            <Icon name="search" size={14} />
                        </span>
                    )}
                    <input
                        ref={inputRef}
                        enterKeyHint={pickerOpen ? "search" : "send"}
                        readOnly={switching}
                        aria-label={
                            pickerOpen
                                ? `Search people in this ${spaceLabel}`
                                : recipient
                                ? `Message ${currentName}`
                                : `Message the ${spaceLabel}`
                        }
                        placeholder={
                            pickerOpen
                                ? `Search people in this ${spaceLabel}…`
                                : disabledReason
                                ? disabledReason
                                : unavailable
                                ? `${currentName} is away`
                                : recipient
                                ? `Message ${currentName}…`
                                : "Message everyone…"
                        }
                        maxLength={pickerOpen ? 100 : maxMessageLength}
                        value={pickerOpen ? search : message}
                        onFocus={() => {
                            if (!pickerOpen) onOpenChange(true);
                        }}
                        onChange={(event) => {
                            if (pickerOpen) {
                                setSearch(event.target.value);
                                setHighlightedContact(null);
                                focusedContact.current = null;
                            } else
                                setDrafts({
                                    ...drafts,
                                    [current]: event.target.value,
                                });
                        }}
                        aria-keyshortcuts={
                            pickerOpen
                                ? "ArrowUp ArrowLeft ArrowRight Enter"
                                : canChooseConversation
                                ? "Tab"
                                : undefined
                        }
                        onKeyDown={(event) => {
                            event.stopPropagation();
                            openConversationPicker(event);
                            const composing =
                                event.nativeEvent.isComposing ||
                                event.nativeEvent.keyCode === 229;
                            const modified =
                                event.shiftKey ||
                                event.ctrlKey ||
                                event.metaKey ||
                                event.altKey;
                            if (
                                pickerOpen &&
                                event.key === "ArrowUp" &&
                                !composing &&
                                !modified
                            ) {
                                event.preventDefault();
                                focusPickerContact();
                            }
                            if (
                                pickerOpen &&
                                ["ArrowLeft", "ArrowRight"].includes(
                                    event.key
                                ) &&
                                !composing &&
                                !modified &&
                                focusAdjacentContact(
                                    event.key === "ArrowRight" ? 1 : -1
                                )
                            )
                                event.preventDefault();
                            if (
                                event.key === "Enter" &&
                                (pickerOpen ||
                                    composing ||
                                    event.repeat ||
                                    modified)
                            )
                                event.preventDefault();
                            // Enter in search opens the highlighted conversation.
                            if (
                                pickerOpen &&
                                event.key === "Enter" &&
                                !composing &&
                                !event.repeat &&
                                !modified &&
                                !(search.trim() && !matches.length)
                            )
                                choose(
                                    previewId === GLOBAL
                                        ? null
                                        : contacts.find(
                                              (person) =>
                                                  person.id === previewId
                                          ) || null
                                );
                            if (event.key === "Escape" && !composing) {
                                event.preventDefault();
                                close();
                            }
                        }}
                    />
                    {!pickerOpen && message.trim() && (
                        <button
                            className="chat-send"
                            type="submit"
                            aria-label="Send message"
                            disabled={
                                sending ||
                                social.status !== "connected" ||
                                unavailable ||
                                !!disabledReason
                            }
                        >
                            <Icon name="up" size={16} />
                        </button>
                    )}
                </div>
                {!pickerOpen && canChooseConversation && !message && (
                    <kbd className="chat-shortcut" aria-hidden="true">
                        Tab
                    </kbd>
                )}
                {pickerOpen && groupConversations && (
                    <button
                        type="button"
                        className="chat-create-group"
                        aria-label="Create party"
                        title="Create party"
                        onClick={groupConversations.onCreate}
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            aria-hidden="true"
                        >
                            <path
                                d="M8 3v10M3 8h10"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>
                )}
            </form>
            {!pickerOpen && unavailable && (
                <p className="send-error" role="status">
                    {currentName} is no longer nearby. You can message them when
                    they return.
                </p>
            )}
            {sendError && (
                <p className="send-error" role="status">
                    {sendError}
                </p>
            )}
        </section>
    );
}
