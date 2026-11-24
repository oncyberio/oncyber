import type { Room } from "colyseus.js";
import { ARENA_HTTP_URL } from "@utils/arena/constants";
import { ColyseusSignaling } from "@utils/voiceChat/ColyseusSignaling";
import type { WebRTCClient } from "@utils/voiceChat/WebRTCClient";
import { VoiceLevels } from "./voiceLevels";
import { TalkingMeter } from "./gameTalking";

export type VoiceState = "off" | "connecting" | "live" | "muted";

/**
 * Voice in one room, held by the page: the same WebRTC mesh and room
 * signalling as native spaces. The page listens as soon as it is in the
 * room and publishes a microphone only when its visitor turns one on, so a
 * framed game or world never touches the microphone itself. One per room
 * connection; a game's room and a framed world's room both use it.
 */
export class RoomVoice {
    readonly levels = new VoiceLevels();
    readonly talking = new TalkingMeter();
    state: VoiceState = "off";
    error = "";
    private closed = false;
    private voice: WebRTCClient | null = null;
    private signaling: ColyseusSignaling | null = null;
    private microphone: MediaStream | null = null;
    private audio = new Map<string, HTMLAudioElement>();
    private listening: Promise<void> | null = null;

    constructor(
        private room: Room,
        private options: {
            /** How loud a room member is heard, 0 to 1. */
            volume(id: string): number;
            onChange(state: VoiceState, error: string): void;
        }
    ) {}

    private update(next: { state?: VoiceState; error?: string }) {
        this.state = next.state ?? this.state;
        this.error = next.error ?? this.error;
        if (!this.closed) this.options.onChange(this.state, this.error);
    }

    /** Applies the volume rule to everyone heard now. */
    updateVolumes() {
        this.audio.forEach((audio, id) => {
            audio.volume = this.options.volume(id);
        });
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
    listen = () => {
        this.listening ||= this.startListening().catch((error) => {
            this.listening = null;
            throw error;
        });
        return this.listening;
    };

    private startListening = async () => {
        const { WebRTCClient } = await import("@utils/voiceChat/WebRTCClient");
        if (this.closed) return;
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
                    error: "Tap the microphone to enable audio playback.",
                });
            });
        });
        voice.on("user-unpublished", (user) => this.removeAudio(user.uid));
        voice.on("user-left", (user) => this.removeAudio(user.uid));
        this.signaling = new ColyseusSignaling(this.room);
        await voice.init({
            transport: this.signaling,
            userId: this.room.sessionId,
            turnBaseUrl: ARENA_HTTP_URL,
        });
        voice.setRole("host");
    };

    /** Microphone on, or muted when it is on. */
    toggle = async () => {
        if (this.closed) return;
        if (this.state === "live") {
            this.microphone
                ?.getTracks()
                .forEach((track) => (track.enabled = false));
            this.update({ state: "muted" });
            return;
        }
        this.update({ state: "connecting", error: "" });
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
                this.levels.set(this.room.sessionId, stream);
                this.voice.publish(stream, "mic");
            }
            this.microphone
                .getTracks()
                .forEach((track) => (track.enabled = true));
            this.audio.forEach((audio) => void audio.play().catch(() => {}));
            this.levels.resume();
            this.update({ state: "live", error: "" });
        } catch (error) {
            if (this.closed) return;
            this.update({
                state: this.voice ? "muted" : "off",
                error:
                    error?.name === "NotAllowedError"
                        ? "Microphone access was declined. You can still listen."
                        : "Couldn’t start your microphone. Tap to try again.",
            });
        }
    };

    /** The room is gone, or the page is leaving it. */
    close() {
        this.closed = true;
        this.microphone?.getTracks().forEach((track) => track.stop());
        this.microphone = null;
        Array.from(this.audio.keys()).forEach((id) => this.removeAudio(id));
        this.levels.dispose();
        this.voice?.leave();
        this.voice = null;
        this.signaling?.dispose();
        this.signaling = null;
    }
}
