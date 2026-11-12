import { markNativeStartup } from "@utils/nativeStartupDiagnostics";
import { getProfanity } from "@utils/saveToDb";
import {
    prepareMultiplayerResources,
    awaitMultiplayerStep,
    MultiplayerStartupResources,
} from "./multiplayerStartup";
import {
    connectionRecovery,
    connectionTransition,
    reportedConnection,
    type MultiplayerAdmission,
    type MultiplayerConnection,
    type MultiplayerConnectionEvent,
    type MultiplayerEndReason,
} from "./multiplayerConnection";
import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";
import { decodeNativeChatPayload } from "@utils/chat/nativeConversations";
import {
    isLobbyDestinationPreparing,
    isLobbyDestinationEntering,
} from "@utils/lobbyDestinationBridge";
import shortid from "shortid";

import React, {
    MutableRefObject,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";

import { UserContext } from "@components/context/UserContext";

import EventEmitter from "events";
import {
    CHAT_NEARBY_RADIUS,
    UPDATE_AVATAR,
    UPDATE_VRM,
    UPDATE_USERNAME,
} from "../three/factory/player/constants";

import { useWorld } from "../hooks/useWorld";

import {
    DEFAULT_VRM,
    IS_MOBILE,
    IS_MULTIPLAYER,
    IS_MULTIPLAYER_ENABLED,
} from "../three/constants";

import { useGatingError } from "@components/context/GatingErrorContext";

import { GET_USERS_INFO } from "../three/factory/multiplayer/constants";

import useChat, { ChatReturn, CHAT_TYPES } from "./hooks/useChat";

import useVoice, { VoiceReturn } from "./hooks/useVoice";

import useRoom, { RoomReturn } from "./hooks/useRoom";

import { formatAvatar } from "../utils/avatar";

import { useEventCallback } from "@components/hooks/useEventCallback";

import { Mode } from "../ui/ControlPanel/context/Mode";

import type RTMClient from "@utils/chat/ColyseusChatProvider";

import { RTC_SPACES } from "@utils/voiceChat/constants";

import SocialApi from "@api/social/_api";
import { worldPasswordChanged } from "@utils/worldPassword/publicGating";
import {
    readWorldAccessProof,
    rememberWorldAccess,
    renewWorldAccess,
} from "@utils/worldPassword/accessProofs";

export const ANON_USER_ID = "Anon-" + shortid.generate();

export interface MultiplayerService {
    roomService: any;
    chatService: RTMClient;

    sendCommand: (type: string, data: any) => Promise<void>;
    sendPeerCommand: (
        type: string,
        data: any,
        sessionId: string
    ) => Promise<boolean>;
    onCommand: (
        type: string,
        listener: (data: any, username: string) => unknown
    ) => void;
    offCommand: (
        type: string,
        listener: (data: any, username: string) => unknown
    ) => void;

    getUserAttribute: <T>(sessionId: string, key: string) => Promise<T>;
    setUserAttribute: <T>(key: string, value: T) => Promise<void>;

    getChannelAttribute: <T>(key: string) => Promise<T>;
    setChannelAttribute: <T>(key: string, value: T) => Promise<void>;
}

export type MultiplayerModeOptions = {
    signal?: AbortSignal;
    /** Background destination admission must not move or bounce the visitor. */
    background?: boolean;
};

// The states and the moves between them are in multiplayerConnection.ts.
export type {
    MultiplayerConnection,
    MultiplayerEndReason,
} from "./multiplayerConnection";

interface MultiplayerContextState {
    room: RoomReturn;
    voice: VoiceReturn;
    chat: ChatReturn;
    connection: MultiplayerConnection;
    /**
     * Join the room again, in place, after a connection that failed, was
     * lost, or was closed because the visitor was away. Resolves false when
     * that is not where the connection stands, or the room was not reached.
     */
    rejoin: () => Promise<boolean>;
    /**
     * After the world's password changed: ask the server whether this is the
     * new one, and join again when it is. Resolves null when it was
     * accepted, otherwise why not ("password-error" for a wrong password).
     */
    enterPassword: (password: string) => Promise<string | null>;
    mode: "solo" | "multiplayer";
    changeMode: (
        mode: "solo" | "multiplayer",
        opts?: MultiplayerModeOptions
    ) => Promise<boolean>;
    userId: string;
    MultiplayerService: MutableRefObject<MultiplayerService>;
    dispose: any;
    _onChangeModeCallback: any;
    _onConnect: any;
    reconnect: any;
    onConnect: (userData: any, walletId: string, token: string) => void;
    switchRoom({
        exhibit,
        destination,
    }: {
        exhibit: any;
        destination: any;
    }): void;
    refreshVoiceRights: (exhibit: any) => void;
}

export const MultiplayerContext =
    React.createContext<MultiplayerContextState>(null);

export const getMode = (exhibit): "solo" | "multiplayer" => {
    if (!IS_MULTIPLAYER_ENABLED(exhibit)) return "solo";

    // const isLoft = exhibit?.info?.customLink == "cyberloft";

    // if (typeof window !== "undefined") {
    //     const state = localStorage.getItem(
    //         `scene_player_mode_${exhibit?.info?.customLink || exhibit.id}`
    //     ) as "multiplayer" | "solo";
    //     return state ? state : isLoft ? "multiplayer" : "solo";
    // } else {
    //     return "solo";
    // }

    return "multiplayer";
};

const RTM_COMMAND = "RTM_COMMAND";

export const KICK_COMMAND = "KICK_COMMAND";

// Mod broadcast: pull every user outside `radius` of the target user to a
// ring around them (each receiver shows a 5s countdown notification and
// teleports itself unless rejected). Rides the same client-gated RTM relay
// as KICK_COMMAND. Payload: { sessionId, username, radius }.
export const SUMMON_COMMAND = "SUMMON_COMMAND";

export default function MultiplayerProvider({
    children,
    exhibit,
    destination,
    vrmUrl,
}) {
    const { user, userData, token, dispatch } = useContext(UserContext);

    const world = useWorld();

    const { gatingError, callbackAfterSuccess } = useGatingError();

    const _onChangeModeCallback = useRef(null);

    const _onConnect = useRef(null);

    const userId = user.id || ANON_USER_ID;

    const emitter = useRef(new EventEmitter());

    const abortController = useRef<AbortController>(null);
    const modeGeneration = useRef(0);
    const currentMode = useRef<"solo" | "multiplayer">("solo");
    const clearEntrySignal = useRef<() => void>();

    // this is actually the one holding the right state for the mode - the one in the context is just for the UI (needs to be refactored)
    const [rMode, setRMode] = useState<"solo" | "multiplayer">("solo");

    const sendCommand = useEventCallback(
        (type: string, data: any, peerId?: string) => {
            const payload = {
                type: RTM_COMMAND,
                command: {
                    type,
                    data,
                },
            };

            if (peerId) {
                const msg = JSON.stringify(payload);
                return MultiplayerService.current.chatService.sendPeerMessage(
                    msg,
                    peerId
                );
            } else {
                return MultiplayerService.current.chatService.sendChannelMessage(
                    payload,
                    room?.id
                );
            }
        },
        [room?.id]
    );

    const onRtmMessage = useEventCallback(
        (payload, sessionId) => {
            //
            payload = decodeNativeChatPayload(payload);
            if (payload?.type !== RTM_COMMAND || !payload.command) return;

            const { type, data } = payload.command;

            emitter.current.emit(type, data, sessionId);
            //
        },
        [room?.id]
    );

    const onCommand = useEventCallback(
        (type, listener) => {
            return emitter.current.on(type, listener);
        },
        [room?.id]
    );

    const offCommand = useEventCallback(
        (type, listener) => {
            return emitter.current.off(type, listener);
        },
        [room?.id]
    );

    const getUserAttribute = useEventCallback(
        async (sessionId: string, key: string) => {
            return MultiplayerService.current.chatService?.getUserAttribute(
                sessionId,
                key
            );
        },
        [room?.id]
    );

    const setUserAttribute = useEventCallback(
        async (key: string, value: any) => {
            return MultiplayerService.current.chatService?.setLocalUserAttribute(
                key,
                value
            );
        },
        [room?.id]
    );

    const getChannelAttribute = useEventCallback(
        async (key: string) => {
            return MultiplayerService.current.chatService?.getChannelAttribute(
                room?.id,
                key
            );
        },
        [room?.id]
    );

    const setChannelAttribute = useEventCallback(
        async (key: string, value: any) => {
            return MultiplayerService.current.chatService?.setChannelAttribute(
                room?.id,
                key,
                value
            );
        },
        [room?.id]
    );

    const MultiplayerService: MutableRefObject<MultiplayerService> = useRef({
        roomService: null, // room currently has both voice and room service
        chatService: null,
        sendCommand: sendCommand as any,
        sendPeerCommand: sendCommand as any,
        onCommand,
        offCommand,
        getUserAttribute,
        setUserAttribute,
        getChannelAttribute,
        setChannelAttribute,
    });

    const chat = useChat({
        MultiplayerService,
        userId,
    });

    var room = useRoom({
        MultiplayerService,
        userId,
    });

    const voice = useVoice({
        MultiplayerService,
        userId,
    });

    const [mode, setMode] = useState<"solo" | "multiplayer">(
        gatingError ? "solo" : getMode(exhibit)
    );

    // Where the link to the room stands, and why it ended when the visitor
    // did not choose that; `connection` below adds "lost".
    const [admission, setAdmission] = useState<MultiplayerAdmission>("idle");

    const applyConnection = (event: MultiplayerConnectionEvent) =>
        setAdmission((state) => connectionTransition(state, event));

    // The world whose room was joined last, as it was then. A portal can
    // have taken the visitor to another world than the page's.
    const joinedWorld = useRef<{ exhibit: any; destination: any }>(null);

    // The world the visitor stands in. The `exhibit` and `destination` props
    // stay those of the page's world: a portal moves the visitor without
    // changing them, so joining a room from them would join the first world.
    const standingWorld = useRef<{ exhibit: any; destination: any }>(null);

    // DisplayScene closes the room when a signed-in visitor's world gets a
    // new password, without saying so. The same comparison is made here, for
    // the world that was joined, so that close can be explained. Exhibits
    // carry the password's revision, not the password.
    const liveExhibit = useCurrentExhibit()?.exhibit;
    const passwordChanged = () => {
        const joined = joinedWorld.current?.exhibit;
        return (
            !room.isMod &&
            !!joined &&
            !!liveExhibit &&
            liveExhibit.id === joined.id &&
            worldPasswordChanged(joined.gating, liveExhibit.gating)
        );
    };

    useDisconnectUserIfInactive({
        disconnectMultiplayer: () => disconnectMultiplayer("inactive"),
        mode,
        MultiplayerService,
    });

    useEffect(() => {
        if (callbackAfterSuccess?.current) {
            callbackAfterSuccess.current = changeMode;
        }
    }, [rMode]);

    async function reconnect() {
        await disconnectMultiplayer();

        await changeMode("multiplayer");
    }

    async function onConnect(userData, account, token) {
        if (userData.username || userData.walletId) {
            if (world?.current) {
                world.current.updatePlayer({
                    type: UPDATE_USERNAME,
                    payload: userData.username
                        ? userData.username.trim()
                        : userData.walletId,
                    display: true,
                });
            }
        }

        let avatarImg = await formatAvatar(userData, dispatch, exhibit);

        if (userData.avatar) {
            if (world?.current) {
                world.current.updatePlayer({
                    type: UPDATE_AVATAR,
                    payload: avatarImg,
                    display: true,
                });
            }
        }

        if (userData.VRM) {
            if (world?.current) {
                world.current.updatePlayer({
                    type: UPDATE_VRM,
                    payload: userData.VRM,
                    display: true,
                });
            }
        }

        chat.setMessages((state) =>
            state.map((message) => {
                if (room.sessionId === message.sessionId) {
                    return {
                        ...message,
                        username: userData?.username?.trim?.() || account,
                        walletId: account,
                        avatar: avatarImg || "",
                    };
                }

                return message;
            })
        );

        if (mode === "multiplayer") {
            if (MultiplayerService.current.roomService.room) {
                MultiplayerService.current.roomService.room.send("login", [
                    token,
                    userData?.username?.trim?.() || account,
                    avatarImg,
                    account,
                ]);
            }
        }

        const isMod = await checkIsMod(room.label, token);

        room.setIsMod(isMod);

        voice.refreshIfMod(isMod, {
            label: room.label,
            roomId: room?.id,
        });

        if (_onConnect.current) {
            _onConnect.current(userData);
        }

        MultiplayerService.current?.setUserAttribute("walletId", userId);
    }

    // With a reason, this is the provider putting the visitor in solo: said
    // before the room closes, so the reason stays when it does.
    async function disconnectMultiplayer(reason?: MultiplayerEndReason) {
        if (mode === "solo") return;

        if (reason) applyConnection({ type: "ended", reason });

        await switchMode("solo");

        if (_onChangeModeCallback.current) {
            _onChangeModeCallback.current(Mode.SOLO);
        }
    }

    // One listener: a rejoin must not leave the last room's behind.
    const kickListener = useRef<(request: any) => unknown>(null);

    function initMultiplayer(roomId, sessionId, isMod) {
        if (MultiplayerService?.current?.roomService?.room) {
            // MultiplayerService.current.roomService.room.onMessage(
            //     "kick",
            // );

            if (kickListener.current)
                MultiplayerService.current.offCommand(
                    KICK_COMMAND,
                    kickListener.current
                );

            // The server relays this command from moderators only, so the
            // visitor can be told who decided.
            kickListener.current = async (request) => {
                if (request.userId === userId && !isMod) {
                    chat.sendMessage({
                        type: CHAT_TYPES.KICK.label,
                        payload: {
                            userId,
                        },
                        sessionId,
                        roomId,
                    });

                    end("removed");
                }
            };

            MultiplayerService.current.onCommand(
                KICK_COMMAND,
                kickListener.current
            );
        }
    }

    async function checkIsMod(
        _label,
        _token = token,
        controller = abortController.current
    ) {
        try {
            if (!_token) return false;

            const isMod = await SocialApi.opts({
                signal: controller?.signal,
            }).isMod({ slug: _label });

            return isMod;
        } catch (err) {
            // Swallowing this silently presents as "not a mod" in the UI.
            console.warn("[multiplayer] isMod check failed", err);
            return false;
        }
    }

    const closed = useRef(false);
    const pendingConnections = useRef(new Set<Promise<any>>());
    const disposal = useRef<Promise<void>>(null);
    const disposeRef = useRef<() => Promise<void>>();
    disposeRef.current = dispose;
    useEffect(() => {
        closed.current = false;
        return () => {
            closed.current = true;
            void disposeRef.current?.().catch(console.error);
        };
    }, []);

    // Callers outside the provider close the room without saying why. One
    // cause can be seen from here: the world's password changed.
    function dispose() {
        return passwordChanged() ? end("password-changed") : close();
    }

    /** Close the room for a reason the visitor did not choose. */
    function end(reason: MultiplayerEndReason) {
        applyConnection({ type: "ended", reason });
        return close();
    }

    function close() {
        if (!disposal.current)
            disposal.current = closeConnections().finally(() => {
                disposal.current = null;
            });
        return disposal.current;
    }

    async function closeConnections() {
        modeGeneration.current++;
        currentMode.current = "solo";
        applyConnection({ type: "closed" });
        clearEntrySignal.current?.();
        clearEntrySignal.current = undefined;
        console.log(" [ MULTIPLAYER DEBUG - GENERAL DISPOSE ] ");
        if (abortController.current) {
            abortController.current.abort();
        }

        const channel =
            MultiplayerService.current.chatService?.channels?.[room?.id];

        if (channel) {
            channel.channel.removeAllListeners();
        }

        MultiplayerService.current.chatService?.removeAllListeners?.();

        const closeServices = () =>
            Promise.allSettled([
                voice?.dispose?.(),
                chat?.dispose?.(room?.id),
                room?.dispose?.(),
            ]);
        await closeServices();
        await Promise.allSettled([...pendingConnections.current]);
        // A connection may have completed while its service was being closed.
        await closeServices();
        applyConnection({ type: "closed" });
    }

    function loadMultiplayer(
        _exhibit = exhibit,
        _destination = destination,
        options: MultiplayerModeOptions = {}
    ) {
        if (closed.current || disposal.current || options.signal?.aborted)
            return Promise.resolve({ success: false });
        // Repeated entry/mode effects share one admission attempt.
        const existing = pendingConnections.current.values().next().value;
        if (existing) return existing;
        const pending = loadMultiplayerImpl(_exhibit, _destination, options);
        pendingConnections.current.add(pending);
        void pending
            .finally(() => pendingConnections.current.delete(pending))
            .catch(() => {});
        return pending;
    }

    async function loadMultiplayerImpl(
        _exhibit = exhibit,
        _destination = destination,
        options: MultiplayerModeOptions = {}
    ) {
        let startup: MultiplayerStartupResources;
        let controller: AbortController;
        let connected = false;
        let engineStarted = false;
        let connectionLabel: string;
        const currentWorld = world.current;
        const cancel = () => {
            controller?.abort();
            void close().catch(console.error);
        };
        try {
            controller = new AbortController();
            abortController.current = controller;
            applyConnection({ type: "connect" });
            joinedWorld.current = {
                exhibit: _exhibit,
                destination: _destination,
            };
            clearEntrySignal.current?.();
            clearEntrySignal.current = () =>
                options.signal?.removeEventListener("abort", cancel);
            options.signal?.addEventListener("abort", cancel, { once: true });
            if (options.signal?.aborted) cancel();

            const from = null;

            const label =
                from || _exhibit?.info?.customLink || `s@${_exhibit.id}`;

            connectionLabel = label;
            const handleAbort = () => {
                if (
                    closed.current ||
                    controller.signal.aborted ||
                    abortController.current !== controller ||
                    world.current !== currentWorld
                )
                    throw new DOMException(
                        "Multiplayer join cancelled",
                        "AbortError"
                    );
            };

            handleAbort();

            console.log(" [ MULTIPLAYER DEBUG - GENERAL INIT ] ");
            markNativeStartup("multiplayer-start");
            // Only warm after explicit entry; none of these loaders joins a room.
            startup = prepareMultiplayerResources({
                roomService: () => import("@utils/arena"),
                chatProvider: () => import("@utils/chat/ColyseusChatProvider"),
                profanity: () => getProfanity({ abortController: controller }),
            });

            const isMod = await awaitMultiplayerStep(
                checkIsMod(label, token, controller),
                controller.signal
            );
            handleAbort();

            let avatarImg = await awaitMultiplayerStep(
                formatAvatar(
                    userData,
                    (action) => {
                        if (
                            !closed.current &&
                            !controller.signal.aborted &&
                            abortController.current === controller
                        )
                            dispatch(action);
                    },
                    _exhibit
                ),
                controller.signal
            );
            markNativeStartup("multiplayer-profile-ready");

            handleAbort();

            let VRM = vrmUrl;

            // let VRM = (
            //     await getAvatarMetadata({
            //         userData,
            //         exhibit: _exhibit,
            //     })
            // ).url;

            const payload = {
                mode: "multiplayer",
                roomParameters: _destination,
                userData: {
                    username: userData?.username || userId || "",

                    avatar: avatarImg,

                    walletId: userData?.walletId || "",

                    isAdmin: false,
                },
                exhibit: _exhibit,
                user: {
                    id: userId || "",
                },
                editMode: false,
                sessionId: "",
                MultiplayerService: MultiplayerService.current,
                currentSpace: _exhibit.id,
                settings: userData?.settings,
            };

            if (VRM) {
                payload.userData.VRM = VRM;
            }

            handleAbort();

            // A password-gated world's room admits the visitor with the
            // proof the gating check gave; renew it first if it is expiring.
            await awaitMultiplayerStep(
                renewWorldAccess(label, (proof) =>
                    SocialApi.opts({
                        encode: true,
                        signal: controller.signal,
                    }).checkGating({ spaceId: label, nbPlayers: 0, proof })
                ),
                controller.signal
            );
            handleAbort();

            const _room = await awaitMultiplayerStep(
                room.init(
                    _exhibit,
                    {
                        ...world.current.getPlayerData({
                            multiplayerPos: true,
                        }),
                        currentSpace: _exhibit.id,
                        accessProof: readWorldAccessProof(label),
                        //VRM,
                    },
                    {
                        label,
                        isMod,
                        avatar: avatarImg,
                        signal: controller.signal,
                    },
                    startup
                ),
                controller.signal
            );
            handleAbort();
            if (
                !_room?.sessionId ||
                !MultiplayerService.current.roomService?.room
            )
                throw new Error("Failed to join multiplayer mode");
            markNativeStartup("multiplayer-room-joined");

            const roomParams = {
                roomId: _room?.label || label,
                isMod: _room?.isMod || isMod,
                sessionId: _room?.sessionId || shortid.generate(),
                exhibit: _exhibit,
                label,
                isAnon: !userData?.username,
            };

            handleAbort();

            payload.userData.isAdmin = isMod;

            payload.sessionId = roomParams?.sessionId;

            // if (!_room?.roomId)
            //     return {
            //         success: false,
            //     };

            // this should be called first and no need to await now
            const chatPromise = chat.init(roomParams, startup);

            handleAbort();

            // Destination should be up to date with us teleporting
            engineStarted = true;
            const enginePromise = Promise.resolve()
                .then(() => {
                    handleAbort();
                    return currentWorld.setMultiplayer(payload);
                })
                .then(() => {
                    handleAbort();
                    const response = world.current.handleCommand({
                        type: GET_USERS_INFO,
                    });

                    if (response) {
                        chat.setAdmins(
                            response.players.filter(
                                (user) => user.userData.isAdmin
                            )
                        );

                        chat.setUsers(
                            response.players.filter(
                                (user) => !user.userData.isAdmin
                            )
                        );
                    }
                });

            handleAbort();

            // Drain both branches before allowing a failed attempt to retry.
            const [chatResult, engineResult] = await Promise.allSettled([
                chatPromise,
                enginePromise,
            ]);
            handleAbort();
            if (engineResult.status === "rejected") throw engineResult.reason;
            const chatReady =
                chatResult.status === "fulfilled" && !!chatResult.value;
            markNativeStartup(
                chatReady
                    ? "multiplayer-chat-engine-ready"
                    : "multiplayer-chat-degraded"
            );
            if (chatResult.status === "rejected")
                console.warn(
                    "[multiplayer] native chat unavailable",
                    chatResult.reason
                );

            handleAbort();

            // this should be called after chat has been inited
            const channel =
                MultiplayerService.current.chatService?.channels?.[
                    roomParams.roomId
                ];

            if (channel) {
                channel.channel.on("ChannelMessage", onRtmMessage);
            }

            MultiplayerService.current.chatService?.on(
                "MessageFromPeer",
                onRtmMessage
            );

            const needsHostPermission =
                RTC_SPACES.includes(roomParams.roomId) === false &&
                !_exhibit?.params?.voiceAllowed;

            if (chatReady)
                try {
                    await voice.init({
                        id: roomParams.roomId,
                        sessionId: roomParams.sessionId,
                        spaceId: roomParams.exhibit.id,
                        label: roomParams.label,
                        isMod: roomParams.isMod,
                        needsHostPermission,
                    });
                    // The hook owns voice readiness/error state; room admission does
                    // not fail or reconnect the engine when voice is unavailable.
                    markNativeStartup("multiplayer-voice-attempted");
                } catch (err) {
                    handleAbort();
                    markNativeStartup("multiplayer-voice-degraded");
                    console.warn("[multiplayer] native voice unavailable", err);
                }

            handleAbort();
            initMultiplayer(roomParams.roomId, roomParams.sessionId, isMod);

            console.log(" [ MULTIPLAYER DEBUG - GENERAL SUCCESS ] ");
            connected = true;
            // switchRoom also uses this admission path directly.
            currentMode.current = "multiplayer";
            applyConnection({ type: "joined" });

            return {
                success: true,
            };
        } catch (err) {
            const cancelled =
                controller?.signal.aborted ||
                closed.current ||
                abortController.current !== controller ||
                world.current !== currentWorld;
            controller?.abort();
            // A cancelled attempt was closed or replaced: nothing to report.
            applyConnection(
                cancelled ? { type: "cancelled" } : { type: "failed" }
            );
            // closeConnections waits on this attempt, so never await dispose()
            // here. Clean a failed partial join directly before a retry begins.
            if (!cancelled) {
                await Promise.allSettled([
                    voice.dispose(),
                    chat.dispose(connectionLabel),
                    room.dispose(),
                ]);
                if (
                    engineStarted &&
                    world.current === currentWorld &&
                    !closed.current &&
                    !options.signal?.aborted &&
                    abortController.current === controller
                ) {
                    await currentWorld
                        .setMultiplayer({ mode: "solo", preserveCamera: true })
                        .catch(console.error);
                }
            }
            console.log(" [ MULTIPLAYER DEBUG - GENERAL ERROR ] ", err);
            return {
                success: false,
            };
        } finally {
            if (!connected)
                options.signal?.removeEventListener("abort", cancel);
        }
    }

    async function switchRoom({ exhibit, destination }) {
        // Recorded in solo too: turning multiplayer on later joins this room.
        standingWorld.current = { exhibit, destination };
        if (mode === "solo") return;

        await close();

        if (IS_MULTIPLAYER) {
            await world.current.setMultiplayer({ mode: "solo" });
        }

        await loadMultiplayer(exhibit, destination);

        console.log(
            "SWITCHED TO ROOM ===",
            exhibit?.info?.customLink || exhibit?.id,
            destination
        );
    }

    async function loadSolo() {
        if (closed.current) return;
        await world.current.setMultiplayer({ mode: "solo" });
    }

    function changeMode(
        newMode: "solo" | "multiplayer",
        options: MultiplayerModeOptions = {}
    ) {
        // Solo picked by the visitor is their choice: an earlier ending no
        // longer needs explaining.
        if (newMode === "solo") applyConnection({ type: "solo" });
        return switchMode(newMode, options);
    }

    async function switchMode(
        newMode: "solo" | "multiplayer",
        options: MultiplayerModeOptions = {},
        // Which world's room to join: the one the visitor stands in.
        target: { exhibit: any; destination: any } = standingWorld.current || {
            exhibit,
            destination,
        }
    ) {
        // Preparation must not join destination chat/voice while the host is
        // still socially present in the lobby. Admission starts on explicit Enter.
        if (
            newMode === "multiplayer" &&
            isLobbyDestinationPreparing() &&
            !isLobbyDestinationEntering()
        )
            return false;
        try {
            if (closed.current || options.signal?.aborted) return false;
            if (
                currentMode.current === newMode &&
                !pendingConnections.current.size
            )
                return true;
            const generation = modeGeneration.current;
            const isCurrent = () =>
                !closed.current &&
                !options.signal?.aborted &&
                (newMode === "solo" || modeGeneration.current === generation);

            if (newMode === "multiplayer") {
                const resp = await loadMultiplayer(
                    target.exhibit,
                    target.destination,
                    options
                );
                if (!isCurrent()) return false;
                if (!resp.success) {
                    if (!options.background) setMode("solo");
                    return false;
                }
            }

            if (newMode === "solo") {
                await close();

                await loadSolo();
            }

            if (!isCurrent()) return false;
            if (_onChangeModeCallback.current) {
                _onChangeModeCallback.current(
                    newMode === "solo" ? Mode.SOLO : Mode.MULTIPLAYER
                );
            }

            currentMode.current = newMode;
            setRMode(newMode);

            setMode(newMode);

            return true;
        } catch (err) {
            console.log("Failed to change modes", err);
            return false;
        }
    }

    function refreshVoiceRights(exhibit) {
        if (!(exhibit && voice && room)) return;

        if (room.isMod) return;

        voice.refreshIfMod(!!exhibit.params?.voiceAllowed, {
            label: room.label,
            roomId: room?.id,
        });
    }

    const connection = reportedConnection(admission, room.lost);

    // Close what is left of the old room and join again where the visitor
    // stands. The engine still holds the players of the room that ended.
    async function joinAgain() {
        let joined = false;
        // Said first: closing a room that already dropped can take seconds.
        applyConnection({ type: "rejoin" });
        try {
            await close();
            if (closed.current) return false;
            await Promise.resolve(
                world.current?.setMultiplayer({
                    mode: "solo",
                    preserveCamera: true,
                })
            ).catch(console.error);
            // Joining again is choosing multiplayer: being away left the
            // panel in solo, where an attempt that fails would not be shown.
            _onChangeModeCallback.current?.(Mode.MULTIPLAYER);
            setMode("multiplayer");
            joined = await switchMode(
                "multiplayer",
                { background: true },
                joinedWorld.current || undefined
            );
        } catch (err) {
            console.log("Failed to rejoin", err);
        }
        // An attempt that could not even start leaves nothing to report.
        if (!joined) applyConnection({ type: "cancelled" });
        return joined;
    }

    async function rejoin() {
        if (connectionRecovery(connection) !== "rejoin") return false;
        return joinAgain();
    }

    async function enterPassword(password: string) {
        if (connectionRecovery(connection) !== "password") return "other-error";
        let type = "other-error";
        try {
            // The server decides; the password is not compared here.
            const result = await SocialApi.opts({ encode: true }).checkGating({
                spaceId: room.label,
                nbPlayers: 0,
                password,
            });
            // The proof for the new password is what the room join accepts.
            rememberWorldAccess(room.label, result);
            if (result?.type) type = result.type;
        } catch (err) {
            console.error(err);
        }
        if (type !== "success") return type;
        // Not awaited: the password was accepted, and how the join goes is
        // shown by `connection`.
        void joinAgain();
        return null;
    }

    const value: MultiplayerContextState = {
        room: room,
        voice: voice,
        chat: chat,
        connection,
        rejoin,
        enterPassword,

        switchRoom,
        mode,
        changeMode,
        userId,
        MultiplayerService,
        dispose,
        _onChangeModeCallback,
        _onConnect,
        reconnect,
        onConnect,
        refreshVoiceRights,
    };

    return (
        <MultiplayerContext.Provider value={value}>
            {children}
        </MultiplayerContext.Provider>
    );
}

export const useMultiplayer = () => {
    const context = useContext(MultiplayerContext);

    if (!context) {
        return {} as MultiplayerContextState;
        throw Error(
            "useMultiplayer needs to be called within MultiplayerContext."
        );
    }

    return context;
};

const MAX_TIME_INACTIVITY = 1000 * 60 * 120;

const INTERVAL_CHECK = 1000 * 30;

export const useDisconnectUserIfInactive = ({
    disconnectMultiplayer,
    mode,
    MultiplayerService,
}) => {
    const [isActive, setIsActive] = useState(true);

    const lastTime = useRef(performance.now());

    const interval = useRef(null);

    useEffect(() => {
        if (mode === "solo") return;

        const events = [
            "load",
            "keydown",
            "mousemove",
            "touchmove",
            "touchstart",
            "scroll",
            "click",
        ];

        interval.current = setInterval(() => {
            //
            if (
                MultiplayerService.current?.roomService?.voiceChat?.isVoiceEnabled?.()
            ) {
                lastTime.current = performance.now();
                return;
            }

            let delta = performance.now() - lastTime.current;

            // console.log(
            //     "[useDisconnectUserIfInactive] time inactive",
            //     delta / 1000,
            //     "sec"
            // );

            if (delta > MAX_TIME_INACTIVITY) {
                // console.log(
                //     "[useDisconnectUserIfInactive] too much idle, disconnecting"
                // );

                if (mode !== "solo") {
                    disconnectMultiplayer();
                    setIsActive(false);
                }
            }
        }, INTERVAL_CHECK);

        function resetTimer() {
            // console.log("[useDisconnectUserIfInactive] Woken up, resetting");
            lastTime.current = performance.now();
        }

        events.forEach((event) => {
            window.addEventListener(event, resetTimer);
        });

        return () => {
            //
            lastTime.current = performance.now();

            clearInterval(interval.current);

            events.forEach((event) => {
                window.removeEventListener(event, resetTimer);
            });
        };
    }, [mode]);

    return isActive;
};
