import {
    readLobbyFlash,
    LobbyFlash,
} from "../../../multiplayer/protocol/lobby-flash.js";
import { readGroupLocation } from "../../../multiplayer/protocol/group-location";
import type {
    LobbyGroup,
    LobbyGroupInvitation,
    LobbyGroupMessage,
    LobbyGroupAction,
    LobbyGroupResult,
    LobbyGroupPosition,
    LobbyGroupLocation,
} from "../../../multiplayer/protocol/lobby-groups";
import {
    readLobbyGroups,
    readLobbyGroupPosition,
} from "./lobbyGroupValidation";
import { LobbyInputPrediction } from "./LobbyInputPrediction";
import type { MovementInput } from "../../../multiplayer/protocol/movement";
import { LOBBY_GUEST_PORTRAIT } from "./lobbyIdentity";
import { Client, Room } from "colyseus.js";
import { ARENA_HTTP_URL, ARENA_WS_URL } from "@utils/arena/constants";
import { selectLobbyEndpoint, invalidateLobbyEndpoint } from "./lobbyEndpoints";
import { LobbyMotionStore } from "./LobbyMotionStore";
import { PatchClock } from "./patchClock";
import { WorldLobbyTransport, WorldLobbyTicket } from "./WorldLobbyTransport";
import { LobbyPrediction } from "./LobbyPrediction";
import {
    LobbyVoiceSignaling,
    LOBBY_SIGNAL_LIMIT,
    legacyVoicePeers,
} from "./LobbyVoiceSignaling";
import ColyseusChatProvider from "@utils/chat/ColyseusChatProvider";
import type { WebRTCClient } from "@utils/voiceChat/WebRTCClient";

// A dedicated CyberRoom: matchmaking, presence, chat and voice all share it.
export const LOBBY_ROOM = "oncyber-lobby-v1";
/** Deployment-owned native rooms; never accept a room key from an iframe. */
export const NATIVE_SOCIAL_ROOMS: Readonly<Record<string, string>> = {};
export type NativeSocialSpace = string;
const GUEST_AVATAR = LOBBY_GUEST_PORTRAIT;
const MAX_MESSAGES = 60;
// Matches the native player packet height; the renderer owns avatar assets.
const USER_HEIGHT = 2.8;
const STABLE_MS = 30000;
/** Automatic reconnection gives up after this many consecutive failures. */
const MAX_RETRIES = 8;
const LOBBY_LOST = "Connection lost. Reconnecting to everyone…";
const LOBBY_REPLACED =
    "You joined the lobby somewhere else. Reconnect to play here.";
const LOBBY_SOLO = "You’re exploring solo. Reconnect to join everyone.";
/** Shown after the lobby removes someone: they are not invited to reconnect. */
const LOBBY_REMOVED = "You’re exploring solo.";
/** Where one connection attempt has got to; reported in network diagnostics. */
type LobbyConnectionPhase =
    | "idle"
    | "selecting-region"
    | "requesting-ticket"
    | "opening-transport"
    | "binding-social"
    | "awaiting-welcome"
    | "connected";
/**
 * Why this connection will not reconnect by itself: the same account took the
 * seat from another tab or device, or the lobby removed this visitor.
 */
export type LobbyStopReason = "replaced" | "removed";

// Native packets carry an EMOTES index, not a locomotion animation index.
// Walking/running is inferred by the avatar renderer from position and floor.
export const LOBBY_EMOTE = { NONE: -1, WAVING: 0 } as const;

export type LobbyAvatar = { vrmUrl: string; scale?: number };

export type LobbyIdentity = {
    userId?: string;
    username?: string;
    avatar?: string;
    token?: string;
    vrmUrl?: string;
    scale?: number;
};
export type LobbyPose = {
    x: number;
    y: number;
    z: number;
    rotation: number;
    moving?: boolean;
    /** Presentation-only confirmation for delayed resting-idle selection. */
    restConfirmed?: boolean;
    /** Native EMOTES index; -1 while idle, walking, running or jumping. */
    animation?: number;
    floor?: boolean;
    speed?: number;
    vx?: number;
    vy?: number;
    vz?: number;
};
export type LobbyPlayer = LobbyPose & {
    id: string;
    /** Verified lobby-scoped pseudonym from the v1/v2 server; never a canonical account ID. */
    partyIdentity?: string;
    flash?: LobbyFlash | null;
    /** Lobby moderator badge, set by the server from a verified identity. */
    role?: LobbyRole;
    name: string;
    avatar: string;
    isLocal: boolean;
    vrmUrl: string;
    scale: number;
    animation: number;
    floor: boolean;
};
export type LobbyMessage = {
    id: string;
    sessionId: string;
    name: string;
    text: string;
    sentAt: number;
    /** Present only for a DM; the sender and this recipient own the thread. */
    recipientId?: string;
    /** Sender portrait kept with the message after they leave the visible roster. */
    avatar?: string;
};
export type LobbyRole = "owner" | "admin";
export type LobbyStagePerson = {
    sessionId: string;
    name: string;
    avatar: string;
    role?: LobbyRole;
};
/** Lobby-wide voice: admins add up to `limit` speakers whom everyone nearby hears. */
export type LobbyStage = {
    speakers: LobbyStagePerson[];
    limit: number;
    role: LobbyRole | null;
    muted: boolean;
    requested: boolean;
    requests: LobbyStagePerson[];
    /** Admins only: people muted by an admin. */
    mutedPeople: string[];
    /**
     * Only approved speakers talk, and only people near them hear them.
     * Without it (the older lobby), everyone talks nearby and speakers
     * reach the whole room.
     */
    spatial: boolean;
};
export type LobbyAdminAction =
    | "stage-add"
    | "stage-remove"
    | "mute"
    | "unmute"
    | "kick"
    | "decline-request"
    | "grant-admin"
    | "revoke-admin";
export type LobbyVoiceState = "off" | "connecting" | "muted" | "live";
export type LobbySnapshot = {
    status: "connecting" | "connected" | "offline";
    /** Set once reconnection has ended for good; the UI words it accordingly. */
    stopped: LobbyStopReason | null;
    error: string;
    sessionId: string;
    players: LobbyPlayer[];
    messages: LobbyMessage[];
    voiceState: LobbyVoiceState;
    voiceError: string;
    /** Absent on servers without lobby voice moderation. */
    stage: LobbyStage | null;
    population?: number;
    groups: LobbyGroup[];
    invitations: LobbyGroupInvitation[];
    groupMessages: LobbyGroupMessage[];
    groupsSupported: boolean;
    /** Older deployments and legacy CyberRoom keep Flash local. */
    flashSupported: boolean;
    groupClock: { serverNow: number; receivedAt: number } | null;
    groupPosition: LobbyGroupPosition | null;
    groupError: string;
    lobbyPresent: boolean;
    protocol?: "legacy" | "v1" | "v2";
    region?: string;
    roomId?: string;
};

export const initialLobbySnapshot = (): LobbySnapshot => ({
    status: "connecting",
    stopped: null,
    error: "",
    sessionId: "",
    players: [],
    messages: [],
    voiceState: "off",
    voiceError: "",
    stage: null,
    groups: [],
    invitations: [],
    groupMessages: [],
    groupsSupported: false,
    flashSupported: false,
    groupClock: null,
    groupPosition: null,
    groupError: "",
    lobbyPresent: true,
});

const readName = (value: unknown) => {
    if (typeof value !== "string") return "Guest";
    try {
        return decodeURIComponent(value).slice(0, 40) || "Guest";
    } catch {
        return value.slice(0, 40) || "Guest";
    }
};
const finite = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;
const avatarScale = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) && value > 0
        ? Math.min(3, Math.max(0.25, value))
        : 1;
const animationCode = (value: unknown) =>
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= -1 &&
    value <= 127
        ? value
        : LOBBY_EMOTE.NONE;
const avatarUrl = (value: unknown) => {
    if (typeof value !== "string" || value.length > 2048) return "";
    if (
        value.startsWith("/") &&
        !value.startsWith("//") &&
        !value.includes("\\")
    )
        return value;
    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:"
            ? url.href
            : "";
    } catch {
        return "";
    }
};

