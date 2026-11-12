import { useEventCallback } from "@components/hooks/useEventCallback";

import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";

import { GET_USERS_INFO } from "@components/_3DExhibit-v2/three/factory/multiplayer/constants";

import { amplitude_logAnalyticsEvent } from "@utils/analytics";

import { Failure, Result, Success } from "@utils/js";

import { AgoraVoiceChatProvider } from "@utils/voiceChat/AgoraVoiceChatProvider";

import {
    MutableRefObject,
    useContext,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
} from "react";

import type { MultiplayerService } from "../MultiplayerProvider";

import Events from "@3events";

import { useWorldHandler } from "@components/_3DExhibit-v2/hooks/useWorldHandler";

import { UserStreams } from "@utils/voiceChat/types";

import { showError } from "@components/Dialogs";

import { useStateRef } from "@components/hooks/useStateRef";

import EventListener from "events";

import { getAvatarMetadata } from "@components/_3DExhibit-v2/three/factory/player/vrms";
import { useVrm } from "@components/context/VrmContext";
import {
    AudioType,
    EnabledVoiceState,
    initialVoiceState,
    VoiceRequestEnd,
    VoiceState,
    voiceTransition,
} from "./voiceMachine";

// The mesh fans every speaker's audio out to every listener, so the cost
// scales with concurrently unmuted mics, not granted permissions.
export const MAX_SPEAKERS = 8;

// A request to speak that no moderator answers is withdrawn after this long.
export const VOICE_REQUEST_TIMEOUT_MS = 120_000;

// The visitor's voice state and its legal moves live in voiceMachine.ts.
export type {
    AudioType,
    EnabledVoiceState,
    VoiceRequestEnd,
    VoiceState,
} from "./voiceMachine";

type VoiceUsers = Record<string, EnabledVoiceState>;

type VolumeState = { id: string; username: string; volume: number };

export interface VoiceReturn {
    //

    init: (roomDesc: RoomDesc) => Promise<void>;
    dispose: () => Promise<void>;

    active: boolean;
    loading: boolean;

    audioInputId: string;
    audioOutputId: string;

    voiceState: VoiceState;
    voiceUsers: VoiceUsers;
    hasSpeakingUsers: boolean;
    speakerLimitReached: boolean;

    audioMediaDevices: {
        input: string[];
        output: string[];
    };

    voiceRequests: VoiceRequest[];
    hasNewVoiceRequests: boolean;
    markAllVoiceReqsAsRead: () => void;

    setMicrophoneDevice: (deviceId: string) => Promise<void>;

    setPlaybackDevice: (deviceId: string) => Promise<void>;

    requestVoicePermission: (reason: AudioType) => Promise<void>;
    cancelVoicePermissionRequest: () => Promise<void>;
    toggleMuted: (muted?: boolean) => Promise<void>;
    togglePlaying: (
        playing: boolean,
        opts?: { audioOnly?: boolean; placeholderId?: string }
    ) => Promise<void>;
    updateMediaPlaceholder: (opts: { id: string }) => Promise<void>;
    leaveAsSpeaker: (sessionId: string) => void;
    admin_acceptUserVoicePermissionRequest: (
        sessionId: string
    ) => Promise<Result<boolean>>;
    admin_rejectUserVoicePermissionRequest: (sessionId: string) => void;
    admin_setUserVoice: (
        sessionId: string,
        action: AdminVoiceCommand
    ) => Promise<boolean>;
    refreshIfMod: (
        isMod: boolean,
        room: { roomId: string; label: string }
    ) => Promise<void>;
    roomDesc: RoomDesc;

    voiceService: AgoraVoiceChatProvider;
}

export enum VOICE_REQUESTS {
    REQUEST_VOICE_PERMISSION = "REQUEST_VOICE_PERMISSION",
    CANCEL_VOICE_PERMISSION_REQUEST = "CANCEL_VOICE_PERMISSION_REQUEST",
    ADMIN_ANSWER_VOICE_PERMISSION = "ADMIN_ANSWER_VOICE_PERMISSION",
    ADMIN_SET_USER_VOICE_STATE = "ADMIN_SET_USER_VOICE_STATE",
    VOICE_STATE_CHANGED = "VOICE_STATE_CHANGED",
    SET_VOICE_RANGE = "SET_VOICE_RANGE",
}

export enum AdminVoiceCommand {
    MUTE_MIC = "MUTE_MIC",
    STOP_SHARED_STREAM = "STOP_SHARED_STREAM",
    REVOKE_AUDIO_PERMISSION = "REVOKE_AUDIO_PERMISSION",
}

export interface UseVoiceProps {
    userId: string;
    MultiplayerService: MutableRefObject<MultiplayerService>;
}

export interface RoomDesc {
    id: string;
    sessionId: string;
    spaceId: string;
    label: string;
    isMod: boolean;
    needsHostPermission: boolean;
}

export interface VoiceRequest {
    user: any;
    status: "pending" | "submitting";
    wasRead: boolean;
    reason: AudioType;
}

export interface VoiceRequestAttr {
    sessionId: string;
    reason: AudioType;
}

function toVoiceReqAttr(req: VoiceRequest): VoiceRequestAttr {
    return { sessionId: req.user.sessionId, reason: req.reason };
}

