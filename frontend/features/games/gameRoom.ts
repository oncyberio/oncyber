import type { Room } from "colyseus.js";
import { ARENA_HTTP_URL } from "@utils/arena/constants";
import { requestSeat, takeSeat } from "@utils/arena/join";
import { ColyseusSignaling } from "@utils/voiceChat/ColyseusSignaling";
import type { WebRTCClient } from "@utils/voiceChat/WebRTCClient";
import {
    isPagePacket,
    voiceVolume,
    type GameSocial,
    type SocialRoom,
} from "./gameSocial";
import { VoiceLevels } from "./voiceLevels";
import { TalkingMeter } from "./gameTalking";

export type RoomIdentity = {
    userId: string;
    name: string;
    pfp: string;
    avatarUrl: string;
    token?: string;
    /** Party rooms: lets this page take its seat back after a drop. */
    matchKey?: string;
};

/** Mirrors the game's pose message: active entity position, heading, mode*8+anim. */
export type GamePose = {
    x: number;
    y: number;
    z: number;
    h: number;
    a: number;
};

export type GamePeer = GamePose & {
    id: string;
    name: string;
    pfp: string;
    vrm: string;
    /** True when the room reported a new pose since the previous sample. */
    fresh: boolean;
    /** Their voice is audible right now (the game's talking indicator). */
    talking: boolean;
};

export type VoiceState = "off" | "connecting" | "live" | "muted";

export type GameRoomState = {
    status: "connecting" | "connected" | "error";
    players: number;
    voiceState: VoiceState;
    voiceError: string;
};

