import type { MultiplayerStartupResources } from "../multiplayerStartup";
import {
    dispatchNativeChat,
    nativeChatRecipient,
    receiveNativeChat,
} from "@utils/chat/nativeConversations";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";

import {
    Dispatch,
    SetStateAction,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";

import { CHAT_NEARBY_RADIUS } from "@3gl/factory/player/constants";

import Events from "@3events";

import { UPDATE_CHAT_BUBBLE } from "@components/_3DExhibit-v2/three/factory/multiplayer/constants";

import { UserContext } from "@components/context/UserContext";

import { nodeEnv } from "@env";

import { MINT_SPACE_CUSTOM_LINK } from "@components/_3DExhibit-v2/ui/ControlPanel/Raffle/raffles/rtfktRaffleConstants";

import { getProfanity } from "@utils/saveToDb";

import { Experience } from "@uitypes/experience";

import EventListener from "events";

export type ChatMode = "world" | "nearby" | "space" | string;

export const CHAT_TYPES = {
    INFO: {
        label: "INFO",
        color: "rgba(0, 0, 0, 0.2)",
    },
    MESSAGE: {
        label: "MESSAGE",
        color: "#00ff55",
    },
    REFRESH_MESSAGE: {
        label: "REFRESH_MESSAGE",
        color: "",
    },
    ALERT: {
        label: "ALERT",
        color: "rgba(0, 0, 0, 0.2)",
    },
    IS_CHATTING: {
        label: "IS_CHATTING",
        color: "",
    },
    // For things like voiceState, ...
    CUSTOM: {
        label: "CUSTOM",
        color: "",
    },
    KICK: {
        label: "KICK",
        color: "",
    },
};

let date = new Date();

function messageUI(message: string | JSX.Element, type: string, metadata = {}) {
    const content =
        typeof message === "string" ? (
            <div>
                <p>{message}</p>
            </div>
        ) : (
            message
        );

    return {
        Text: () => content,
        date: `${date.getHours()}:${date.getMinutes()}`,
        type,
        ...metadata,
        // username: userData?.username || userId,
    };
}

export function isPlayerOutsideMessageRadius(opts: {
    world;
    space: string;
    position: {
        x: number;
        z: number;
        y: number;
    };
}) {
    const { world, space, position } = opts;

    const player = world.current.getPlayerData();

    if (space !== player.space) {
        return true;
    }

    const center = {
        x: position.x,
        z: position.z,
    };

    const radius = CHAT_NEARBY_RADIUS * player.scale.y;

    const distance =
        Math.pow(player.position.x - center.x, 2) +
        Math.pow(player.position.z - center.z, 2);

    return Math.pow(radius, 2) <= distance;
}

const channels = [
    { text: "Room", value: "world", icon: "globe" },
    { text: "Space view", value: "space", icon: "music" },
    { text: "Nearby view", value: "nearby", icon: "navigation" },
];

type MessageType = keyof typeof CHAT_TYPES;

interface MessageUI {
    Text: () => JSX.Element;
    date: string;
    type: string;
}

interface Message {
    text: string;

    date: string;

    walletId: string;

    avatar: string;

    username: string;

    type: MessageType;

    position: { x: number; y: number; z: number };

    space: string;

    direct: string;

    acc_date?: string;

    Text?: any;

    sessionId: string;

    isChatting?: boolean;

    address?: string;

    loading: boolean;

    exhibit?: {
        id: string;
        name: string;
        image: string;
    };
}

export interface PlayerInfo {
    sessionId: string;
    userId: string;
    userData: {
        avatar?: string;
        username?: string;
        walletId?: string;
        isAdmin?: boolean;
    };
}

export interface ChatReturn {
    dispose: (roomId: string) => Promise<void>;
    init: (room: {
        roomId: any;
        isMod: boolean;
        sessionId: any;
        exhibit: Experience;
        label: string;
        isAnon: boolean;
    }, startup?: Pick<MultiplayerStartupResources, "chatProvider" | "profanity">) => Promise<import("@utils/chat/ChatChannel").ChatChannel | void>;
    channels: Array<{
        text: string;
        value: string;
        icon: string;
    }>;
    messageIndex: number;
    error: string;
    chatMode: ChatMode;
    isTyping: boolean;
    chatUsers: Array<{
        sessionId: string;
        isAdmin: boolean;
    }>;
    messages: Array<Message>;
    typingUsers: Array<string>;

    admins: Array<Player>;
    users: Array<Player>;
    playersInfo: Record<string, PlayerInfo>;
    loading: boolean;
    setTypingUsers: Dispatch<SetStateAction<string[]>>;
    setChatUsers: Dispatch<
        SetStateAction<
            {
                sessionId: string;
                isAdmin: boolean;
            }[]
        >
    >;
    setMessages: Dispatch<SetStateAction<Message[]>>;
    setError: Dispatch<SetStateAction<string>>;
    setChatMode: Dispatch<SetStateAction<ChatMode>>;
    setIsTyping: Dispatch<SetStateAction<boolean>>;
    setAdmins: Dispatch<SetStateAction<any[]>>;
    setUsers: Dispatch<SetStateAction<any[]>>;
    setLoading: Dispatch<SetStateAction<boolean>>;
    pushMessage: (msg: string | JSX.Element, type: string) => void;
    handleReceiveMessage: (opts: {
        message: Message;
        sessionId: string;
        create_time: string;
    }) => void;
    sendMessage: (opts: {
        type: any;
        payload: any;
        roomId: any;
        sessionId: string;
    }) => Message;
    isChatDisplayed: boolean;
    isMobileChatOpen: boolean;
    setIsMobileChatOpen: Dispatch<SetStateAction<boolean>>;
    setIsChatDisplayed: Dispatch<SetStateAction<boolean>>;
    active: boolean;
    isChatDisabled: boolean;
    swearwordsRegexRef: RegExp;
}

export default function useChat({ MultiplayerService, userId }): ChatReturn {
    //
    const abortController = useRef(null);

    const [chatUsers, setChatUsers] = useState<
        Array<{ sessionId: string; isAdmin: boolean }>
    >([]);

    const [messages, setMessages] = useState<Array<Message>>([]);

    const [active, setActive] = useState(false);

    const { userData } = useContext(UserContext);

    const [typingUsers, setTypingUsers] = useState<string[]>([]);

    const world = useWorld();

    const [error, setError] = useState("");

    const [chatMode, setChatMode] = useState<ChatMode>("world");

    const [isTyping, setIsTyping] = useState(false);

    // This can be refactored, we only need chatUsers
    const [admins, setAdmins] = useState([]);

    const [users, setUsers] = useState([]);

    const [playersInfo, setPlayersInfo] = useState<Record<string, PlayerInfo>>(
        {}
    );

    // Index of received messages.
    const [messageIndex, setMessageIndex] = useState(0);

    const [loading, setLoading] = useState(true);

    const [isChatDisplayed, setIsChatDisplayed] = useState(true);
    // The phone composer replaces the action row only when explicitly opened.
    const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

    const [isChatDisabled, setIsChatDisabled] = useState(false);

    const swearwordsRegexRef = useRef<RegExp>(null);

    const nChatMode = useRef(chatMode);

    const room = useRef(null);
    const playersInfoRef = useRef(playersInfo);
    playersInfoRef.current = playersInfo;
    const recentSends = useRef<Array<{ text: string; at: number }>>([]);

    useEffect(() => {
        nChatMode.current = chatMode;
    }, [chatMode]);

    async function init(_room, startup?: Pick<MultiplayerStartupResources, "chatProvider" | "profanity">) {
        abortController.current = new AbortController();

        try {
            room.current = _room;

            const handleAbort = () => {
                if (abortController.current.signal.aborted)
                    throw new Error(
                        `[ MULTIPLAYER DEBUG - VOICE - INIT ABORTED ${room.current?.label} ]`
                    );
            };

            handleAbort();

            console.log(
                `%c [ MULTIPLAYER DEBUG - CHAT - INIT ${room.current?.label} ]`,
                "background: #000000; color: #FDD7B4"
            );

            const { roomId, isMod, sessionId, exhibit, label, isAnon } = _room;

            world.current.setEventListener(
                Events.UPDATE_PLAYERS,
                (_players) => {
                    const admins = [];

                    const users = [];

                    const chatUsers = [];

                    const usersInfo = {};

                    Object.values(_players).forEach((player: any) => {
                        if (player != "loading") {
                            var playerData = player.getPayload();

                            if (playerData.userData.isAdmin) {
                                admins.push(playerData);
                            } else {
                                users.push(playerData);
                            }

                            chatUsers.push({
                                sessionId: playerData.sessionId,
                                isAdmin: playerData.userData.isAdmin,
                            });

                            usersInfo[playerData.sessionId] = playerData;
                        }
                        //
                    });

                    setAdmins(admins);

                    setUsers(users);

                    setPlayersInfo(usersInfo);
                }
            );

            handleAbort();

            const profinities = await (startup?.profanity || getProfanity({
                abortController: abortController.current,
            }));

            // load the swearwords
            if (!profinities) {
                swearwordsRegexRef.current = null;
            } else {
                swearwordsRegexRef.current = new RegExp(
                    profinities.join("|"),
                    "gi"
                );
            }

            handleAbort();

            setIsChatDisabled(roomId === MINT_SPACE_CUSTOM_LINK && !isMod);

            // Responsive CSS keeps the composer above or beside the dock.
            // Keep the visitor's chat visibility choice across resize/reconnect.

            // @ts-ignore
            const RTMClient = await (startup?.chatProvider || import("@utils/chat/ColyseusChatProvider"));

            handleAbort();

            MultiplayerService.current.chatService = new RTMClient.default();

            handleAbort();

            MultiplayerService.current.chatService.init(
                MultiplayerService.current.roomService.room
            );

            handleAbort();

            // _leaveChat.current = leaveChat; //! where is this used???

            setChatUsers((state) =>
                state.concat({ sessionId, isAdmin: isMod })
            );

            await MultiplayerService.current.chatService.login(
                roomId + "v1",
                sessionId
            );

            handleAbort();

            const channel =
                await MultiplayerService.current.chatService.joinChannel(
                    roomId
                );

            handleAbort();

            if (channel) {
                channel.on(
                    "ChannelMessage",
                    async (message, sessionId, serverTs) => {
                        const received = receiveNativeChat(
                            message,
                            sessionId,
                            room.current?.sessionId,
                            false,
                            playersInfoRef.current[sessionId]?.userData
                        );
                        if (received)
                            handleReceiveMessage({
                                message: received,
                                create_time: serverTs,
                                sessionId,
                            });
                    }
                );

                /*
                channel.on("MemberJoined", (userId) => {
                    console.log("[ CHAT MEMBER Joined ]", userId);
                });

                channel.on("MemberLeft", (userId) => {
                    console.log("[ CHAT MEMBER LEFT ]", userId);
                });
                */
            }

            MultiplayerService.current.chatService.on(
                "MessageFromPeer",
                (message, sender, serverTs, profile) => {
                    if (abortController.current?.signal.aborted) return;
                    const received = receiveNativeChat(
                        message,
                        sender,
                        room.current?.sessionId,
                        true,
                        profile || playersInfoRef.current[sender]?.userData
                    );
                    if (received)
                        handleReceiveMessage({
                            message: received,
                            create_time: serverTs,
                            sessionId: sender,
                        });
                }
            );

            handleAbort();

            setActive(true);

            console.log(
                `%c [ MULTIPLAYER DEBUG - CHAT - INIT SUCCESS ${room.current?.label} ]`,
                "background: #000000; color: #00FF00"
            );

            return channel;
        } catch (err) {
            console.log(
                `%c [ MULTIPLAYER DEBUG - CHAT - INIT FAILED ${room.current?.label} ]`,
                "background: #000000; color: #FF0000"
            );
            console.log(err);
        } finally {
            setLoading(false);

            console.log(
                `%c [ MULTIPLAYER DEBUG - CHAT - INIT END ${room.current?.label} ]`,
                "background: #000000; color: #FDD7B4"
            );
        }
    }

    function handleReceiveMessage({
        message,
        create_time,
        sessionId,
    }: {
        message: Message;
        sessionId: string;
        create_time: string;
    }) {
        if (sessionId === room.current.sessionId) return;

        const { isChatting, type, username } = message;

        switch (message.type) {
            case CHAT_TYPES.IS_CHATTING.label:
                if (isChatting) {
                    setTypingUsers((state) => state.concat(sessionId));
                } else {
                    setTypingUsers((state) =>
                        state.filter(
                            (_sessionId) =>
                                _sessionId !== room.current.sessionId
                        )
                    );
                }
                break;

            case CHAT_TYPES.CUSTOM.label:
                break;

            case CHAT_TYPES.KICK.label:
                setMessages((state) =>
                    state.filter((message) => message.sessionId !== sessionId)
                );

                break;

            case CHAT_TYPES.REFRESH_MESSAGE.label:
                setMessages((state) =>
                    state.map((_message) => {
                        if (
                            _message.acc_date === message.acc_date &&
                            _message.sessionId === sessionId &&
                            _message.direct === message.direct
                        ) {
                            return {
                                ..._message,

                                loading: message.loading,

                                exhibit: message.exhibit,
                            };
                        }

                        return _message;
                    })
                );

                break;

            case CHAT_TYPES.MESSAGE.label:
                const date = new Date(create_time);

                // we parse here

                setMessages((state) => {
                    const payload = {
                        text: swearwordsRegexRef.current
                            ? message.text.replace(
                                  swearwordsRegexRef.current,
                                  "****"
                              )
                            : message.text,

                        date: `${date.getHours()}:${date.getMinutes()}`,

                        walletId: message.walletId,

                        avatar: message.avatar,

                        username: message.username,

                        type: message.type,

                        position: message.position,

                        space: message.space,

                        direct: message.direct,

                        address: message?.address,

                        sessionId,

                        acc_date: message.acc_date,

                        loading: message.loading,
                    };
                    return [payload, ...state];
                });

                setMessageIndex((prevState) => prevState + 1);

                // Private conversations must never become world-visible avatar bubbles.
                if (message.direct) return;

                // We don't show bubble in these cases
                if (nChatMode.current === "space") {
                    const player = world.current.getPlayerData();

                    if (message.space !== player.space) {
                        return;
                    }
                }

                if (nChatMode.current === "nearby" && message.position) {
                    if (
                        isPlayerOutsideMessageRadius({
                            world,
                            space: message.space,
                            position: message.position,
                        })
                    ) {
                        return;
                    }
                }

                const response: any = world.current.handleCommand({
                    type: UPDATE_CHAT_BUBBLE,
                    payload: {
                        text: message.text,

                        date: `${date.getHours()}:${date.getMinutes()}`,

                        acc_date: message.acc_date,

                        username: message.username,

                        sessionId,
                    },
                });

                if (!response?.success) {
                    console.error("Failed to find user.");
                }
        }
    }

    function sendMessage({ type, payload, roomId, sessionId }) {
        if (!MultiplayerService.current.chatService || !room.current) return;
        sessionId = room.current.sessionId;
        roomId = room.current.roomId;
        const textMessage = type === CHAT_TYPES.MESSAGE.label;
        const update = type === CHAT_TYPES.REFRESH_MESSAGE.label;
        const recipient = update
            ? payload.recipientId
            : payload?.recipientId || nativeChatRecipient(chatMode);
        if (
            (textMessage || update) &&
            (isChatDisabled ||
                (recipient &&
                    (recipient === room.current.sessionId ||
                        !playersInfoRef.current[recipient])))
        )
            return;
        if (textMessage) {
            const text = payload?.message?.trim();
            if (!text || text.length > 200) return;
            const now = Date.now();
            const sent = recentSends.current;
            // Preserve the native guest and burst limits for both room and peer routes.
            const guestLimited =
                String(userId).startsWith("Anon-") &&
                room.current.exhibit?.info?.room !== "theunderworld";
            if (
                (guestLimited &&
                    sent.length &&
                    now - sent[sent.length - 1].at < 30000) ||
                (sent.length >= 2 && now - sent[sent.length - 2].at <= 1000) ||
                (sent.length >= 4 &&
                    sent.slice(-4).every((item) => item.text === text))
            )
                return;
            payload = { ...payload, message: text };
        }

        let _payload;

        if (type === CHAT_TYPES.IS_CHATTING.label) {
            _payload = {
                username: userData?.username || userId,

                isChatting: payload,

                type: CHAT_TYPES.IS_CHATTING.label,

                sessionId,
            };
        } else if (type === CHAT_TYPES.CUSTOM.label) {
            _payload = {
                username: userData?.username || userId,

                payload,

                type: CHAT_TYPES.CUSTOM.label,

                sessionId,
            };
        } else if (type === CHAT_TYPES.KICK.label) {
            _payload = {
                userId: userId,

                type: CHAT_TYPES.KICK.label,

                sessionId,
            };
        } else if (type === CHAT_TYPES.REFRESH_MESSAGE.label) {
            _payload = {
                type,

                sessionId,

                acc_date: payload.acc_date,

                exhibit: payload.exhibit,

                loading: payload.loading,
            };

            setMessages((state) =>
                state.map((message) => {
                    if (message.acc_date === payload.acc_date) {
                        return {
                            ...message,

                            loading: payload.loading,

                            exhibit: payload.exhibit,
                        };
                    }

                    return message;
                })
            );
        } else if (type === CHAT_TYPES.MESSAGE.label) {
            const date = new Date();

            const player = world.current.getPlayerData();

            // !parse here

            _payload = {
                // text: payload.message,
                text: swearwordsRegexRef.current
                    ? payload.message.replace(
                          swearwordsRegexRef.current,
                          "****"
                      )
                    : payload.message,

                acc_date: new Date().toISOString(),

                date: `${date.getHours()}:${date.getMinutes()}`,

                username: userData?.username || userId,

                avatar: userData?.avatar || "",

                type,

                position: player.position,

                address: userData?.id,

                space: player.space,

                sessionId,

                walletId: userId,

                messageType: payload.messageType,

                loading: payload.loading,
            };

            if (recipient) _payload.direct = recipient;

            if (CHAT_TYPES.REFRESH_MESSAGE.label !== type) {
                setMessages((state) => [
                    {
                        walletId: userId,
                        ..._payload,
                    },
                    ...state,
                ]);
            }
        }

        if (recipient) _payload.direct = recipient;
        const sent = dispatchNativeChat({
            transport: MultiplayerService.current.chatService,
            message: _payload,
            roomId,
            recipient,
            allowed: !(textMessage || update) || !isChatDisabled,
            peerPresent: !recipient || !!playersInfoRef.current[recipient],
            saveHistory: (message) => {
                void fetch(
                    `${nodeEnv.PUBLIC_API}/api/chat/history?roomId=${roomId}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(message),
                    }
                ).catch(() => {});
            },
        });
        if (!sent) return;
        if (textMessage)
            recentSends.current = [
                ...recentSends.current.slice(-9),
                { text: payload.message, at: Date.now() },
            ];

        return _payload;
    }

    const pushMessage = (msg: string | JSX.Element, type: string) =>
        // @ts-ignore
        setMessages((state) => {
            const player = world.current.getPlayerData();

            const payload = messageUI(msg, type, {
                space: player.space,
                position: player.position,
            });

            return [payload, ...state];
        });

    async function dispose(roomId: string) {
        console.log(
            `%c [ MULTIPLAYER DEBUG - CHAT - DISPOSE ${room.current?.label} ]`,
            "background: #000000; color: #ffffff",
            active
        );

        if (abortController.current) {
            abortController.current.abort();
        }

        if (!MultiplayerService.current?.chatService) return;

        setChatUsers([]);

        setMessages([]);
        setPlayersInfo({});
        setChatMode("world");
        recentSends.current = [];

        setTypingUsers([]);

        setAdmins([]);

        setUsers([]);

        world.current.setEventListener(Events.UPDATE_PLAYERS, null);

        await MultiplayerService.current.chatService.leaveChannel(roomId);

        await MultiplayerService.current.chatService.logout();

        await MultiplayerService.current.chatService.dispose();

        MultiplayerService.current.chatService = null;

        setActive(false);
    }

    return {
        dispose,
        init,
        channels,
        pushMessage,
        sendMessage,
        handleReceiveMessage,
        chatUsers,
        messages,
        typingUsers,
        error,
        chatMode,
        isTyping,
        admins,
        users,
        playersInfo,
        loading,
        setTypingUsers,
        setChatUsers,

        setMessages,
        setError,
        setChatMode,
        setIsTyping,
        setAdmins,
        setUsers,
        setLoading,
        isChatDisplayed,
        setIsChatDisplayed,
        isMobileChatOpen,
        setIsMobileChatOpen,
        active,
        isChatDisabled,
        messageIndex,
        swearwordsRegexRef: swearwordsRegexRef.current,
    };
}