export default function useVoice({
    userId,
    MultiplayerService,
}: UseVoiceProps): VoiceReturn {
    //
    const abortController = useRef(null);

    const world = useWorld();

    const roomDesc = useRef<RoomDesc>(null);

    const [active, setActive] = useState(false);

    const [voiceUsers, setVoiceUsers] = useState<VoiceUsers>({});

    const voiceUsersRef = useStateRef(voiceUsers);

    const [userStreams, setUserStreams] = useState<Record<string, MediaStream>>(
        {}
    );

    const [audioMediaDevices, setAudioMediaDevices] = useState({
        input: [],
        output: [],
    });

    const [audioInputId, setAudioInputId] = useState(null);

    const [audioOutputId, setAudioOutputId] = useState(null);

    const setUserVoiceState = (
        uid: string,
        voiceState: Partial<EnabledVoiceState>
    ) => {
        setVoiceUsers((state) => {
            return {
                ...state,
                [uid]: {
                    ...state[uid],
                    ...voiceState,
                },
            };
        });
    };

    const removeVoiceUser = (uid: string) => {
        setVoiceUsers((state) => {
            const newState = { ...state };
            delete newState[uid];
            return newState;
        });
    };

    const [hasSpeakingUsers, setHasSpeakingUsers] = useState(false);

    // Normally we should rely on memoization + react skipping with setState having same state
    // But we want to avoid calling into react pipeline alltogether during volume change events
    let hasSpeakingRef = useStateRef(hasSpeakingUsers);

    // Disabled, pending or enabled: one state (voiceMachine.ts). The request
    // timer below stays here, with the other side effects.
    const [voiceState, dispatchVoice] = useReducer(
        voiceTransition,
        initialVoiceState
    );

    // handleUserJoin is registered once in init(), so it would otherwise
    // close over the initial voiceState — read our live state through a ref.
    const voiceStateRef = useStateRef(voiceState);

    // Set while this visitor's own request waits for a moderator: the timer
    // that withdraws it. Read synchronously, so an answer that arrives after
    // a cancel is recognised as late even before React re-renders.
    const voiceRequestTimer = useRef<ReturnType<typeof setTimeout>>(null);

    const clearVoiceRequestTimer = () => {
        clearTimeout(voiceRequestTimer.current);

        voiceRequestTimer.current = null;
    };

    useEffect(() => clearVoiceRequestTimer, []);

    const [_voiceRequests, _setVoiceRequests] = useState<VoiceRequest[]>([]);

    const [loading, setLoading] = useState(true);

    const voiceChat = () =>
        MultiplayerService.current?.roomService
            ?.voiceChat as AgoraVoiceChatProvider;

    const init = useEventCallback(async (room: RoomDesc) => {
        //
        abortController.current = new AbortController();

        console.log(
            `%c [ MULTIPLAYER DEBUG - VOICE - INIT ${room.label}  ]`,
            "background: #000000; color: #FDD7B4"
        );

        const handleAbort = () => {
            if (abortController.current.signal.aborted)
                throw new Error(
                    `MULTIPLAYER DEBUG - VOICE - INIT ABORTED ${label}`
                );
        };

        const {
            id: roomId,
            label,
            isMod,
            needsHostPermission,
            sessionId,
        } = room;

        try {
            handleAbort();

            const isPublisher = isMod || !needsHostPermission;

            roomDesc.current = room;

            const _voiceChat = voiceChat();

            handleAbort();

            const Events = _voiceChat.Events;

            _voiceChat.on(Events.USER_JOINED, handleUserJoin);

            _voiceChat.on(Events.USER_LEFT, handleUserLeave);

            _voiceChat.on(Events.USER_PUBLISHED, handleUserPublished);

            _voiceChat.on(Events.USER_UNPUBLISHED, handleUserUnpublished);

            _voiceChat.on(Events.VOLUME_INDICATOR, handleVolumeIndicator);

            handleAbort();

            const colyseusRoom =
                MultiplayerService.current?.roomService?.room;

            if (!colyseusRoom) {
                throw new Error("voice init without a multiplayer room");
            }

            await _voiceChat.join(
                {
                    channelId: roomId,
                    // uid MUST equal the Colyseus sessionId — it's the routing
                    // key for relayed signaling.
                    uid: colyseusRoom.sessionId,
                    spaceSlug: label,
                    tokens: null,
                    isPublisher,
                    room: colyseusRoom,
                },
                abortController.current
            );

            handleAbort();

            try {
                const voiceRequests: VoiceRequestAttr[] =
                    await MultiplayerService.current.getChannelAttribute(
                        "voiceRequests"
                    );

                handleAbort();

                if (voiceRequests) {
                    addVoiceRequests(voiceRequests);
                }
            } catch (err) {
                console.error(err);
            }
            // Only mods can handle request permissions

            handleAbort();

            MultiplayerService.current.onCommand(
                VOICE_REQUESTS.REQUEST_VOICE_PERMISSION,
                admin_handleVoicePermissionRequest
            );

            MultiplayerService.current.onCommand(
                VOICE_REQUESTS.CANCEL_VOICE_PERMISSION_REQUEST,
                handleVoicePermissionCancel
            );

            // Non publishers need a token from an admin

            MultiplayerService.current.onCommand(
                VOICE_REQUESTS.ADMIN_ANSWER_VOICE_PERMISSION,
                handleVoicePermissionAnswer
            );

            MultiplayerService.current.onCommand(
                VOICE_REQUESTS.VOICE_STATE_CHANGED,
                handleRemoteVoiceStateChanged
            );

            // should we prevent admins from muting other admins??
            MultiplayerService.current.onCommand(
                VOICE_REQUESTS.ADMIN_SET_USER_VOICE_STATE,
                handleSetVoiceStateRequest
            );

            MultiplayerService.current.onCommand(
                VOICE_REQUESTS.SET_VOICE_RANGE,
                handleSetVoiceRangeRequest
            );

            handleAbort();

            dispatchVoice({ type: "synced", voice: getVoiceState() });

            handleAbort();

            setActive(true);

            console.log(
                `%c [ MULTIPLAYER DEBUG - VOICE - INIT SUCCESS  ${label} ]`,
                "background: #000000; color: #00FF00"
            );
        } catch (err) {
            console.error(err);
            console.log(
                `%c [ MULTIPLAYER DEBUG - VOICE - INIT ERROR  ${label} ]`,
                "background: #000000; color: #FF0000"
            );
        } finally {
            console.log(
                `%c [ MULTIPLAYER DEBUG - VOICE - INIT END  ${label} ]`,
                "background: #000000; color: #FDD7B4"
            );

            setLoading(false);
        }
    }, []);

    async function handleUserJoin(uid, info) {
        //
        console.log("[Voice Join] User Joined ", uid, info);

        let userVoiceState =
            await MultiplayerService.current.getUserAttribute<EnabledVoiceState>(
                uid,
                "voiceState"
            );

        console.log("[Voice Join] got user state", userVoiceState);

        if (userVoiceState == null) {
            userVoiceState = {
                isPlaying: false,
                isMuted: true,
            };
        }

        setUserVoiceState(uid, userVoiceState);

        // If we're already sharing when this user joins, replay our state
        // straight to them: the attribute sync (read above) and the WebRTC
        // USER_JOINED event race, so a late joiner often misses our
        // videoStreamState and never renders our screen otherwise.
        const myState = voiceStateRef.current;

        if (myState.type === "enabled" && myState.state.isPlaying) {
            MultiplayerService.current.sendPeerCommand(
                VOICE_REQUESTS.VOICE_STATE_CHANGED,
                { voiceState: myState.state },
                uid
            );
        }
    }

    function handleUserLeave(uid, { reason }) {
        //
        console.log("[Voice Join] User left", uid, ", reason: ", reason);

        removeVoiceUser(uid);

        // Remove user attribute
        // MultiplayerService.current?.setUserAttribute(
        //     "voiceState",
        //     null
        // );
    }

    async function handleUserPublished(uid, { channel, mediaType, stream }) {
        //
        console.log("[Voice Join] User published: ", uid, channel, mediaType);

        if (channel === "mic") {
            //
            let walletId =
                await MultiplayerService.current.getUserAttribute<string>(
                    uid,
                    "walletId"
                );

            const payload: any = {
                sessionId: uid,
                type: "create",
            };

            // const user = NOTNYC_getUser({
            //     exhibit: {
            //         info: {
            //             customLink: roomDesc.current.label,
            //         },
            //     },
            //     userData: {
            //         walletId,
            //     },
            // });

            // if (user) {
            //     if (user.vrm) {
            //         // @ts-ignore
            //         var _ = await getAvatarMetadata({
            //             userData: {
            //                 settings: {
            //                     vrm: user.vrm,
            //                 },
            //             },
            //         });
            //     }

            //     payload.username = user.name;
            //     payload.vrm = _?.url;
            //     payload.position = user.position || { x: 0, y: 0, z: 0 };
            //     payload.rotation = user.rotation || { x: 0, y: 0, z: 0 };
            //     payload.visible = true;
            //     payload.animation = 10;
            // }

            world.current.createDummyPlayer(payload);
        } else {
            // A screen-share track only renders once we also know the
            // publisher's videoStreamState (placeholder + coords). A late
            // joiner can receive the track before the voiceState attribute
            // has synced, so fetch it now if we don't have it yet — by the
            // time the track lands, the attribute has almost always arrived.
            if (voiceUsersRef.current[uid]?.videoStreamState == null) {
                const remote =
                    await MultiplayerService.current.getUserAttribute<EnabledVoiceState>(
                        uid,
                        "voiceState"
                    );

                if (remote) {
                    setUserVoiceState(uid, remote);
                }
            }

            setUserStreams((s) => {
                return {
                    ...s,
                    [uid]: stream,
                };
            });
        }
    }

    function handleUserUnpublished(uid, { channel, mediaType }) {
        //
        console.log("[Voice Join] User unpublished: ", uid);

        if (channel === "mic") {
            //
            world.current.createDummyPlayer({
                sessionId: uid,
                type: "delete",
            });
        } else {
            setUserStreams((s) => {
                const newState = { ...s };
                delete newState[uid];
                return newState;
            });
        }
    }

    function handleVolumeIndicator({ channel, volumes }) {
        //
        // const speaking = {};

        // const response = world.current.handleCommand({
        //     type: GET_USERS_INFO,
        // }) as any;

        // Object.keys(volumes).forEach((uid) => {
        //     //
        //     const { isActive, level, inactiveTime } = volumes[uid];

        //     if (inactiveTime < 2000) {
        //         const player = response.players.find((player) => {
        //             return player.sessionId === uid;
        //         });

        //         speaking[uid] = {
        //             id: uid,
        //             username: player?.userData?.username || uid,
        //             volume: level,
        //             inactiveTime,
        //         };
        //     }
        // });

        // setSpeakingUsers(speaking);

        let _hasSpeakingUsers = false;

        for (let uid in volumes) {
            //
            const { inactiveTime } = volumes[uid];

            if (inactiveTime < 2000) {
                _hasSpeakingUsers = true;
                break;
            }
        }

        if (hasSpeakingRef.current !== _hasSpeakingUsers) {
            setHasSpeakingUsers(_hasSpeakingUsers);
        }
    }

    const dispose = useEventCallback(async () => {
        //
        console.log(
            `%c [ MULTIPLAYER DEBUG - VOICE - DISPOSE ${roomDesc?.current?.label} ]`,
            "background: #000000; color: #ffffff"
        );

        if (abortController.current) {
            abortController.current.abort();
        }

        // A request still waiting is withdrawn, so no moderator is left with
        // a card for someone who has gone. Started before anything closes:
        // the withdrawal is sent at once, while the room still carries it.
        if (voiceRequestTimer.current != null)
            void withdrawVoiceRequest("withdrawn");

        clearVoiceRequestTimer();

        MultiplayerService.current.setUserAttribute("voiceState", null);

        const _voiceChat = voiceChat();

        if (!_voiceChat) return;

        const Events = _voiceChat.Events;

        _voiceChat.off(Events.USER_JOINED, handleUserJoin);

        _voiceChat.off(Events.USER_LEFT, handleUserLeave);

        _voiceChat.off(Events.USER_PUBLISHED, handleUserPublished);

        _voiceChat.off(Events.USER_UNPUBLISHED, handleUserUnpublished);

        _voiceChat.off(Events.VOLUME_INDICATOR, handleVolumeIndicator);

        await voiceChat()?.leave();

        roomDesc.current = null;

        MultiplayerService.current.offCommand(
            VOICE_REQUESTS.REQUEST_VOICE_PERMISSION,
            admin_handleVoicePermissionRequest
        );

        MultiplayerService.current.offCommand(
            VOICE_REQUESTS.CANCEL_VOICE_PERMISSION_REQUEST,
            handleVoicePermissionCancel
        );

        MultiplayerService.current.offCommand(
            VOICE_REQUESTS.ADMIN_ANSWER_VOICE_PERMISSION,
            handleVoicePermissionAnswer
        );

        MultiplayerService.current.offCommand(
            VOICE_REQUESTS.ADMIN_SET_USER_VOICE_STATE,
            handleSetVoiceStateRequest
        );

        MultiplayerService.current.offCommand(
            VOICE_REQUESTS.SET_VOICE_RANGE,
            handleSetVoiceRangeRequest
        );

        dispatchVoice({ type: "closed" });

        setVoiceUsers({});

        _setVoiceRequests([]);

        setHasSpeakingUsers(false);

        setActive(false);
    }, []);

    const updateRemoteStream = useEventCallback(
        (uid: string, stream: MediaStream, streamState) => {
            //
            console.log("update remote stream", uid);

            if (stream == null) {
                return;
            }

            // Drive readiness off the actual tracks rather than the
            // publisher's advertised flags: a late joiner may not have the
            // full videoStreamState yet, but the track itself is the source
            // of truth for what's renderable. videoStreamState (placeholder
            // + coords) is still forwarded for placement when we have it.
            const hasVideo = stream.getVideoTracks().length > 0;
            const hasAudio = stream.getAudioTracks().length > 0;

            if (hasVideo || hasAudio) {
                updateSceneStream(uid, streamState ?? {});
            }
        },
        []
    );

    const removeRemoteStream = useEventCallback((uid) => {
        //
        removeStreamFromScene(uid);
    }, []);

    const updateSceneStream = useEventCallback(
        (uid: string, opts?: unknown) => {
            //
            const _voiceChat = voiceChat();

            let stream: MediaStream;

            let isLocal = false;

            if (uid === roomDesc.current.sessionId) {
                stream = _voiceChat.localLoopbackStream;
                isLocal = true;
            } else {
                stream = _voiceChat.loopbackStreams[uid];
            }

            if (stream == null) {
                console.error("Stream not found for user", uid);

                return;
            }

            return world.current?.updateVideoStream({
                type: "UPDATE",
                data: {
                    id: uid,
                    isLocal,
                    stream,
                    opts,
                },
            });
        },
        []
    );

    const removeStreamFromScene = useEventCallback((uid: string) => {
        //
        try {
            world.current?.updateVideoStream({
                type: "REMOVE",
                data: uid,
            });
        } catch (err) {
            console.error(err);
        }
    }, []);

    useWorldHandler(Events.STREAM_COORDS_CHANGED, (data) => {
        dispatchVoice({ type: "stream-moved", details: data });
    });

    async function setMicrophoneDevice(deviceId: string) {
        if (!deviceId) return;

        try {
            const _voiceChat = voiceChat();

            await _voiceChat.setMicrophoneDevice(deviceId);

            setAudioInputId(deviceId);
        } catch (err) {
            showError(err.message || "Unable to change audio input device.");
        }
    }

    async function setPlaybackDevice(deviceId: string) {
        if (!deviceId) return;

        try {
            const _voiceChat = voiceChat();

            await _voiceChat.setPlaybackDevice(deviceId);

            setAudioOutputId(deviceId);
        } catch (err) {
            showError(err.message || "Unable to change audio output device.");
        }
    }

    // This is called when user connects a with new account without reloading
    async function refreshIfMod(isMod) {
        //
        const _voiceChat = voiceChat();

        if (!_voiceChat) return;

        if (isMod) {
            const tokens = await _voiceChat.getToken(
                roomDesc.current.sessionId,
                roomDesc.current.label,
                isMod,
                null
            );

            await _voiceChat.enableVoice(tokens);

            dispatchVoice({ type: "synced", voice: getVoiceState() });
        } else {
            await _voiceChat.disableVoice();

            dispatchVoice({ type: "synced", voice: { type: "disabled" } });
        }
    }

    function getVoiceState(): VoiceState {
        //
        const _voiceChat = voiceChat();

        if (_voiceChat.isVoiceEnabled()) {
            return {
                type: "enabled",
                state: {
                    isPlaying: _voiceChat.isPlaying(),
                    isMuted: _voiceChat.isMuted(),
                },
            };
        } else {
            return { type: "disabled" };
        }
    }

    /**
     * Workflow for audience profile
     *
     *  1- First send a voice permission request -> requestVoicePermission
     *  2- An admin either
     *      a- approves the request : -> obtains a token + send permissionRequestApproved
     *      b- rejects the request  : -> send permissionRequestRejected
     *  3- the user handles the request
     *
     */

    // When a user send a voice persmission request
    const admin_handleVoicePermissionRequest = useEventCallback(
        (request, _) => {
            //
            addVoiceRequests([request]);
        },
        []
    );

    // Enable voice once a token is received from an admin
    const handleVoicePermissionAnswer = useEventCallback(
        async ({ tokens, sessionId: _id }) => {
            //
            try {
                if (roomDesc.current.sessionId === _id) {
                    // An approval only counts while the request still waits:
                    // a moderator answering one that was cancelled or expired
                    // must not turn this visitor's voice on.
                    const waiting = voiceRequestTimer.current != null;

                    clearVoiceRequestTimer();

                    // token != null means the request was approved
                    if (tokens != null) {
                        if (waiting) {
                            await voiceChat().enableVoice(tokens);
                            dispatchVoice({
                                type: "synced",
                                voice: getVoiceState(),
                            });
                        }
                    } else {
                        // request was rejected
                        dispatchVoice({ type: "rejected" });
                    }
                }
                removeVoiceRequest(_id);
            } catch (err) {
                console.error(err);
            }
        },
        []
    );

    // When an admin "mutes" another user
    const handleSetVoiceStateRequest = useEventCallback(async (data) => {
        //
        console.log("handleSetVoiceStateRequest", data);

        const _voiceChat = voiceChat();

        const command = data.action as AdminVoiceCommand;
        const _id = data.sessionId;

        try {
            // disable if the receiver matches the disable user
            if (roomDesc.current.sessionId === _id) {
                //

                if (command === AdminVoiceCommand.REVOKE_AUDIO_PERMISSION) {
                    if (voiceState.type !== "disabled") {
                        await _voiceChat.disableVoice();
                    }
                } else if (command === AdminVoiceCommand.MUTE_MIC) {
                    if (
                        voiceState.type === "enabled" &&
                        !voiceState.state.isMuted
                    ) {
                        await _voiceChat.setMuted(true);
                    }
                } else if (command === AdminVoiceCommand.STOP_SHARED_STREAM) {
                    if (
                        voiceState.type === "enabled" &&
                        voiceState.state.isPlaying
                    ) {
                        togglePlaying(false);
                        return;
                    }
                }

                dispatchVoice({ type: "synced", voice: getVoiceState() });
            }

            // Should be taken care by voice chat events
            // world.current.handleCommand({
            //     type: DISABLE_VOICE,
            //     payload: {
            //         sessionId,
            //     },
            // });
            //
        } catch (err) {
            console.error(err);
        }
    }, []);

    const handleRemoteVoiceStateChanged = useEventCallback(
        (data, sessionId) => {
            //
            console.log("remote stream", data);
            const userVoiceState = data.voiceState as EnabledVoiceState;

            setUserVoiceState(sessionId, userVoiceState);
        },
        []
    );

    const handleSetVoiceRangeRequest = useEventCallback(({ range }) => {
        // world.current.handleCommand({
        //     type: SET_VOICE_RANGE,
        //     payload: {
        //         range: range,
        //     },
        // });
    }, []);

    const requestVoicePermission = useEventCallback(
        async (reason: AudioType) => {
            if (voiceState.type === "pending") return;

            //
            try {
                const request: VoiceRequestAttr = {
                    sessionId: roomDesc.current.sessionId,
                    reason,
                };

                await MultiplayerService.current.sendCommand(
                    VOICE_REQUESTS.REQUEST_VOICE_PERMISSION,
                    request
                );

                addVoiceRequests([request]);

                MultiplayerService.current.setChannelAttribute(
                    "voiceRequests",
                    _voiceRequests.map(toVoiceReqAttr).concat(request)
                );

                dispatchVoice({ type: "requested", reason });

                clearVoiceRequestTimer();

                voiceRequestTimer.current = setTimeout(
                    () => void withdrawVoiceRequest("expired"),
                    VOICE_REQUEST_TIMEOUT_MS
                );
            } catch (err) {
                console.error(err);
            }
        },
        []
    );

    // The visitor withdraws their own request, or it expired unanswered
    const withdrawVoiceRequest = useEventCallback(
        async (end: VoiceRequestEnd) => {
            const waiting = voiceRequestTimer.current != null;

            clearVoiceRequestTimer();

            // Even with nothing left to withdraw, the button never stays
            // pending. How it ended is kept, so nobody is told "denied".
            dispatchVoice({ type: "request-ended", end });

            const sessionId = roomDesc.current?.sessionId;

            if (!waiting || sessionId == null) return;

            try {
                // Same removal as a moderator's answer: every client drops
                // the request, then the shared list stops carrying it. Both
                // are sent before either is awaited, so leaving voice cannot
                // close the room between them.
                const withdrawn = MultiplayerService.current.sendCommand(
                    VOICE_REQUESTS.CANCEL_VOICE_PERMISSION_REQUEST,
                    { sessionId }
                );

                removeVoiceRequest(sessionId);

                const listed = MultiplayerService.current.setChannelAttribute(
                    "voiceRequests",
                    _voiceRequests
                        .filter((it) => it.user.sessionId !== sessionId)
                        .map(toVoiceReqAttr)
                );

                await Promise.all([withdrawn, listed]);
            } catch (err) {
                console.error(err);
            }
        },
        []
    );

    const cancelVoicePermissionRequest = useEventCallback(
        () => withdrawVoiceRequest("withdrawn"),
        []
    );

    // When a user withdraws their voice permission request
    const handleVoicePermissionCancel = useEventCallback(({ sessionId }) => {
        //
        removeVoiceRequest(sessionId);
    }, []);

    const unmutedCount = (users: VoiceUsers) => {
        //
        return Object.values(users).filter((u) => u?.isMuted === false)
            .length;
    };

    const toggleMuted = useEventCallback(async (b?: boolean) => {
        //
        if (voiceState.type !== "enabled") return;

        b = b ?? !voiceState.state.isMuted;

        if (
            b === false &&
            voiceState.state.isMuted &&
            unmutedCount(voiceUsersRef.current) >= MAX_SPEAKERS
        ) {
            showError(
                `Speaker limit reached — up to ${MAX_SPEAKERS} people can talk at once.`
            );
            return;
        }

        try {
            await voiceChat().setMuted(b);

            dispatchVoice({ type: "mute-changed", voice: getVoiceState() });
        } catch (err) {
            console.error("[ChatProvider.setMuted] " + b, err);
            // pushMessage("Unexpected error!!", CHAT_TYPES.ALERT.label);
        }
    }, []);

    const updateMediaPlaceholder = useEventCallback(
        async (opts: { id: string }) => {
            //
            if (
                voiceState.type !== "enabled" ||
                !voiceState.state.isPlaying ||
                !voiceState.state.videoStreamState?.hasVideo
            )
                return;

            //
            const placeholderId =
                voiceState.state.videoStreamState.placeholderId;

            if (opts?.id == placeholderId) return;
            //
            const data = await updateSceneStream(roomDesc.current.sessionId, {
                placeholderId: opts.id,
            });

            dispatchVoice({ type: "stream-moved", details: data });

            amplitude_logAnalyticsEvent(
                "audio_sharing_change-placeholder",
                roomDesc.current
            );
        },
        []
    );

    const togglePlaying = useEventCallback(
        async (
            b: boolean,
            opts?: { audioOnly?: boolean; placeholderId?: string }
        ) => {
            //
            const _voiceChat = voiceChat();

            if (voiceState.type !== "enabled") return;

            b = b ?? !voiceState.state.isPlaying;

            try {
                //
                if (b) {
                    amplitude_logAnalyticsEvent(
                        "audio_sharing_trigger",
                        roomDesc.current
                    );
                }

                await _voiceChat.setPlaying(b, opts?.audioOnly);

                if (b) {
                    //
                    const uid = roomDesc.current.sessionId;

                    // Add to local 3D scene and get position/rotation
                    const data = opts?.audioOnly
                        ? {}
                        : ((await updateSceneStream(uid, opts)) as any);

                    _voiceChat.once(_voiceChat.Events.SHARING_STOPPED, () => {
                        // console.log("loopback stopped");
                        _removeLocalStream();
                    });

                    let voiceState = getVoiceState();

                    if (voiceState.type === "enabled") {
                        voiceState = {
                            ...voiceState,
                            state: {
                                ...voiceState.state,
                                videoStreamState: {
                                    ...data,
                                    hasAudio:
                                        _voiceChat.localLoopbackStream?.getAudioTracks()
                                            .length > 0,
                                    hasVideo:
                                        _voiceChat.localLoopbackStream?.getVideoTracks()
                                            .length > 0,
                                },
                            },
                        };
                    }

                    dispatchVoice({ type: "synced", voice: voiceState });

                    amplitude_logAnalyticsEvent(
                        "audio_sharing_started",
                        roomDesc.current
                    );
                } else {
                    //
                    _removeLocalStream();
                }
            } catch (err) {
                //
                console.error(err);

                if (err.name === "NotAllowedError") return;

                amplitude_logAnalyticsEvent(
                    "audio_sharing_failed",
                    roomDesc.current
                );

                showError(err.message || "Failed to share audio");
            }
        },
        []
    );

    const _removeLocalStream = useEventCallback(() => {
        //
        if (voiceState.type !== "enabled") return;

        const uid = roomDesc.current.sessionId;

        if (voiceState.state.videoStreamState?.hasVideo) {
            //
            removeStreamFromScene(uid);
        }

        let _voiceState = getVoiceState();

        if (_voiceState.type === "enabled") {
            _voiceState = {
                ..._voiceState,
                state: {
                    ..._voiceState.state,
                    videoStreamState: null,
                },
            };
        }

        amplitude_logAnalyticsEvent("audio_sharing_stopped", roomDesc.current);

        dispatchVoice({ type: "synced", voice: _voiceState });
        //
    }, []);

    const admin_acceptUserVoicePermissionRequest = useEventCallback(
        async (sessionId: string) => {
            try {
                _setVoiceRequests((requests) => {
                    return requests.map((req) => {
                        return req.user.sessionId !== sessionId
                            ? req
                            : {
                                  ...req,
                                  status: "submitting",
                              };
                    });
                });

                const tokens = await voiceChat().getToken(
                    sessionId,
                    roomDesc.current.label,
                    true,
                    null
                );

                await MultiplayerService.current.sendCommand(
                    VOICE_REQUESTS.ADMIN_ANSWER_VOICE_PERMISSION,
                    { sessionId, tokens }
                );

                removeVoiceRequest(sessionId);

                MultiplayerService.current.setChannelAttribute(
                    "voiceRequests",

                    _voiceRequests
                        .filter((it) => it.user.sessionId !== sessionId)
                        .map(toVoiceReqAttr)
                );

                return Success(true);
            } catch (err) {
                console.error(err);
                _setVoiceRequests((requests) => {
                    return requests.map((req) => {
                        return req.user.sessionId !== sessionId
                            ? req
                            : {
                                  ...req,
                                  status: "pending",
                              };
                    });
                });
                return Failure(err.message);
            }
        },
        []
    );

    const admin_rejectUserVoicePermissionRequest = useEventCallback(
        async (sessionId: string) => {
            //
            MultiplayerService.current.sendCommand(
                VOICE_REQUESTS.ADMIN_ANSWER_VOICE_PERMISSION,
                { sessionId, tokens: null }
            );

            removeVoiceRequest(sessionId);

            MultiplayerService.current.setChannelAttribute(
                "voiceRequests",
                _voiceRequests
                    .filter((it) => it.user.sessionId !== sessionId)
                    .map(toVoiceReqAttr)
            );
        },
        []
    );

    const admin_setUserVoice = useEventCallback(
        async (sessionId: string, action: AdminVoiceCommand) => {
            //
            try {
                const received =
                    await MultiplayerService.current.sendPeerCommand(
                        VOICE_REQUESTS.ADMIN_SET_USER_VOICE_STATE,
                        { sessionId, action },
                        sessionId
                    );

                return received;
            } catch (err) {
                console.error(err);
            }
        },
        []
    );

    const leaveAsSpeaker = useEventCallback(async (sessionId: string) => {
        try {
            //
            const _voiceChat = voiceChat();
            if (
                roomDesc.current.sessionId === sessionId &&
                voiceState.type !== "disabled"
            ) {
                //
                await _voiceChat.disableVoice();

                dispatchVoice({
                    type: "left-as-speaker",
                    voice: getVoiceState(),
                });
            }
        } catch (err) {
            console.error(err);
        }
    }, []);

    const addVoiceRequests = (requests: Array<VoiceRequestAttr>) => {
        //
        if (world.current == null) return;

        const response = world.current.handleCommand({
            type: GET_USERS_INFO,
        }) as any;

        let newRequests: VoiceRequest[] = [];

        if (response?.success) {
            response.players.forEach((user) => {
                if (
                    _voiceRequests.some(
                        (it) => it.user.sessionId === user.sessionId
                    )
                ) {
                    return;
                }

                const request = requests.find(
                    (req) => req.sessionId === user.sessionId
                );

                if (request) {
                    newRequests.push({
                        user,
                        status: "pending",
                        wasRead: false,
                        reason: request?.reason,
                    });
                }
            });
        }

        _setVoiceRequests((state) => {
            return state.concat(newRequests);
        });
    };

    const removeVoiceRequest = (_sessionId: string) => {
        //
        if (world.current == null) return;

        _setVoiceRequests((state) => {
            return state.filter((it) => it.user.sessionId !== _sessionId);
        });
    };

    const hasNewVoiceRequests = useMemo(() => {
        if (!roomDesc.current?.isMod) return false;
        return _voiceRequests.some((it) => !it.wasRead);
    }, [_voiceRequests, roomDesc.current]);

    const markAllVoiceReqsAsRead = useEventCallback(() => {
        _setVoiceRequests((reqs) => {
            return reqs.map((it) => {
                if (it.wasRead) return it;

                return {
                    ...it,
                    wasRead: true,
                };
            });
        });
    }, []);

    const mediaDevices = useEventCallback(async () => {
        const devices = await navigator.mediaDevices.enumerateDevices();

        const input = [];
        const output = [];

        for (let i = 0; i < devices.length; i++) {
            const device = devices[i];

            if (device.deviceId && device.kind && device.label) {
                //
                const { deviceId } = device;
                if (device.kind === "audioinput") {
                    if (deviceId === "default") setAudioInputId(deviceId);
                    input.push(device);
                } else if (device.kind === "audiooutput") {
                    if (deviceId === "default") setAudioOutputId(deviceId);
                    output.push(device);
                }
            }
        }

        setAudioMediaDevices({
            input,
            output,
        });
    }, []);

    // Sync voiceState accross all users
    const deps: any[] = [null, null, null, active];
    if (voiceState.type === "enabled") {
        deps[0] = voiceState.state.isMuted;
        deps[1] = voiceState.state.isPlaying;

        if (voiceState.state.videoStreamState != null) {
            deps[2] = voiceState.state.videoStreamState;
        }
    }

    useEffect(() => {
        if (navigator.mediaDevices?.ondevicechange !== undefined) {
            navigator.mediaDevices.ondevicechange = (event) => {
                mediaDevices().catch(console.error);
            };
        } else {
            console.error(
                "navigator.mediaDevices.ondevicechange is not defined"
            );
        }
    }, []);

    const wasEnabledRef = useRef(false);

    useEffect(() => {
        if (!active) return;

        if (voiceState.type !== "enabled") {
            // Revoke/leaveAsSpeaker/refresh used to broadcast nothing, so
            // remote clients kept counting this user as an active speaker.
            // Concrete muted payload (never null): old clients merge it
            // into a sane "muted" display.
            if (wasEnabledRef.current) {
                wasEnabledRef.current = false;

                MultiplayerService.current?.sendCommand(
                    VOICE_REQUESTS.VOICE_STATE_CHANGED,
                    { voiceState: { isMuted: true, isPlaying: false } }
                );

                MultiplayerService.current?.setUserAttribute(
                    "voiceState",
                    null
                );
            }

            return;
        }

        wasEnabledRef.current = true;

        MultiplayerService.current?.sendCommand(
            VOICE_REQUESTS.VOICE_STATE_CHANGED,
            { voiceState: voiceState.state }
        );

        MultiplayerService.current?.setUserAttribute(
            "voiceState",
            voiceState.state
        );

        MultiplayerService.current?.setUserAttribute("walletId", userId);
        //
    }, deps);

    useEffect(() => {
        mediaDevices().catch(console.error);
    }, []);

    const activeStreams = useRef({});
    // Sync remote streams with 3D scene
    useEffect(() => {
        //
        const oldKeys = Object.keys(activeStreams.current);
        const newKeys = Object.keys(userStreams);

        oldKeys.forEach((it) => {
            if (userStreams[it] == null) {
                removeRemoteStream(it);
            }
        });

        newKeys.forEach((it) => {
            const voiceUser = voiceUsers[it];

            if (voiceUser) {
                updateRemoteStream(
                    it,
                    userStreams[it],
                    voiceUser.videoStreamState
                );
            }
        });

        activeStreams.current = userStreams;
        //
    }, [voiceUsers, userStreams]);

    const placeholderId =
        voiceState.type === "enabled"
            ? voiceState.state.videoStreamState?.placeholderId
            : null;

    useEffect(() => {
        //
        if (placeholderId == null || world.current == null) return;

        const placeholder = world.current.getComponentById(placeholderId);

        if (placeholder == null) return;

        const handler = () => {
            //
            updateMediaPlaceholder({ id: null });
        };

        placeholder.once(placeholder.EVENTS.DISPOSED, handler);

        return () => {
            //
            placeholder.off(placeholder.EVENTS.DISPOSED, handler);
        };
        //
    }, [placeholderId, world.current]);

    if (process.env.NODE_ENV === "development") {
        useEffect(() => {
            //
            console.log("voiceState", voiceState);
        }, [voiceState]);
    }

    return {
        init,
        dispose,

        loading,
        active,

        voiceUsers,
        hasSpeakingUsers,
        voiceState,

        speakerLimitReached:
            unmutedCount(voiceUsers) +
                (voiceState.type === "enabled" && !voiceState.state.isMuted
                    ? 1
                    : 0) >=
            MAX_SPEAKERS,

        audioInputId,
        audioOutputId,

        audioMediaDevices,

        requestVoicePermission,
        cancelVoicePermissionRequest,
        toggleMuted,
        togglePlaying,
        updateMediaPlaceholder,

        voiceRequests: roomDesc.current?.isMod ? _voiceRequests : [],
        hasNewVoiceRequests,
        markAllVoiceReqsAsRead,

        admin_acceptUserVoicePermissionRequest,
        admin_rejectUserVoicePermissionRequest,
        admin_setUserVoice,

        leaveAsSpeaker,

        setMicrophoneDevice,

        setPlaybackDevice,

        refreshIfMod,

        roomDesc: roomDesc.current,

        voiceService: voiceChat(),
    };
}