/** Owns the room and its retry lifecycle; motion lives outside React. */
export class LobbyConnection {
    private inputPrediction = new LobbyInputPrediction();
    private inputMode = false;
    snapshot = initialLobbySnapshot();
    private controller = new AbortController();
    private room: Room<any> | null = null;
    private world: WorldLobbyTransport | null = null;
    private chat: ColyseusChatProvider | null = null;
    private voice: WebRTCClient | null = null;
    private signaling: LobbyVoiceSignaling | null = null;
    private microphone: MediaStream | null = null;
    private audio = new Map<string, HTMLAudioElement>();
    private unbinds: Array<() => void> = [];
    private lifecycleUnbinds: Array<() => void> = [];
    private closed = false;
    private closePromise: Promise<void> | null = null;
    private generation = 0;
    private connecting = false;
    private retryCount = 0;
    private stopped: LobbyStopReason | null = null;
    /**
     * The ticket of the last world seat this connection held. A reconnect
     * names it, so the server frees that seat first and treats the visitor as
     * the same person: a party trip keeps their place for a few seconds.
     */
    private lastWorldToken: string | null = null;
    private connectedAt = 0;
    private retryTimer: ReturnType<typeof setTimeout> | null = null;
    private messageSequence = 0;
    private moveTimer: ReturnType<typeof setTimeout> | null = null;
    private pingTimer: ReturnType<typeof setInterval> | null = null;
    private pings = new Map<number, number>();
    private pingSequence = 0;
    private lastMove = 0;
    private lastMessage = 0;
    private lobbyPresent = true;
    private desiredFlash: LobbyFlash | null = null;
    private sentFlash: string | null = null;
    private flashOrigin: { x: number; y: number; z: number } | null = null;
    private groupLocation: LobbyGroupLocation = { state: "lobby" };
    private groupRepositionPending = false;
    private groupRequests = new Map<
        string,
        {
            resolve: (result: LobbyGroupResult) => void;
            reject: (error: Error) => void;
            timer: ReturnType<typeof setTimeout>;
        }
    >();
    private protocol: "legacy" | "v1" | "v2" = "legacy";
    private worldEpoch: number | null = null;
    private connectionPhase: LobbyConnectionPhase = "idle";
    private welcomed = false;
    private region = "default";
    private roomId = "";
    private turnBaseUrl: string;
    private snapshotRates = { near: 20, mid: 10, far: 5 };
    private snapshotBands = [32, 64, 128];
    private networkAoiLimit = 128;
    private players = new Map<string, LobbyPlayer>();
    private motion = new LobbyMotionStore();
    private prediction = new LobbyPrediction();
    private legacyTick = 0;
    /** Legacy schema patches carry no time; snap their arrivals to the room's tick grid. */
    private legacyClock = new PatchClock();
    private legacyQuietTimer: ReturnType<typeof setTimeout> | null = null;
    private legacyMoveKey = "";
    private population = 0;
    private voicePeers: string[] = [];
    /** Peers we hear but never send our mic to (stage speakers, or everyone while muted). */
    private listenOnly = new Set<string>();
    /** Peers we send to but never play (our stage listeners). */
    private speakOnly = new Set<string>();
    private stageSpeakers = new Set<string>();
    private adminRequests = new Map<
        string,
        {
            resolve: (error: string) => void;
            timer: ReturnType<typeof setTimeout>;
        }
    >();
    private lastVoiceSelection = 0;
    private get pose() {
        return this.prediction.pose;
    }