const finite = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;
const decode = (value: unknown) => {
    if (typeof value !== "string") return "";
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

/** Relay for game packets: the room rebroadcasts `chat-channel` to everyone. */
export type GameRelayHandler = (from: string, data: unknown) => void;
// The room drops chat-channel messages past 15 per 3 s per sender.
const RELAY_INTERVAL = 220;
// A dropped connection is retried at these delays, then every 8 s.
const RECONNECT_DELAYS = [500, 1000, 2000, 4000, 8000];
// The room closed this session because the same page joined again.
const REPLACED = 4001;

/**
 * One shared native `cyber` room per game. The crowd lobby room can't host
 * games: it clamps players to ±200 m at walking speed, while game worlds can
 * be kilometres wide and players drive and fly.
 */
export class GameRoom implements SocialRoom {
    /** The page's chat and voice layer: chat on this room goes to it. */
    social: GameSocial | null = null;
    private levels = new VoiceLevels();
    private voiceGain: ((id: string) => number | null) | null = null;
    private room: Room | null = null;
    private relayHandler: GameRelayHandler | null = null;
    private relayAt = 0;
    private closed = false;
    private attempts = 0;
    private retry: ReturnType<typeof setTimeout> | null = null;
    /** Told each time the room connects (and null when it is lost). */
    onRoom: ((room: Room | null) => void) | null = null;
    private pose: GamePose = { x: 0, y: 0, z: 0, h: 0, a: 0 };
    private last = new Map<string, string>();
    private voice: WebRTCClient | null = null;
    private talking = new TalkingMeter();
    private signaling: ColyseusSignaling | null = null;
    private microphone: MediaStream | null = null;
    private audio = new Map<string, HTMLAudioElement>();
    private distances = new Map<string, number>();
    state: GameRoomState = {
        status: "connecting",
        players: 0,
        voiceState: "off",
        voiceError: "",
    };

    constructor(
        private identity: RoomIdentity,
        private onChange: (state: GameRoomState) => void,
        private label: string
    ) {}

    private update(next: Partial<GameRoomState>) {
        this.state = { ...this.state, ...next };
        if (!this.closed) this.onChange(this.state);
    }

    async connect() {
        try {
            const { reservation } = await requestSeat(
                {
                    label: this.label,
                    currentSpace: this.label,
                    userId: this.identity.userId,
                    username: encodeURIComponent(this.identity.name),
                    avatar: this.identity.pfp,
                    VRM: this.identity.avatarUrl,
                    token: this.identity.token || "",
                    matchKey: this.identity.matchKey,
                    position: {
                        x: String(this.pose.x),
                        y: String(this.pose.y),
                        z: String(this.pose.z),
                    },
                    rotationY: String(this.pose.h),
                },
                { unavailable: "The game room is unavailable." }
            );
            const room = await takeSeat(reservation);
            if (this.closed) {
                void Promise.resolve(room.leave(true)).catch(() => {});
                return;
            }
            this.room = room;
            room.onMessage("chat-channel", (message: any) => {
                // Chat and room commands are the page's, never the game's.
                if (
                    this.social
                        ? this.social.receive(
                              message?.from,
                              message?.data,
                              message?.server_ts
                          )
                        : isPagePacket(message?.data)
                )
                    return;
                if (
                    this.relayHandler &&
                    typeof message?.from === "string" &&
                    message.from !== room.sessionId
                )
                    this.relayHandler(message.from, message.data);
            });
            room.onLeave((code) => {
                if (this.room === room) this.lost(code !== REPLACED);
            });
            this.attempts = 0;
            this.onRoom?.(room);
            this.sendPose();
            this.update({ status: "connected" });
            void this.listen().catch((error) =>
                console.warn("[game room] voice:", error)
            );
        } catch (error) {
            console.warn("[game room] room:", error);
            // A first join that fails stays failed; a rejoin keeps trying.
            if (this.attempts) this.lost(true);
            else this.update({ status: "error" });
        }
    }

    /** The connection dropped: tear down voice and join again shortly. */
    private lost(rejoin: boolean) {
        if (this.closed) return;
        this.room = null;
        this.onRoom?.(null);
        Array.from(this.audio.keys()).forEach((id) => this.removeAudio(id));
        this.voice?.leave();
        this.voice = null;
        this.signaling?.dispose();
        this.signaling = null;
        this.listening = null;
        this.microphone?.getTracks().forEach((track) => track.stop());
        this.microphone = null;
        this.last.clear();
        if (!rejoin) {
            this.update({ status: "error", voiceState: "off" });
            return;
        }
        this.update({ status: "connecting", voiceState: "off" });
        const delay =
            RECONNECT_DELAYS[
                Math.min(this.attempts, RECONNECT_DELAYS.length - 1)
            ];
        this.attempts += 1;
        this.retry = setTimeout(() => {
            this.retry = null;
            if (!this.closed) void this.connect();
        }, delay);
    }

    /** This client's id in the room, as other players see it. */
    get sessionId() {
        return this.room?.sessionId || "";
    }

    onRelay(handler: GameRelayHandler | null) {
        this.relayHandler = handler;
    }

    /** Broadcast a game packet to everyone else in the room (rate limited). */
    relay(data: unknown) {
        const now = Date.now();
        // A game can't send chat in the visitor's name (gameSocial.ts).
        if (isPagePacket(data)) return false;
        if (!this.room || now - this.relayAt < RELAY_INTERVAL) return false;
        this.relayAt = now;
        try {
            this.room.send("chat-channel", data);
            return true;
        } catch {
            return false;
        }
    }

    setPose(pose: GamePose) {
        this.pose = pose;
        this.sendPose();
    }

    private sendPose() {
        const { x, y, z, h, a } = this.pose;
        try {
            this.room?.send("move", [x, y, z, h, a, true]);
        } catch {
            // Socket closing; the next room owns poses.
        }
    }

    /** Everyone else in the room, ready for the game's peer renderer. */
    samplePeers(): GamePeer[] {
        const room = this.room;
        const players = (room?.state as any)?.players;
        if (!room || !players?.forEach) return [];
        const peers: GamePeer[] = [];
        const seen = new Set<string>();
        players.forEach((player: any, id: string) => {
            if (id === room.sessionId || peers.length >= 32) return;
            const pose = {
                x: finite(player.positionX),
                y: finite(player.positionY),
                z: finite(player.positionZ),
                h: finite(player.rotation),
                a: Math.max(
                    0,
                    Math.min(31, Math.round(finite(player.animation)))
                ),
            };
            const key = `${pose.x},${pose.y},${pose.z},${pose.h},${pose.a}`;
            seen.add(id);
            const fresh = this.last.get(id) !== key;
            this.last.set(id, key);
            this.distances.set(
                id,
                Math.hypot(
                    pose.x - this.pose.x,
                    pose.y - this.pose.y,
                    pose.z - this.pose.z
                )
            );
            peers.push({
                id,
                ...pose,
                name: decode(player.username) || "Visitor",
                pfp: typeof player.avatar === "string" ? player.avatar : "",
                vrm: typeof player.VRM === "string" ? player.VRM : "",
                fresh,
                talking: this.talking.talking(id),
            });
        });
        for (const id of Array.from(this.last.keys()))
            if (!seen.has(id)) {
                this.last.delete(id);
                this.distances.delete(id);
            }
        if (peers.length + 1 !== this.state.players)
            this.update({ players: peers.length + 1 });
        this.updateVolumes();
        return peers;
    }

    private updateVolumes() {
        this.audio.forEach((audio, id) => {
            // Where the game placed this player, else their room pose.
            audio.volume =
                this.voiceGain?.(id) ??
                voiceVolume(this.distances.get(id) ?? Infinity);
        });
    }

    // What the page's chat and voice layer needs (SocialRoom).
    sendChat(packet: object) {
        try {
            this.room?.send("chat-channel", packet);
            return !!this.room;
        } catch {
            return false;
        }
    }
    peerName(id: string) {
        return decode((this.room?.state as any)?.players?.get?.(id)?.username);
    }
    voiceState() {
        return this.state.voiceState;
    }
    goLive = async () => {
        if (this.state.voiceState !== "live") await this.toggleVoice();
    };
    voiceLevels() {
        return this.levels.levels();
    }
    setVoiceGain(gain: ((id: string) => number | null) | null) {
        this.voiceGain = gain;
        this.updateVolumes();
    }

    private removeAudio(id: string) {
        const audio = this.audio.get(id);
        if (!audio) return;
        audio.pause();
        audio.srcObject = null;
        this.audio.delete(id);
        this.levels.set(id, null);
        this.talking.unwatch(id);
    }

    /** Join the voice mesh without a microphone, so you hear people nearby. */
    private listening: Promise<void> | null = null;
    listen = () => {
        if (!this.room) return Promise.resolve();
        this.listening ||= this.startListening(this.room).catch((error) => {
            this.listening = null;
            throw error;
        });
        return this.listening;
    };

    private startListening = async (room: Room) => {
        const { WebRTCClient } = await import("@utils/voiceChat/WebRTCClient");
        if (this.closed || this.room !== room) return;
        const voice = new WebRTCClient();
        this.voice = voice;
        voice.on("user-published", (user, stream, channel) => {
            if (this.closed || channel !== "mic") return;
            this.removeAudio(user.uid);
            const audio = new Audio();
            audio.autoplay = true;
            audio.srcObject = stream;
            this.audio.set(user.uid, audio);
            this.levels.set(user.uid, stream);
            this.talking.watch(user.uid, stream);
            this.updateVolumes();
            void audio.play().catch(() => {
                this.update({
                    voiceError: "Tap the microphone to enable audio playback.",
                });
            });
        });
        voice.on("user-unpublished", (user) => this.removeAudio(user.uid));
        voice.on("user-left", (user) => this.removeAudio(user.uid));
        this.signaling = new ColyseusSignaling(room);
        await voice.init({
            transport: this.signaling,
            userId: room.sessionId,
            turnBaseUrl: ARENA_HTTP_URL,
        });
        voice.setRole("host");
    };

    /** Same WebRTC mesh and Colyseus signaling as native spaces. */
    toggleVoice = async () => {
        const room = this.room;
        if (!room) return;
        if (this.state.voiceState === "live") {
            this.microphone
                ?.getTracks()
                .forEach((track) => (track.enabled = false));
            this.update({ voiceState: "muted" });
            return;
        }
        this.update({ voiceState: "connecting", voiceError: "" });
        try {
            if (!navigator.mediaDevices?.getUserMedia)
                throw new Error(
                    "Voice needs a browser with microphone access."
                );
            await this.listen();
            if (this.closed || !this.voice) return;
            if (!this.microphone) {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        channelCount: 1,
                    },
                    video: false,
                });
                if (this.closed) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }
                this.microphone = stream;
                this.levels.set(room.sessionId, stream);
                this.voice.publish(stream, "mic");
            }
            this.microphone
                .getTracks()
                .forEach((track) => (track.enabled = true));
            this.audio.forEach((audio) => void audio.play().catch(() => {}));
            this.levels.resume();
            this.update({ voiceState: "live", voiceError: "" });
        } catch (error) {
            if (this.closed) return;
            this.update({
                voiceState: this.voice ? "muted" : "off",
                voiceError:
                    error?.name === "NotAllowedError"
                        ? "Microphone access was declined. You can still listen."
                        : "Couldn’t start your microphone. Tap to try again.",
            });
        }
    };

    async close() {
        this.closed = true;
        if (this.retry) clearTimeout(this.retry);
        this.microphone?.getTracks().forEach((track) => track.stop());
        this.microphone = null;
        Array.from(this.audio.keys()).forEach((id) => this.removeAudio(id));
        this.levels.dispose();
        this.voice?.leave();
        this.voice = null;
        this.signaling?.dispose();
        this.signaling = null;
        const room = this.room;
        this.room = null;
        if (room)
            await Promise.race([
                Promise.resolve(room.leave(true)).catch(() => {}),
                new Promise((resolve) => setTimeout(resolve, 2000)),
            ]);
    }
}
