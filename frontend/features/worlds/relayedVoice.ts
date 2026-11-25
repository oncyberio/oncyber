/**
 * The world's side of relayed voice (docs/plans/framed-worlds.md, slice 3).
 * In the site's frame the page holds the microphone and plays every voice,
 * so the world gets this in place of its voice service: the same surface,
 * with nothing behind it but messages. The world's own voice rules keep
 * running against it — who may speak, how far a voice carries, who is
 * shown talking — and the page does what they say, with one exception: a
 * microphone goes on only from the page's own button.
 *
 *   world → page   `voice-join`, `voice-leave`, `voice-allow`, `voice-mute`,
 *                  `voice-volume`, `voice-gate`
 *   page → world   `voice-joined`, `voice-state`, `voice-published`,
 *                  `voice-levels`
 */
import { AUDIO_LOW_BAR } from "@utils/voiceChat/levels";
import {
    Events,
    TypedEmitter,
    type ChannelType,
    type Role,
} from "@utils/voiceChat/types";
import { VoiceChatState } from "@utils/voiceChat/VoiceChatProvider";
import type { RoomLink } from "./relayedRoom";

/** What the engine holds for a voice the page plays: its volume, no sound. */
export interface RelayedVoiceStream {
    relayedVoice: true;
    uid: string;
    setVolume(volume: number): void;
    getTracks(): [];
}

// The engine sets a volume every frame; the page hears of real changes.
const VOLUME_STEP = 0.02;
const JOIN_WAIT_MS = 5_000;

export class RelayedVoiceProvider extends TypedEmitter {
    readonly Events = Events;
    state: VoiceChatState = VoiceChatState.Disconnected;
    role: Role = "audience";
    /** The page's microphone is on and unmuted. */
    private live = false;
    private voices = new Map<string, RelayedVoiceStream>();
    private gates = new Map<string, boolean>();
    private joined: (() => void) | null = null;

    constructor(private link: RoomLink) {
        super();
        link.listen((kind, data) => this.receive(kind, data));
    }

    private receive(kind: string, data: any) {
        if (kind === "voice-joined") this.joined?.();
        else if (kind === "voice-state") this.live = data?.live === true;
        else if (kind === "voice-published" && typeof data?.uid === "string") {
            const uid: string = data.uid;
            if (data.published === true) {
                const voice = this.voiceOf(uid);
                this.emit(Events.USER_PUBLISHED, uid, {
                    channel: "mic",
                    mediaType: "audio",
                    stream: voice as unknown as MediaStream,
                });
            } else if (this.voices.delete(uid)) {
                this.gates.delete(uid);
                this.emit(Events.USER_UNPUBLISHED, uid, {
                    channel: "mic",
                    mediaType: "audio",
                    stream: null,
                });
            }
        } else if (kind === "voice-levels" && data?.volumes)
            this.emit(Events.VOLUME_INDICATOR, {
                channel: "mic",
                volumes: data.volumes,
                threshold: AUDIO_LOW_BAR,
            });
    }

    private voiceOf(uid: string) {
        let voice = this.voices.get(uid);
        if (voice) return voice;
        let sent = -1;
        voice = {
            relayedVoice: true,
            uid,
            setVolume: (value: number) => {
                const volume = Math.min(1, Math.max(0, Number(value) || 0));
                // Silence and full volume are always said; steps between
                // them only when they can be heard.
                if (
                    volume === sent ||
                    (volume > 0 &&
                        volume < 1 &&
                        Math.abs(volume - sent) < VOLUME_STEP)
                )
                    return;
                sent = volume;
                this.link.send("voice-volume", { uid, volume });
            },
            getTracks: () => [],
        };
        this.voices.set(uid, voice);
        return voice;
    }

    /** Everyone whose microphone is on, as the engine reads them. */
    get micStreams(): Record<string, RelayedVoiceStream> {
        return Object.fromEntries(this.voices);
    }
    // Sharing a screen into a framed world has no answer yet: a stream
    // cannot cross into the frame.
    get loopbackStreams() {
        return {};
    }
    get localMicStream() {
        return null;
    }
    get localLoopbackStream() {
        return null;
    }

    async join(
        opts: { isPublisher?: boolean },
        abort?: AbortController | null
    ) {
        if (abort?.signal.aborted) throw new Error("voice join aborted");
        this.state = VoiceChatState.Connecting;
        await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, JOIN_WAIT_MS);
            this.joined = () => {
                clearTimeout(timer);
                resolve();
            };
            this.link.send("voice-join");
        });
        this.joined = null;
        if (abort?.signal.aborted) {
            this.state = VoiceChatState.Disconnected;
            throw new Error("voice join aborted");
        }
        this.state = VoiceChatState.Connected;
        await this.setRole(opts?.isPublisher ? "host" : "audience");
        return true;
    }

    /** "host": the world's rules let this visitor speak. */
    async setRole(role: Role) {
        this.role = role;
        this.link.send("voice-allow", { allowed: role === "host" });
    }

    async getToken(): Promise<Record<ChannelType, string>> {
        return { mic: "", stream: "" };
    }

    async enableVoice() {
        if (this.state === VoiceChatState.Connected) await this.setRole("host");
    }

    async disableVoice() {
        if (this.state === VoiceChatState.Connected)
            await this.setRole("audience");
    }

    leave() {
        this.removeAllListeners();
        this.state = VoiceChatState.Disconnected;
        this.role = "audience";
        this.live = false;
        this.voices.clear();
        this.gates.clear();
        this.link.send("voice-leave");
        return Promise.resolve([]);
    }

    isVoiceEnabled() {
        return this.role === "host";
    }

    isMuted() {
        return !this.live;
    }

    /** A world may mute its visitor. Unmuting is the page's own button. */
    async setMuted(muted: boolean) {
        if (muted) this.link.send("voice-mute");
    }

    setMicGated(uid: string, gated: boolean) {
        if (this.gates.get(uid) === gated) return;
        this.gates.set(uid, gated);
        this.link.send("voice-gate", { uid, gated });
    }

    async setPlaying() {
        return false;
    }
    isPlaying() {
        return false;
    }
    async getMicrophones() {
        return [];
    }
    async getPlaybackDevices() {
        return [];
    }
    async setPlaybackDevice() {}
    async setMicrophoneDevice() {}
}