    constructor(
        private identity: LobbyIdentity,
        private onChange: (snapshot: LobbySnapshot) => void,
        private options: {
            endpointConfig?: string;
            nativeSpace?: NativeSocialSpace;
        } = {}
    ) {
        if (
            options.nativeSpace !== undefined &&
            !Object.prototype.hasOwnProperty.call(
                NATIVE_SOCIAL_ROOMS,
                options.nativeSpace
            )
        )
            throw new Error("Unsupported native social space.");
        this.identity = {
            ...identity,
            vrmUrl: avatarUrl(identity.vrmUrl),
            scale: avatarScale(identity.scale),
        };
        if (typeof window !== "undefined") {
            window.addEventListener("online", this.resume);
            window.addEventListener("offline", this.pauseRetries);
            document.addEventListener(
                "visibilitychange",
                this.visibilityChanged
            );
            this.lifecycleUnbinds.push(() => {
                window.removeEventListener("online", this.resume);
                window.removeEventListener("offline", this.pauseRetries);
                document.removeEventListener(
                    "visibilitychange",
                    this.visibilityChanged
                );
            });
        }
    }
    private get roomKey() {
        return this.options.nativeSpace
            ? NATIVE_SOCIAL_ROOMS[this.options.nativeSpace]
            : LOBBY_ROOM;
    }
    private update(patch: Partial<LobbySnapshot>) {
        if (this.closed) return;
        this.snapshot = { ...this.snapshot, ...patch };
        this.onChange(this.snapshot);
    }
    private available() {
        return (
            typeof navigator === "undefined" ||
            (navigator.onLine !== false && !document.hidden)
        );
    }
    private pauseRetries = () => {
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.retryTimer = null;
    };
    private resume = () => {
        if (this.snapshot.status === "offline") this.scheduleRetry();
    };
    private visibilityChanged = () => {
        if (document.hidden) this.pauseRetries();
        else this.resume();
    };
    private scheduleRetry() {
        if (this.closed) return;
        if (this.stopped || this.retryCount >= MAX_RETRIES) {
            // Each way of stopping keeps its own explanation.
            const error =
                this.stopped === "replaced"
                    ? LOBBY_REPLACED
                    : this.stopped === "removed"
                    ? LOBBY_REMOVED
                    : LOBBY_SOLO;
            if (this.snapshot.error !== error) this.update({ error });
            return;
        }
        if (this.connecting || this.retryTimer || !this.available()) return;
        const delay =
            Math.min(30000, 500 * 2 ** this.retryCount) *
            (0.8 + Math.random() * 0.4);
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            if (this.closed || !this.available()) return;
            this.retryCount++;
            this.update({ status: "connecting", error: "" });
            void this.connect();
        }, delay);
    }

    async connect() {
        if (this.closed || this.connecting || this.room) return;
        if (!this.available()) {
            this.update({ status: "offline" });
            return;
        }
        this.connecting = true;
        const generation = ++this.generation;
        const controller = new AbortController();
        this.controller = controller;
        const current = () =>
            !this.closed &&
            this.generation === generation &&
            !controller.signal.aborted;
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
            this.connectionPhase = "selecting-region";
            const endpoint = this.options.nativeSpace
                ? {
                      id: "native",
                      httpUrl: ARENA_HTTP_URL,
                      wsUrl: ARENA_WS_URL,
                      protocol: undefined,
                  }
                : await selectLobbyEndpoint(
                      controller.signal,
                      this.options.endpointConfig
                  );
            this.region = endpoint.id;
            this.turnBaseUrl = endpoint.httpUrl;
            const requestJoin = async (replaceToken?: string) => {
                // Renew only at actual admission; never retain this account-bound proof in rosters.
                let lobbyIdentityToken: string | undefined;
                if (this.identity.token && endpoint.protocol) {
                    const proofController = new AbortController();
                    const cancelProof = () => proofController.abort();
                    controller.signal.addEventListener("abort", cancelProof, {
                        once: true,
                    });
                    const proofTimeout = setTimeout(cancelProof, 2000);
                    try {
                        const proof = await fetch(
                            "/api/social/lobby-identity",
                            {
                                method: "POST",
                                credentials: "same-origin",
                                signal: proofController.signal,
                                headers: {
                                    "content-type": "application/json",
                                    authorization: `Bearer ${this.identity.token}`,
                                },
                                body: "{}",
                            }
                        );
                        const value = proof.ok ? await proof.json() : null;
                        if (
                            typeof value?.token === "string" &&
                            value.token.length <= 2048
                        )
                            lobbyIdentityToken = value.token;
                    } catch {
                        /* Guest presentation remains available; party identity stays unknown. */
                    } finally {
                        clearTimeout(proofTimeout);
                        controller.signal.removeEventListener(
                            "abort",
                            cancelProof
                        );
                    }
                }
                const response = await fetch(`${endpoint.httpUrl}/join`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    signal: controller.signal,
                    body: JSON.stringify({
                        lobbyProtocol: this.options.nativeSpace
                            ? undefined
                            : endpoint.protocol || 1,
                        replaceToken,
                        region:
                            endpoint.id === "default" ? undefined : endpoint.id,
                        label: this.roomKey,
                        currentSpace: this.roomKey,
                        userId: this.identity.userId,
                        username: encodeURIComponent(
                            this.identity.username || "Guest"
                        ),
                        avatar: this.identity.avatar || GUEST_AVATAR,
                        token: endpoint.protocol
                            ? ""
                            : this.identity.token || "",
                        lobbyIdentityToken,
                        VRM: this.identity.vrmUrl,
                        scale: this.identity.scale,
                        position: this.pose,
                        rotationY: this.pose.rotation,
                    }),
                });
                if (!response.ok) {
                    // A server that cannot free the old seat is asked for a
                    // plain seat next time, so one stuck seat cannot keep
                    // this visitor out.
                    if (replaceToken === this.lastWorldToken)
                        this.lastWorldToken = null;
                    throw new Error("Matchmaking is unavailable.");
                }
                return response.json();
            };
            this.connectionPhase = "requesting-ticket";
            let result = await requestJoin(
                (endpoint.protocol === 2 && this.lastWorldToken) || undefined
            );
            if (!current()) {
                if (this.closed || generation !== this.generation) return;
                throw new Error("Connection timed out.");
            }
            if (
                this.options.nativeSpace &&
                (result.lobbyProtocol ||
                    (result.reservation?.room?.name &&
                        result.reservation.room.name !== "cyber"))
            )
                throw new Error("Native space matchmaking returned the lobby.");
            let room: Room<any>;
            if (result.lobbyProtocol === 2) {
                if (endpoint.protocol !== 2)
                    throw new Error("Unexpected lobby protocol.");
                const localEndpoint = [
                    "localhost",
                    "127.0.0.1",
                    "[::1]",
                ].includes(new URL(endpoint.httpUrl).hostname);
                this.connectionPhase = "opening-transport";
                const world = await WorldLobbyTransport.connect(
                    result as WorldLobbyTicket,
                    {
                        signal: controller.signal,
                        allowLocalCertificateHashes:
                            localEndpoint && endpoint.id !== "default",
                        renewTicket: async (previous) => {
                            result = await requestJoin(previous.token);
                            if (result.lobbyProtocol !== 2)
                                throw new Error(
                                    "Lobby protocol changed during admission."
                                );
                            return result;
                        },
                    }
                );
                if (!current()) {
                    await world.leave();
                    return;
                }
                this.world = world;
                // A fallback inside the admission may have renewed the ticket.
                this.lastWorldToken =
                    typeof result.token === "string" ? result.token : null;
                // This adapter implements only the room messaging surface used by
                // our existing chat and voice clients; it owns no Colyseus state.
                room = world as unknown as Room<any>;
                this.protocol = "v2";
                this.region = world.region;
                this.roomId = world.roomId;
            } else {
                if (!result.success || !result.reservation)
                    throw new Error("The lobby is unavailable.");
                if (endpoint.protocol === 2)
                    throw new Error(
                        "The configured world server requires protocol 2."
                    );
                this.protocol = result.lobbyProtocol === 1 ? "v1" : "legacy";
                const pending = new Client(
                    endpoint.wsUrl
                ).consumeSeatReservation(result.reservation);
                void pending
                    .then((lateRoom) => {
                        if (!current())
                            void lateRoom.leave(true).catch(() => {});
                    })
                    .catch(() => {});
                let onAbort: () => void;
                room = await Promise.race([
                    pending,
                    new Promise<Room>((_resolve, reject) => {
                        onAbort = () =>
                            reject(new Error("Connection timed out."));
                        controller.signal.addEventListener("abort", onAbort, {
                            once: true,
                        });
                        if (controller.signal.aborted) onAbort();
                    }),
                ]).finally(() =>
                    controller.signal.removeEventListener("abort", onAbort)
                );
                if (!current()) return;
                this.roomId =
                    typeof result.reservation?.room?.roomId === "string"
                        ? result.reservation.room.roomId
                        : "";
            }
            this.room = room;
            this.connectionPhase = "binding-social";
            this.prediction.resetSession();
            const disconnected = (code?: number) => {
                if (generation !== this.generation) return;
                // The legacy room drops an older socket without a close code
                // when the same signed-in account joins again (another tab or
                // device). Retrying would evict that session in turn and the
                // two would trade the seat forever.
                if (this.protocol === "legacy" && code === 1005)
                    void this.disconnect("replaced");
                else void this.disconnect();
            };
            room.onLeave(disconnected);
            room.onError(disconnected);
            this.unbinds.push(
                () => room.onLeave.remove(disconnected),
                () => room.onError.remove(disconnected),
                room.onMessage("kick", () => {
                    if (generation === this.generation)
                        void this.disconnect("removed");
                }),
                room.onMessage("lobby-groups", (message) => {
                    if (current()) this.receiveGroups(message);
                }),
                room.onMessage("lobby-group-result", (message) => {
                    if (current()) this.receiveGroupResult(message);
                }),
                room.onMessage("lobby-group-position", (message) => {
                    if (current()) this.receiveGroupPosition(message);
                }),
                room.onMessage("rtc-join", () => {}),
                room.onMessage("rtc-leave", () => {}),
                room.onMessage("rtc-signal", () => {})
            );
            const chat = new ColyseusChatProvider();
            this.chat = chat;
            chat.init(room);
            await chat.login(this.roomKey, room.sessionId);
            const channel = await chat.joinChannel(this.roomKey);
            if (!current()) {
                chat.dispose();
                return;
            }
            channel.on("ChannelMessage", this.receiveMessage);
            chat.on("MessageFromPeer", this.receiveDirectMessage);
            this.unbinds.push(() =>
                chat.off("MessageFromPeer", this.receiveDirectMessage)
            );
            if (this.protocol !== "legacy") {
                await new Promise<void>((resolve, reject) => {
                    const abort = () =>
                        reject(new Error("Lobby handshake timed out."));
                    controller.signal.addEventListener("abort", abort, {
                        once: true,
                    });
                    this.unbinds.push(
                        () =>
                            controller.signal.removeEventListener(
                                "abort",
                                abort
                            ),
                        room.onMessage("lobby-welcome", (message) => {
                            if (
                                !current() ||
                                this.welcomed ||
                                message?.lobbyProtocol !==
                                    (this.protocol === "v2" ? 2 : 1) ||
                                !this.prediction.welcome(message.position)
                            )
                                return;
                            this.welcomed = true;
                            if (this.desiredFlash)
                                this.flashOrigin = { ...this.pose };
                            this.update({
                                flashSupported: message.flash === true,
                            });
                            this.inputMode =
                                this.protocol === "v2" &&
                                message.movement === "input-v1";
                            this.inputPrediction.reset(this.prediction.pose);
                            if (
                                this.protocol === "v2" &&
                                Number.isSafeInteger(message.epoch)
                            )
                                this.worldEpoch = message.epoch;
                            this.receiveNetworkConfig(message);
                            this.population = Math.max(1, this.population);
                            if (typeof message.roomId === "string")
                                this.roomId = message.roomId;
                            this.region =
                                typeof message.region === "string"
                                    ? message.region
                                    : this.region;
                            this.upsertPlayer(
                                this.makePlayer(
                                    room.sessionId,
                                    {
                                        username: this.identity.username,
                                        partyIdentity: message.partyIdentity,
                                        role: message.role,
                                        avatar:
                                            this.identity.avatar ||
                                            GUEST_AVATAR,
                                        VRM: this.identity.vrmUrl,
                                        scale: this.identity.scale,
                                    },
                                    this.pose
                                )
                            );
                            this.publishRoster();
                            resolve();
                        }),
                        room.onMessage("lobby-roster", this.receiveRoster),
                        room.onMessage("lobby-flash", (message) => {
                            if (current()) this.receiveFlash(message);
                        }),
                        room.onMessage(
                            "lobby-config",
                            this.receiveNetworkConfig
                        ),
                        room.onMessage("lobby-snapshot", this.receiveSnapshot),
                        room.onMessage(
                            "lobby-snapshot-v2",
                            this.receiveWorldSnapshot
                        ),
                        room.onMessage("lobby-ack", (message) => {
                            if (this.inputMode) {
                                if (this.inputPrediction.acknowledge(message)) {
                                    this.prediction.reconcileState(
                                        this.inputPrediction.state,
                                        message.seq
                                    );
                                    if (message.resetInputs)
                                        this.groupRepositionPending = false;
                                }
                            } else this.prediction.acknowledge(message);
                        }),
                        room.onMessage("lobby-pong", this.receivePong),
                        room.onMessage("lobby-voice", this.receiveVoice),
                        room.onMessage("lobby-stage", this.receiveStage),
                        room.onMessage(
                            "lobby-admin-result",
                            this.receiveAdminResult
                        )
                    );
                    this.connectionPhase = "awaiting-welcome";
                    room.send("lobby-ready", {
                        movement: "input-v1",
                        motion: "velocity-v1",
                    });
                });
                if (!current()) return;
                this.sendPing();
                this.pingTimer = setInterval(this.sendPing, 3000);
            } else {
                room.onStateChange(this.readPlayers);
                this.unbinds.push(() =>
                    room.onStateChange.remove(this.readPlayers)
                );
                this.readPlayers();
                this.sendInit();
            }
            this.connectedAt = Date.now();
            this.connectionPhase = "connected";
            this.update({
                status: "connected",
                sessionId: room.sessionId,
                error: "",
            });
            this.publishFlash();
            this.sendPosition();
            if (
                (!this.lobbyPresent || this.groupLocation.state !== "lobby") &&
                this.snapshot.groupsSupported
            )
                this.publishWorldPresence();
        } catch {
            if (!this.closed && generation === this.generation) {
                controller.abort();
                invalidateLobbyEndpoint();
                this.update({
                    status: "offline",
                    error: "You’re exploring solo. Reconnecting to everyone…",
                    players: [],
                    population: 0,
                    sessionId: "",
                    voiceState: "off",
                });
                await this.releaseRoom();
            }
        } finally {
            clearTimeout(timer);
            if (generation === this.generation) {
                this.connecting = false;
                if (!this.closed && this.snapshot.status === "offline")
                    this.scheduleRetry();
            }
        }
    }
    /** Drop the room. Reconnects with backoff unless a stop reason is given. */
    private async disconnect(stop: LobbyStopReason | null = null) {
        if (this.closed) return;
        ++this.generation;
        this.connecting = false;
        this.controller.abort();
        // Only a session that held for a while earns a fresh backoff; one
        // dropped right after admission keeps backing off instead of looping.
        if (this.connectedAt && Date.now() - this.connectedAt >= STABLE_MS)
            this.retryCount = 0;
        this.connectedAt = 0;
        if (stop) this.stopped = stop;
        this.update({
            status: "offline",
            stopped: this.stopped,
            error:
                stop === "replaced"
                    ? LOBBY_REPLACED
                    : stop === "removed"
                    ? LOBBY_REMOVED
                    : LOBBY_LOST,
            players: [],
            population: 0,
            sessionId: "",
            voiceState: "off",
            groups: [],
            invitations: [],
            groupMessages: [],
            groupsSupported: false,
            groupClock: null,
            groupPosition: null,
            groupError: "",
        });
        await this.releaseRoom();
        this.scheduleRetry();
    }
    private makePlayer(
        id: string,
        metadata: any,
        pose: LobbyPose
    ): LobbyPlayer {
        return {
            ...pose,
            id,
            ...(this.protocol !== "legacy" &&
            typeof metadata.partyIdentity === "string" &&
            /^[A-Za-z0-9_-]{43}$/.test(metadata.partyIdentity)
                ? { partyIdentity: metadata.partyIdentity }
                : {}),
            ...(this.protocol !== "legacy" &&
            (metadata.role === "owner" || metadata.role === "admin")
                ? { role: metadata.role }
                : {}),
            flash:
                this.protocol !== "legacy"
                    ? readLobbyFlash(metadata.flash)
                    : null,
            name: readName(metadata.username),
            avatar: avatarUrl(metadata.avatar),
            isLocal: id === this.room?.sessionId,
            vrmUrl: avatarUrl(metadata.VRM),
            scale: avatarScale(metadata.scale),
            animation: animationCode(pose.animation),
            floor: pose.floor !== false,
        };
    }
    private upsertPlayer(player: LobbyPlayer) {
        const old = this.players.get(player.id);
        const changed =
            !old ||
            [
                "name",
                "avatar",
                "vrmUrl",
                "scale",
                "isLocal",
                "partyIdentity",
                "role",
            ].some((key) => old[key] !== player[key]) ||
            JSON.stringify(old?.flash) !== JSON.stringify(player.flash);
        this.players.set(player.id, player);
        this.motion.upsert(player);
        return changed;
    }
    private publishRoster() {
        this.update({
            population: this.population,
            protocol: this.protocol,
            region: this.region,
            roomId: this.roomId,
            players: Array.from(this.players.values(), (player) => ({
                ...player,
            })),
        });
    }
    private readPlayers = () => {
        let changed = false;
        const present = new Set<string>();
        const poses: Array<[string, LobbyPose]> = [];
        this.room?.state?.players?.forEach((player: any, id: string) => {
            if (
                this.options.nativeSpace
                    ? player.space !== this.roomKey
                    : player.space && player.space !== this.roomKey
            )
                return;
            const pose = {
                x: finite(player.positionX),
                y: finite(player.positionY),
                z: finite(player.positionZ),
                rotation: finite(player.rotation),
                animation: animationCode(player.animation),
                floor: player.floor !== false,
            };
            present.add(id);
            changed =
                this.upsertPlayer(this.makePlayer(id, player, pose)) || changed;
            poses.push([id, pose]);
        });
        for (const id of this.players.keys())
            if (!present.has(id)) {
                this.players.delete(id);
                this.motion.remove(id);
                changed = true;
            }
        this.population = this.players.size;
        const arrival = performance.now();
        const stamp = this.legacyClock.stamp(arrival);
        this.motion.pushFrame(++this.legacyTick, stamp, poses, arrival, true);
        this.scheduleLegacyQuietFrame(stamp, arrival);
        if (changed) this.publishRoster();
        this.selectLegacyVoice();
        this.updateAudioVolume();
    };
    /**
     * The room only sends a patch when something changed, so when the last
     * mover stops, the patch holding their resting position is the last one.
     * Without a following sample the avatar walks on past that point for a
     * moment and keeps its walk until the buffer runs dry. A quiet tick means
     * nothing moved: record it as a resting sample one interval later.
     */
    private scheduleLegacyQuietFrame(stamp: number, arrival: number) {
        if (this.legacyQuietTimer) clearTimeout(this.legacyQuietTimer);
        const interval = this.legacyClock.intervalMs;
        this.legacyQuietTimer = setTimeout(() => {
            this.legacyQuietTimer = null;
            if (this.closed || this.protocol !== "legacy") return;
            if (this.legacyClock.lastStamp !== stamp) return;
            const poses: Array<[string, LobbyPose]> = [];
            for (const [id, player] of this.players)
                if (!player.isLocal)
                    poses.push([
                        id,
                        {
                            x: player.x,
                            y: player.y,
                            z: player.z,
                            rotation: player.rotation,
                            animation: player.animation,
                            floor: player.floor,
                        },
                    ]);
            if (!poses.length) return;
            this.motion.pushFrame(
                ++this.legacyTick,
                stamp + interval,
                poses,
                arrival + interval,
                true
            );
        }, interval * 1.25);
    }
    private receiveRoster = (message: any) => {
        if (!Array.isArray(message?.enter) || !Array.isArray(message?.leave))
            return;
        let changed = false;
        for (const id of message.leave)
            if (
                typeof id === "string" &&
                id !== this.room?.sessionId &&
                this.players.delete(id)
            ) {
                this.motion.remove(id);
                changed = true;
            }
        for (const data of message.enter.slice(0, 256)) {
            if (
                typeof data?.sessionId !== "string" ||
                data.sessionId === this.room?.sessionId
            )
                continue;
            const previous = this.players.get(data.sessionId);
            if (!previous && this.players.size >= 257) continue;
            changed =
                this.upsertPlayer(
                    this.makePlayer(
                        data.sessionId,
                        data,
                        previous || { x: 0, y: 0, z: 0, rotation: 0 }
                    )
                ) || changed;
        }
        const population = Math.max(
            this.players.size,
            finite(message.population)
        );
        changed ||= population !== this.population;
        this.population = population;
        if (changed) this.publishRoster();
    };
    private receiveSnapshot = (message: any) => {
        if (!Array.isArray(message?.poses)) return;
        const poses: Array<[string, LobbyPose]> = [];
        for (const tuple of message.poses.slice(0, 256)) {
            if (
                !Array.isArray(tuple) ||
                tuple.length !== 7 ||
                typeof tuple[0] !== "string" ||
                !tuple.slice(1, 5).every(Number.isFinite)
            )
                continue;
            poses.push([
                tuple[0],
                {
                    x: tuple[1] / 100,
                    y: tuple[2] / 100,
                    z: tuple[3] / 100,
                    rotation: tuple[4] / 1000,
                    animation: animationCode(tuple[5]),
                    floor: tuple[6] !== 0,
                },
            ]);
        }
        if (!this.motion.pushFrame(message.tick, message.serverTime, poses))
            return;
        for (const [id, pose] of poses) {
            const player = this.players.get(id);
            if (player) Object.assign(player, pose);
        }
        this.updateAudioVolume();
    };
    private receiveNetworkConfig = (message: any) => {
        const rates = message?.snapshotRates;
        const bands = message?.snapshotBands;
        if (
            !rates ||
            ![rates.near, rates.mid, rates.far].every(
                (rate) => Number.isFinite(rate) && rate > 0 && rate <= 60
            ) ||
            !Array.isArray(bands) ||
            bands.length !== 3 ||
            !bands.every(
                (value, index) =>
                    Number.isInteger(value) &&
                    value > 0 &&
                    value <= 256 &&
                    (!index || value > bands[index - 1])
            )
        )
            return;
        const limit = message.aoiLimit ?? bands[2];
        if (limit !== bands[2]) return;
        // Budget changes only affect advertised replication cadence. Explicit
        // roster leaves own removal, preserving buffered motion and prediction.
        this.snapshotRates = {
            near: rates.near,
            mid: rates.mid,
            far: rates.far,
        };
        this.snapshotBands = [...bands];
        this.networkAoiLimit = limit;
    };
    private receiveWorldSnapshot = (message: any) => {
        if (
            !Array.isArray(message?.poses) ||
            !Number.isSafeInteger(message.epoch)
        )
            return;
        // Epoch is fixed for one admitted session. Never accept delayed packets
        // from an earlier world generation into a current interpolation timeline.
        if (this.worldEpoch === null) this.worldEpoch = message.epoch;
        if (message.epoch !== this.worldEpoch) return;
        const accepted = this.motion.pushChunk(
            message.tick,
            message.serverTime,
            message.poses.map(
                ([
                    id,
                    sequence,
                    x,
                    y,
                    z,
                    rotation,
                    animation,
                    floor,
                    vx,
                    vy,
                    vz,
                ]): [string, number, LobbyPose] => [
                    String(id),
                    sequence,
                    {
                        x,
                        y,
                        z,
                        rotation,
                        animation: animationCode(animation),
                        floor: floor !== false && floor !== 0,
                        vx,
                        vy,
                        vz,
                    },
                ]
            )
        );
        for (const [id, pose] of accepted) {
            const player = this.players.get(id);
            if (player) Object.assign(player, pose);
        }
        if (accepted.length) this.updateAudioVolume();
    };
    private receivePong = (message: any) => {
        const sent = this.pings.get(message?.id);
        if (sent === undefined || message.clientTime !== sent) return;
        this.pings.delete(message.id);
        this.motion.observeClock(sent, performance.now(), message.serverTime);
    };
    private sendPing = () => {
        if (!this.room || !this.welcomed || this.closed) return;
        const id = ++this.pingSequence,
            clientTime = performance.now();
        this.pings.set(id, clientTime);
        while (this.pings.size > 4)
            this.pings.delete(this.pings.keys().next().value);
        this.room.send("lobby-ping", { id, clientTime });
    };
    private receiveVoice = (message: any) => {
        if (!Array.isArray(message?.peers)) return;
        if (!this.lobbyPresent) message = { peers: [] };
        const ids = (value: unknown) =>
            new Set<string>(
                (Array.isArray(value) ? value : []).filter(
                    (id) =>
                        typeof id === "string" && id !== this.room?.sessionId
                )
            );
        this.voicePeers = Array.from(ids(message.peers)).slice(
            0,
            this.protocol === "legacy" ? 8 : LOBBY_SIGNAL_LIMIT
        );
        this.listenOnly = ids(message.listenOnly);
        this.speakOnly = ids(message.speakOnly);
        // Gate before the peer joins, so a first offer never carries our mic.
        if (this.voice)
            for (const id of this.voicePeers)
                this.voice.setMicGated(id, this.listenOnly.has(id));
        this.signaling?.replacePeers(this.voicePeers);
        for (const id of this.audio.keys())
            if (!this.voicePeers.includes(id) || this.speakOnly.has(id))
                this.removeAudio(id);
    };
    private receiveStage = (message: any) => {
        if (!Array.isArray(message?.speakers)) return;
        const person = (value: any): LobbyStagePerson | null =>
            typeof value?.sessionId === "string" &&
            value.sessionId.length <= 128
                ? {
                      sessionId: value.sessionId,
                      name: readName(value.username),
                      avatar: avatarUrl(value.avatar),
                      ...(value.role === "owner" || value.role === "admin"
                          ? { role: value.role }
                          : {}),
                  }
                : null;
        const role =
            message.role === "owner" || message.role === "admin"
                ? message.role
                : null;
        const stage: LobbyStage = {
            speakers: message.speakers.slice(0, 8).map(person).filter(Boolean),
            limit: Number.isSafeInteger(message.limit) ? message.limit : 5,
            role,
            muted: message.muted === true,
            requested: message.requested === true,
            requests: Array.isArray(message.requests)
                ? message.requests.slice(0, 64).map(person).filter(Boolean)
                : [],
            mutedPeople: Array.isArray(message.mutedPeople)
                ? message.mutedPeople
                      .slice(0, 256)
                      .filter((id) => typeof id === "string")
                : [],
            spatial: message.spatial === true,
        };
        const selfId = this.room?.sessionId;
        const leftStage =
            stage.spatial &&
            !!selfId &&
            this.stageSpeakers.has(selfId) &&
            !stage.speakers.some((s) => s.sessionId === selfId);
        this.stageSpeakers = new Set(stage.speakers.map((s) => s.sessionId));
        // Off voice, the mic goes quiet here too, not just on the server.
        if (leftStage && this.snapshot.voiceState === "live") {
            this.microphone?.getTracks().forEach((track) => {
                track.enabled = false;
            });
            this.update({ voiceState: "muted" });
        }
        const self = this.room && this.players.get(this.room.sessionId);
        if (self && self.role !== (role || undefined)) {
            const { role: _previous, ...rest } = self;
            this.upsertPlayer(role ? { ...rest, role } : rest);
            this.publishRoster();
        }
        if (stage.muted && this.snapshot.voiceState === "live")
            this.microphone?.getTracks().forEach((track) => {
                track.enabled = false;
            });
        this.update({
            stage,
            ...(stage.muted && this.snapshot.voiceState === "live"
                ? {
                      voiceState: "muted" as const,
                      voiceError: "An admin muted you. You can still listen.",
                  }
                : {}),
        });
        this.updateAudioVolume();
    };
    private receiveAdminResult = (message: any) => {
        const key = `${message?.action}:${message?.sessionId}`;
        const pending = this.adminRequests.get(key);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.adminRequests.delete(key);
        pending.resolve(
            message.ok === true
                ? ""
                : typeof message.error === "string"
                ? message.error.slice(0, 200)
                : "That didn’t work."
        );
    };
    /** Resolves to an error message, or "" on success. */
    adminAction = (
        action: LobbyAdminAction,
        sessionId: string
    ): Promise<string> => {
        if (!this.room || !this.snapshot.stage?.role)
            return Promise.resolve("You’re not an admin here.");
        const key = `${action}:${sessionId}`;
        this.adminRequests.get(key)?.resolve("Replaced by a newer request.");
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                this.adminRequests.delete(key);
                resolve("The lobby didn’t answer. Try again.");
            }, 5000);
            this.adminRequests.set(key, { resolve, timer });
            this.room.send("lobby-admin", { action, sessionId });
        });
    };
    requestVoice = (cancel = false) => {
        if (this.room && this.snapshot.stage)
            this.room.send("lobby-voice-request", { cancel });
    };
    leaveStage = () => {
        if (this.room && this.snapshot.stage)
            this.room.send("lobby-stage-leave");
    };
    private selectLegacyVoice() {
        if (this.protocol !== "legacy" || !this.room) return;
        const time = performance.now();
        if (time - this.lastVoiceSelection < 250 && this.lastVoiceSelection)
            return;
        this.lastVoiceSelection = time;
        const positions = Array.from(this.players.values()).map((player) =>
            player.isLocal ? { ...player, ...this.pose } : player
        );
        this.receiveVoice({
            peers: legacyVoicePeers(this.room.sessionId, positions),
        });
    }
    sampleParticipants = (now?: number) =>
        this.lobbyPresent ? this.motion.sample(now) : [];
    consumeCorrection = () => this.prediction.consume();
    getPredictedPose = () => ({ ...this.pose });
    getNetworkDiagnostics = () => ({
        ...this.motion.diagnostics(),
        protocol: this.protocol,
        connectionPhase: this.connectionPhase,
        region: this.region,
        roomId: this.roomId,
        snapshotRates:
            this.protocol !== "legacy" ? this.snapshotRates : undefined,
        snapshotBands:
            this.protocol !== "legacy" ? this.snapshotBands : undefined,
        networkAoiLimit:
            this.protocol !== "legacy" ? this.networkAoiLimit : undefined,
        transport: this.world?.transport || "websocket",
        ...this.world?.diagnostics(),
        status: this.snapshot.status,
        visiblePlayers: this.players.size,
        population: this.population,
        voicePeers: this.voicePeers.length,
        retryCount: this.retryCount,
        reconnectStopped: this.stopped,
        movementModel: this.inputMode ? "input-replay-60hz" : "pose",
        replayedInputs: this.inputPrediction.replayed,
        maxCorrectionMeters: this.inputPrediction.correctionDistance,
        pendingAcks: this.inputMode
            ? this.inputPrediction.pending
            : this.prediction.pendingPackets,
        corrections: this.prediction.corrections,
    });

    private receiveGroups = (value: unknown) => {
        const next = readLobbyGroups(
            value,
            this.room?.sessionId || this.snapshot.sessionId
        );
        if (!next) return;
        const wasSupported = this.snapshot.groupsSupported;
        // Reliable ordered control carries complete membership-owned histories.
        this.update({
            groups: next.groups,
            invitations: next.invitations,
            groupMessages: next.groups.flatMap((group) => group.messages),
            groupsSupported: next.supported,
            groupClock: {
                serverNow: next.serverNow,
                receivedAt: performance.now(),
            },
        });
        if (
            !wasSupported &&
            next.supported &&
            (!this.lobbyPresent || this.groupLocation.state !== "lobby") &&
            this.snapshot.status === "connected"
        )
            this.publishWorldPresence();
    };
    private receiveGroupResult = (value: any) => {
        if (
            !value ||
            typeof value.requestId !== "string" ||
            (value.error !== undefined &&
                (typeof value.error !== "string" ||
                    value.error.length > 200)) ||
            (value.groupId !== undefined &&
                (typeof value.groupId !== "string" ||
                    value.groupId.length > 128))
        )
            return;
        const request = this.groupRequests.get(value.requestId);
        if (!request) return;
        clearTimeout(request.timer);
        this.groupRequests.delete(value.requestId);
        if (value.error) {
            this.update({ groupError: value.error });
            request.reject(new Error(value.error));
        } else
            request.resolve({
                requestId: value.requestId,
                ...(value.groupId ? { groupId: value.groupId } : {}),
            });
    };
    private receiveGroupPosition = (value: unknown) => {
        const next = readLobbyGroupPosition(value);
        if (!next) return;
        // Preserve sequence numbers. The following resetInputs ACK clears stale
        // prediction history at the server's retained sequence.
        this.setFlash(null);
        this.groupRepositionPending = this.inputMode;
        this.prediction.reconcileState(next.pose, 0);
        if (this.moveTimer) clearTimeout(this.moveTimer);
        this.moveTimer = null;
        this.update({ groupPosition: next });
    };
    groupAction = (
        command: Omit<LobbyGroupAction, "requestId">
    ): Promise<LobbyGroupResult> => {
        if (this.closed || !this.room || this.snapshot.status !== "connected")
            return Promise.reject(new Error("Reconnect to use parties."));
        if (!this.snapshot.groupsSupported)
            return Promise.reject(
                new Error("Parties are not available in this lobby yet.")
            );
        if (this.groupRequests.size >= 16)
            return Promise.reject(
                new Error("Please wait for the current party request.")
            );
        const requestId =
            globalThis.crypto?.randomUUID?.() ||
            `group-${Date.now()}-${++this.messageSequence}`;
        const payload = { ...command, requestId };
        if (JSON.stringify(payload).length > 8192)
            return Promise.reject(new Error("The party request is too large."));
        this.update({ groupError: "" });
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.groupRequests.delete(requestId);
                reject(new Error("The party request timed out. Try again."));
            }, 8000);
            this.groupRequests.set(requestId, { resolve, reject, timer });
            try {
                this.room.send("lobby-group-action", payload);
            } catch {
                clearTimeout(timer);
                this.groupRequests.delete(requestId);
                reject(new Error("Could not send the party request."));
            }
        });
    };
    private publishWorldPresence = () => {
        if (
            this.closed ||
            this.snapshot.status !== "connected" ||
            !this.snapshot.groupsSupported
        )
            return;
        void this.groupAction({
            action: "active-world",
            active: !this.lobbyPresent,
            location: this.groupLocation,
        }).catch((error) => {
            if (!this.closed) this.update({ groupError: error.message });
        });
    };
    setFlash = (value: LobbyFlash | null): boolean => {
        if (
            this.closed ||
            (value !== null &&
                (!this.lobbyPresent ||
                    this.groupLocation.state !== "lobby" ||
                    this.snapshot.groupPosition?.held))
        )
            return false;
        const flash = value === null ? null : readLobbyFlash(value);
        if (value !== null && !flash) return false;
        if (this.desiredFlash?.nonce !== flash?.nonce)
            this.flashOrigin = flash ? { ...this.pose } : null;
        this.desiredFlash = flash;
        return this.publishFlash();
    };
    private publishFlash = () => {
        if (
            !this.room ||
            !this.welcomed ||
            !this.snapshot.flashSupported ||
            this.closed
        )
            return false;
        const nonce = this.desiredFlash?.nonce || null;
        if (nonce === this.sentFlash) return true;
        this.room.send("lobby-flash", { flash: this.desiredFlash });
        this.sentFlash = nonce;
        return true;
    };
    private receiveFlash = (message: any) => {
        if (
            !this.snapshot.flashSupported ||
            typeof message?.sessionId !== "string"
        )
            return;
        const player = this.players.get(message.sessionId);
        if (!player) return;
        const flash =
            message.flash === null ? null : readLobbyFlash(message.flash);
        if (message.flash !== null && !flash) return;
        if (this.upsertPlayer({ ...player, flash })) this.publishRoster();
    };
    setLobbyPresence = (present: boolean, location?: LobbyGroupLocation) => {
        const next = readGroupLocation(
            location || { state: present ? "lobby" : "space" }
        );
        if (
            !next ||
            (present ? next.state === "space" : next.state === "lobby")
        )
            return;
        if (
            this.lobbyPresent === present &&
            JSON.stringify(this.groupLocation) === JSON.stringify(next)
        )
            return;
        if (!present || next.state !== "lobby") this.setFlash(null);
        this.lobbyPresent = present;
        this.groupLocation = next;
        if (!present) {
            if (this.moveTimer) clearTimeout(this.moveTimer);
            this.moveTimer = null;
            this.microphone?.getTracks().forEach((track) => track.stop());
            this.microphone = null;
            this.voice?.leave();
            this.voice = null;
            this.signaling?.dispose();
            this.signaling = null;
            this.voicePeers = [];
            Array.from(this.audio.keys()).forEach(this.removeAudio);
        }
        this.update({
            lobbyPresent: present,
            ...(!present ? { voiceState: "off" as const } : {}),
        });
        this.publishWorldPresence();
    };

    private receiveDirectMessage = (
        data: any,
        sender: string,
        sentAt?: number,
        profile?: { username?: unknown; avatar?: unknown }
    ) => {
        if (
            !sender ||
            typeof sender !== "string" ||
            sender === this.snapshot.sessionId
        )
            return;
        this.receiveMessage(
            data,
            sender,
            sentAt,
            this.snapshot.sessionId,
            profile
        );
    };
    private receiveMessage = (
        data: any,
        sender: string,
        sentAt: number,
        recipientId?: string,
        profile?: { username?: unknown; avatar?: unknown }
    ) => {
        if (data?.type !== "MESSAGE" || typeof data.text !== "string") return;
        const player = this.players.get(sender);
        const text = data.text.trim().slice(0, 500);
        // Dense-world visibility can be asymmetric. A private relay includes
        // its sender's server-owned profile when they are outside our roster.
        const name =
            player?.name ||
            (recipientId && typeof profile?.username === "string"
                ? readName(profile.username)
                : "");
        if (!name || !text) return;
        this.update({
            messages: [
                ...this.snapshot.messages,
                {
                    id: `${sender}-${sentAt}-${this.messageSequence++}`,
                    sessionId: sender,
                    name,
                    avatar: player?.avatar || avatarUrl(profile?.avatar),
                    text,
                    sentAt: finite(sentAt) || Date.now(),
                    ...(recipientId ? { recipientId } : {}),
                },
            ].slice(-MAX_MESSAGES),
        });
    };
    sendMessage = (value: string, recipientId?: string) => {
        const text = value.trim().slice(0, 500),
            now = Date.now();
        if (
            !text ||
            this.closed ||
            !this.chat ||
            !this.lobbyPresent ||
            this.snapshot.status !== "connected" ||
            // Global and private sends share the server’s one-message/second budget.
            now - this.lastMessage < 1000
        )
            return false;
        if (
            recipientId !== undefined &&
            (!recipientId ||
                recipientId === this.snapshot.sessionId ||
                !this.players.has(recipientId))
        )
            return false;
        this.lastMessage = now;
        if (recipientId) {
            const data = {
                type: "MESSAGE",
                text,
                acc_date: new Date(now).toISOString(),
            };
            // Peer relays target only the recipient, so keep our own copy here.
            void this.chat.sendPeerMessage(data, recipientId).catch(() => {});
            this.receiveMessage(
                data,
                this.snapshot.sessionId,
                now,
                recipientId
            );
            return true;
        }
        void this.chat
            .sendChannelMessage(
                {
                    type: "MESSAGE",
                    text,
                    acc_date: new Date(now).toISOString(),
                },
                this.roomKey
            )
            .catch(() => {});
        return true;
    };
    advanceMovement = (dt: number, input: MovementInput) => {
        if (!this.inputMode || !this.welcomed || this.closed || !this.room)
            return null;
        if (
            !this.lobbyPresent ||
            this.snapshot.groupPosition?.held ||
            this.groupRepositionPending
        )
            return {
                ...this.inputPrediction.state,
                ...this.prediction.pose,
                movementInput: { ...input, forward: 0, strafe: 0, jump: false },
            };
        if (input.forward || input.strafe || input.jump) this.setFlash(null);
        const display = this.inputPrediction.advance(dt, input),
            state = this.inputPrediction.state;
        this.prediction.pose = {
            x: state.x,
            y: state.y,
            z: state.z,
            rotation: state.rotation,
            animation: state.animation,
            floor: state.floor,
        };
        this.updatePosition(this.prediction.pose);
        return display;
    };
    updatePosition = (pose: LobbyPose) => {
        if (
            !this.lobbyPresent ||
            this.snapshot.groupPosition?.held ||
            this.groupRepositionPending
        )
            return;
        if (this.inputMode) pose = this.prediction.pose;
        if (![pose.x, pose.y, pose.z, pose.rotation].every(Number.isFinite))
            return;
        if (
            this.desiredFlash &&
            (pose.moving ||
                pose.floor === false ||
                (this.flashOrigin &&
                    Math.hypot(
                        pose.x - this.flashOrigin.x,
                        pose.y - this.flashOrigin.y,
                        pose.z - this.flashOrigin.z
                    ) > 0.01))
        )
            this.setFlash(null);
        this.prediction.pose = {
            ...pose,
            animation: animationCode(pose.animation),
            floor: pose.floor !== false,
        };
        this.selectLegacyVoice();
        this.updateAudioVolume();
        if (
            this.closed ||
            !this.room ||
            this.moveTimer ||
            (this.protocol !== "legacy" && !this.welcomed)
        )
            return;
        const delay = Math.max(0, 33 - (Date.now() - this.lastMove));
        this.moveTimer = setTimeout(this.sendPosition, delay);
    };
    private sendPosition = () => {
        this.moveTimer = null;
        if (
            !this.lobbyPresent ||
            this.snapshot.groupPosition?.held ||
            this.groupRepositionPending ||
            this.closed ||
            !this.room ||
            (this.protocol !== "legacy" && !this.welcomed)
        )
            return;
        if (this.inputMode) {
            const inputs = this.inputPrediction.packet();
            if (inputs.length) this.room.send("lobby-input", inputs);
            this.lastMove = Date.now();
            return;
        }
        const { x, y, z, rotation, animation, floor } = this.pose;
        if (this.protocol === "legacy") {
            const move = [
                x,
                y,
                z,
                rotation,
                animationCode(animation),
                floor !== false,
            ];
            // Standing still sends nothing new; refresh it once a second.
            const key = move.join();
            if (key === this.legacyMoveKey && Date.now() - this.lastMove < 1000)
                return;
            this.legacyMoveKey = key;
            this.room.send("move", move);
        } else this.room.send("lobby-move", this.prediction.packet());
        this.lastMove = Date.now();
    };
    updateAvatar = ({ vrmUrl, scale = this.identity.scale }: LobbyAvatar) => {
        const nextUrl = avatarUrl(vrmUrl),
            nextScale = avatarScale(scale);
        const urlChanged = nextUrl !== this.identity.vrmUrl,
            scaleChanged = nextScale !== this.identity.scale;
        this.identity.vrmUrl = nextUrl;
        this.identity.scale = nextScale;
        if (this.closed || !this.room || (!urlChanged && !scaleChanged)) return;
        if (this.protocol !== "legacy") {
            this.room.send("lobby-profile", { VRM: nextUrl, scale: nextScale });
            const self = this.players.get(this.room.sessionId);
            if (self) {
                this.upsertPlayer({
                    ...self,
                    vrmUrl: nextUrl,
                    scale: nextScale,
                });
                this.publishRoster();
            }
        } else {
            if (urlChanged) this.room.send("VRM", nextUrl);
            if (scaleChanged) this.room.send("scale", nextScale);
        }
    };
    private sendInit() {
        if (this.closed || !this.room) return;
        const { x, y, z, rotation, animation, floor } = this.pose;
        this.room.send("init", [
            x,
            y,
            z,
            rotation,
            this.identity.scale,
            this.roomKey,
            this.identity.userId,
            this.identity.avatar || GUEST_AVATAR,
            encodeURIComponent(this.identity.username || "Guest"),
            USER_HEIGHT,
            false,
            animationCode(animation),
            floor !== false,
            this.identity.vrmUrl,
        ]);
    }
    private removeAudio = (id: string) => {
        const audio = this.audio.get(id);
        if (!audio) return;
        audio.pause();
        audio.srcObject = null;
        this.audio.delete(id);
    };

    private updateAudioVolume() {
        this.audio.forEach((audio, id) => {
            if (this.stageSpeakers.has(id) && !this.snapshot.stage?.spatial) {
                audio.volume = 1;
                return;
            }
            const player = this.players.get(id);
            const distance = player
                ? Math.hypot(player.x - this.pose.x, player.z - this.pose.z)
                : Infinity;
            audio.volume = Math.max(0, Math.min(1, 1 - (distance - 2) / 12));
        });
    }

    /** Hear stage speakers and nearby people without asking for the microphone. */
    listen = () => this.toggleVoice(true);
    toggleVoice = async (listenOnly = false) => {
        if (
            !this.lobbyPresent ||
            this.closed ||
            !this.room ||
            this.snapshot.voiceState === "connecting" ||
            (listenOnly && this.snapshot.voiceState !== "off")
        )
            return;
        if (!listenOnly && this.snapshot.stage?.muted) {
            this.update({
                voiceError: "An admin muted you. You can still listen.",
            });
            if (this.snapshot.voiceState !== "off") return;
            listenOnly = true;
        }
        if (this.snapshot.voiceState === "live") {
            this.microphone?.getTracks().forEach((track) => {
                track.enabled = false;
            });
            this.update({ voiceState: "muted" });
            return;
        }
        const generation = this.generation;
        const current = () =>
            !this.closed &&
            this.lobbyPresent &&
            generation === this.generation &&
            !!this.room;
        this.update({ voiceState: "connecting", voiceError: "" });
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error(
                    "Voice needs a browser with microphone access."
                );
            }
            if (!this.voice) {
                const { WebRTCClient } = await import(
                    "@utils/voiceChat/WebRTCClient"
                );
                if (!current()) return;
                // The engine's facade uses a singleton; own this instance so
                // a late permission result cannot disturb the next experience.
                const voice = new WebRTCClient();
                this.voice = voice;
                voice.micAllowed = (id) => !this.listenOnly.has(id);
                voice.on("user-published", (user, stream, channel) => {
                    if (
                        !current() ||
                        this.voice !== voice ||
                        channel !== "mic" ||
                        !this.voicePeers.includes(user.uid) ||
                        this.speakOnly.has(user.uid)
                    )
                        return;
                    this.removeAudio(user.uid);
                    const audio = new Audio();
                    audio.autoplay = true;
                    audio.srcObject = stream;
                    this.audio.set(user.uid, audio);
                    this.updateAudioVolume();
                    void audio.play().catch(() => {
                        if (!current() || this.audio.get(user.uid) !== audio)
                            return;
                        this.update({
                            voiceError:
                                "Tap the microphone to enable audio playback.",
                        });
                    });
                });
                voice.on("user-unpublished", (user, stream) => {
                    if (
                        current() &&
                        this.voice === voice &&
                        this.audio.get(user.uid)?.srcObject === stream
                    )
                        this.removeAudio(user.uid);
                });
                voice.on("user-left", (user) => {
                    if (current() && this.voice === voice)
                        this.removeAudio(user.uid);
                });
                const signaling = new LobbyVoiceSignaling(
                    this.room,
                    this.voicePeers,
                    this.protocol !== "legacy"
                );
                this.signaling = signaling;
                try {
                    await voice.init({
                        transport: signaling,
                        userId: this.room.sessionId,
                        turnBaseUrl: this.turnBaseUrl,
                    });
                } catch (error) {
                    // A failed startup must be retryable. Do not keep a
                    // disconnected client and publish into it on the next tap.
                    voice.leave();
                    signaling.dispose();
                    if (this.voice === voice) {
                        this.voice = null;
                        this.signaling = null;
                        Array.from(this.audio.keys()).forEach(this.removeAudio);
                    }
                    throw error;
                }
                if (!current()) {
                    voice.leave();
                    return;
                }
                voice.setRole("host");
            }
            if (listenOnly) {
                this.audio.forEach((audio) => {
                    void audio.play().catch(() => {});
                });
                this.update({ voiceState: "muted" });
                return;
            }
            if (!this.microphone) {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        channelCount: 1,
                    },
                    video: false,
                });
                if (!current()) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }
                this.microphone = stream;
                this.voice.publish(stream, "mic");
                stream.getAudioTracks().forEach((track) => {
                    track.addEventListener("ended", () => {
                        if (this.closed || this.microphone !== stream) return;
                        this.voice?.unpublish(stream);
                        this.microphone = null;
                        this.update({ voiceState: "muted" });
                    });
                });
            }
            this.microphone.getTracks().forEach((track) => {
                track.enabled = true;
            });
            this.audio.forEach((audio) => {
                void audio.play().catch(() => {});
            });
            this.update({ voiceState: "live", voiceError: "" });
        } catch (error) {
            if (!current()) return;
            this.update({
                voiceState: this.voice ? "muted" : "off",
                voiceError:
                    error?.name === "NotAllowedError"
                        ? "Microphone access was declined. You can still listen and chat."
                        : "Couldn’t start your microphone. Tap to try again.",
            });
        }
    };

    private releaseRoom = async () => {
        for (const request of this.groupRequests.values()) {
            clearTimeout(request.timer);
            request.reject(new Error("The lobby connection changed."));
        }
        this.groupRequests.clear();
        this.groupRepositionPending = false;
        if (this.moveTimer) clearTimeout(this.moveTimer);
        this.moveTimer = null;
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = null;
        this.pings.clear();
        this.welcomed = false;
        this.sentFlash = null;
        this.update({ flashSupported: false });
        this.inputMode = false;
        this.worldEpoch = null;
        this.unbinds.forEach((unbind) => {
            try {
                unbind?.();
            } catch {}
        });
        this.unbinds = [];
        this.chat?.dispose();
        this.chat = null;
        this.microphone?.getTracks().forEach((track) => track.stop());
        this.microphone = null;
        this.voice?.leave();
        this.voice = null;
        this.signaling?.dispose();
        this.signaling = null;
        Array.from(this.audio.keys()).forEach(this.removeAudio);
        this.voicePeers = [];
        this.listenOnly.clear();
        this.speakOnly.clear();
        this.stageSpeakers.clear();
        for (const pending of this.adminRequests.values()) {
            clearTimeout(pending.timer);
            pending.resolve("The lobby connection changed.");
        }
        this.adminRequests.clear();
        this.update({ stage: null });
        this.players.clear();
        this.motion.clear();
        this.legacyClock.reset();
        this.legacyMoveKey = "";
        if (this.legacyQuietTimer) clearTimeout(this.legacyQuietTimer);
        this.legacyQuietTimer = null;
        this.population = 0;
        this.prediction.resetSession();
        const room = this.room;
        this.room = null;
        this.world = null;
        if (!room) return;
        let timer: ReturnType<typeof setTimeout>;
        await Promise.race([
            room.leave(true).catch(() => {}),
            new Promise((resolve) => {
                timer = setTimeout(resolve, 1000);
            }),
        ]);
        clearTimeout(timer);
    };
    close = (): Promise<void> => {
        if (this.closePromise) return this.closePromise;
        this.setFlash(null);
        this.desiredFlash = null;
        this.closed = true;
        ++this.generation;
        this.controller.abort();
        this.pauseRetries();
        this.lifecycleUnbinds.forEach((unbind) => unbind());
        this.lifecycleUnbinds = [];
        this.closePromise = this.releaseRoom();
        return this.closePromise;
    };
}
