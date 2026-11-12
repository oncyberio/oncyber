import { Failure, Result, Success } from "@utils/js";
// import VoiceChatApi from "@api/voiceChat/_api";
import type { Room } from "colyseus.js";
import { VoiceChatState, VoiceChatProvider } from "./VoiceChatProvider";
import { AgoraChannel } from "./AgoraChannel";
import { ColyseusSignaling } from "./ColyseusSignaling";
import { Role, Events, ChannelType, TypedEmitter } from "./types";

type VoiceJoinOptions = {
    channelId: string;
    uid: string;
    spaceSlug: string;
    tokens: Record<ChannelType, string>;
    isPublisher: boolean;
    room: Room;
};

export class AgoraVoiceChatProvider extends TypedEmitter {
    //

    public readonly Events = Events;

    public state: VoiceChatState = VoiceChatState.Disconnected;

    public role: Role = "audience";
    private generation = 0;
    private micRequest = 0;
    private shareRequest = 0;
    private roleRequest = 0;
    private session: VoiceJoinOptions | null = null;
    private joining: Promise<unknown> | null = null;

    private _channels: [AgoraChannel, AgoraChannel] = [
        new AgoraChannel(this, {
            type: "mic",
            isPrimary: true,
            enableVolumeStats: true,
        }),
        new AgoraChannel(this, {
            type: "stream",
            isPrimary: false,
            enableVolumeStats: false,
        }),
    ];

    public channels = {
        mic: this._channels[0],
        stream: this._channels[1],
    };

    async setRole(role: Role) {
        //
        const generation = this.generation;
        const request = ++this.roleRequest;
        await Promise.all(
            this._channels.map((ch) => {
                return ch.setRole(role);
            })
        );

        if (generation === this.generation && request === this.roleRequest) {
            this.role = role;
        }
    }

    async getToken(
        uid: string,
        spaceSlug: string,
        isPublisher = false,
        abortController: AbortController | null
    ): Promise<Record<ChannelType, string>> {
        //
        /*
        const channelNames = this._channels.map((chan) => {
            return chan.roomId;
        }) as [string, string];

        const tokens = await VoiceChatApi.opts({
            encode: true,
            checksum: true,
            signal: abortController?.signal,
        }).authenticate({
            uid,
            channels: channelNames,
            space: spaceSlug,
            host: isPublisher,
        });

        const result = {};

        this._channels.forEach((ch, index) => {
            //
            result[ch.config.type] = tokens[index];
        });

        return result as any;
        */
        return {
            mic: "",
            stream: "",
        };
    }

    get micStreams() {
        return this._channels[0].streams;
    }

    get loopbackStreams() {
        return this._channels[1].streams;
    }

    get localMicStream() {
        return this._channels[0].localStream;
    }

    get localLoopbackStream() {
        return this._channels[1].localStream;
    }

    async join(
        opts: VoiceJoinOptions,
        abortController: AbortController | null
    ) {
        if (!opts.room) {
            throw new Error("voice requires an active multiplayer room");
        }
        if (abortController?.signal.aborted) {
            throw new Error("voice join aborted");
        }
        if (
            this.state !== VoiceChatState.Disconnected &&
            this.session?.room === opts.room &&
            this.session.uid === opts.uid &&
            this.session.channelId === opts.channelId
        ) {
            return this.joining ?? true;
        }
        // Preserve facade listeners registered for the incoming room. Channel
        // teardown itself completes synchronously, before the new init starts.
        const cleanup = this.resetSession();
        this.session = opts;
        this.state = VoiceChatState.Connecting;
        this.joining = this.joinSession(
            opts,
            abortController,
            this.generation,
            cleanup
        );
        return this.joining;
    }

    private async joinSession(
        opts: VoiceJoinOptions,
        abortController: AbortController | null,
        generation: number,
        cleanup: Promise<unknown>
    ) {
        let { channelId, uid, spaceSlug, tokens, isPublisher, room } = opts;
        const checkpoint = () => {
            if (
                generation !== this.generation ||
                abortController?.signal.aborted
            ) {
                throw new Error("voice join aborted");
            }
        };
        const abort = () => {
            if (generation === this.generation) void this.leave();
        };
        abortController?.signal.addEventListener("abort", abort, {
            once: true,
        });
        try {
            await cleanup;
            checkpoint();
            this._channels.forEach((ch) => {
                //
                ch.setBaseRoomId(channelId);
            });

            if (tokens == null) {
                //
                tokens = await this.getToken(
                    uid,
                    spaceSlug,
                    isPublisher,
                    abortController
                );
            }
            checkpoint();

            // One transport for both channels (they share the WebRTCClient
            // singleton); started once on the first channel's init.
            const transport = new ColyseusSignaling(room);

            // Join an RTC channel.
            await Promise.all(
                this._channels.map((ch) => {
                    return ch.join(uid, tokens[ch.config.type], transport);
                })
            );
            checkpoint();
            await this.setRole(isPublisher ? "host" : "audience");
            checkpoint();

            this.state = VoiceChatState.Connected;
        } catch (error) {
            // A stale failure must not disconnect a subsequent room.
            if (generation === this.generation) await this.resetSession();
            throw error;
        } finally {
            abortController?.signal.removeEventListener("abort", abort);
            if (generation === this.generation) this.joining = null;
        }
    }

    private resetSession() {
        this.generation++;
        this.micRequest++;
        this.shareRequest++;
        this.roleRequest++;
        this.session = null;
        this.joining = null;
        this.state = VoiceChatState.Disconnected;
        this.role = "audience";
        return Promise.all(this._channels.map((ch) => ch.leave()));
    }

    leave() {
        this.removeAllListeners();
        return this.resetSession();
    }

    isVoiceEnabled() {
        //
        return this.role === "host";
    }

    setMicGated(uid: string, gated: boolean) {
        //
        this.channels.mic.setMicGated(uid, gated);
    }

    async enableVoice(tokens: Record<ChannelType, string>): Promise<void> {
        //
        if (this.state !== VoiceChatState.Connected) return;
        const generation = this.generation;
        const request = ++this.roleRequest;

        await Promise.all(
            this._channels.map((ch) => {
                return ch.refreshToken(tokens[ch.config.type]);
            })
        );
        if (
            generation !== this.generation ||
            request !== this.roleRequest ||
            this.state !== VoiceChatState.Connected
        )
            return;
        await this.setRole("host");
    }

    async disableVoice(): Promise<void> {
        //
        this.micRequest++;
        this.shareRequest++;
        const generation = this.generation;
        const request = ++this.roleRequest;
        if (this.state !== VoiceChatState.Connected) return;
        await Promise.all(this._channels.map((ch) => ch.unpublish()));
        if (
            generation !== this.generation ||
            request !== this.roleRequest ||
            this.state !== VoiceChatState.Connected
        )
            return;
        await this.setRole("audience");
    }

    async getMicrophones(skipPermissionCheck?: boolean) {
        // return AgoraRTC.getMicrophones(skipPermissionCheck);
        return [];
    }

    async getPlaybackDevices(skipPermissionCheck?: boolean) {
        // return AgoraRTC.getPlaybackDevices(skipPermissionCheck);
        return [];
    }

    private async enableLoopback(audioOnly: boolean): Promise<boolean> {
        //

        const channel = this._channels[1];

        // Create a local audio track from the audio sampled by a microphone.
        if (channel.hasStream) return true;
        const generation = this.generation;
        const request = ++this.shareRequest;
        const current = () =>
            generation === this.generation &&
            request === this.shareRequest &&
            this.state === VoiceChatState.Connected;

        let audioTrack: MediaStreamTrack;

        let videoTrack: MediaStreamTrack;

        // const result = await AgoraRTC.createScreenVideoTrack(
        //     {},
        //     audioOnly ? "enable" : "auto"
        // ).catch((err) => {
        //     console.error(err);
        //     throw new Error("No Audio was shared");
        // });

        let opts: any = {
            video: true,
            audio: true,
        };

        if ((window as any).CaptureController) {
            opts.controller = new (window as any).CaptureController();
        }

        const stream = await navigator.mediaDevices.getDisplayMedia(opts);
        if (!current()) {
            stream.getTracks().forEach((track) => track.stop());
            return false;
        }

        const _videoTrack = stream.getVideoTracks()?.[0];

        const _audioTrack = stream.getAudioTracks()?.[0];

        const settings = _videoTrack?.getSettings() ?? {};

        const displaySurface = (settings as any).displaySurface;

        if (displaySurface == "browser" || displaySurface == "window") {
            try {
                opts.controller?.setFocusBehavior("no-focus-change");
            } catch {
                // Focus policy is optional; capture still owns these tracks.
            }
        }

        if (audioOnly && _audioTrack == null) {
            //
            stream.getTracks().forEach((track) => {
                track.stop();
            });

            if (displaySurface === "window") {
                throw new Error(
                    "No Audio was shared. Either select 'Entire screen' or a browser tab in order to share audio"
                );
            }

            const shareAudioPrompt =
                displaySurface === "browser"
                    ? "Share tab audio"
                    : displaySurface === "monitor"
                    ? "Share system audio"
                    : "Share audio";

            throw new Error(
                `No Audio was shared. Make sure to check '${shareAudioPrompt}' on the sharing screen`
            );
        }

        if (!audioOnly) {
            videoTrack = _videoTrack;
        }

        if (_audioTrack) {
            audioTrack = _audioTrack;
        }

        const shareStream = new MediaStream();

        if (audioTrack) {
            shareStream.addTrack(audioTrack);
        }

        if (videoTrack) {
            shareStream.addTrack(videoTrack);
        }

        const ended = async () => {
            if (!current() || channel.localStream !== shareStream) return;
            await this.disableLoopback();
            if (
                generation === this.generation &&
                this.shareRequest === request + 1
            )
                this.emit(Events.SHARING_STOPPED);
        };
        _videoTrack?.addEventListener("ended", ended);
        await channel.publish(shareStream, () => {
            _videoTrack?.removeEventListener("ended", ended);
            stream.getTracks().forEach((track) => track.stop());
        });
        return current() && channel.localStream === shareStream;
    }

    private async disableLoopback(): Promise<boolean> {
        //
        this.shareRequest++;
        return this._channels[1].unpublish();
    }

    private _micDeviceId: string | null = null;

    private async _createMicrophoneStream(opts: any = null) {
        //
        const deviceId = opts?.microphoneId ?? this._micDeviceId;

        const audioConstraints = {
            audio: {
                noiseSuppression: false,
                echoCancellation: true,
                autoGainControl: false,
                channelCount: 1,
                // plain value, not {exact}: a vanished device should fall
                // back to the default instead of throwing
                ...(deviceId ? { deviceId } : {}),
            },
        };

        const stream = await navigator.mediaDevices.getUserMedia(
            audioConstraints
        );

        stream.getTracks().forEach((track) => {
            track.enabled = true;
        });

        return stream;
    }

    async setMuted(b: boolean) {
        //
        const request = ++this.micRequest;
        const generation = this.generation;
        if (this.state !== VoiceChatState.Connected) return;

        const channel = this._channels[0];

        const enabled = !b;
        //
        if (enabled && !channel.hasStream) {
            //

            const stream = await this._createMicrophoneStream();
            if (
                generation !== this.generation ||
                request !== this.micRequest ||
                this.state !== VoiceChatState.Connected
            ) {
                stream.getTracks().forEach((track) => track.stop());
                return;
            }
            await channel.publish(stream);
        } else {
            await channel.setEnabled(enabled);
        }
    }

    async setPlaybackDevice(deviceId: string) {
        // this.channels.mic.setPlaybackDevice(deviceId);
    }

    async setMicrophoneDevice(deviceId: string) {
        //
        // remember the choice even before connecting/publishing; it is
        // applied lazily by _createMicrophoneStream at first publish
        this._micDeviceId = deviceId;
        const request = ++this.micRequest;
        const generation = this.generation;

        if (this.state !== VoiceChatState.Connected) return;

        const channel = this._channels[0];

        if (!channel.hasStream) return;

        const previousStream = channel.localStream;
        const enabled = channel.enabled;

        const stream = await this._createMicrophoneStream({
            microphoneId: deviceId,
        });
        if (
            generation !== this.generation ||
            request !== this.micRequest ||
            this.state !== VoiceChatState.Connected ||
            channel.localStream !== previousStream
        ) {
            stream.getTracks().forEach((track) => track.stop());
            return;
        }
        const newTrack = stream.getAudioTracks()[0];

        stream.getTracks().forEach((track) => {
            if (track !== newTrack) track.stop();
        });
        if (!newTrack) return;

        newTrack.enabled = enabled !== false;

        // replaceTrack keeps the published MediaStream identity: no
        // renegotiation with any peer
        try {
            await channel.replaceTrack(newTrack);
        } catch (error) {
            newTrack.stop();
            throw error;
        }
    }

    isMuted() {
        return !this._channels[0].enabled;
    }

    async setPlaying(b: boolean, audioOnly?: boolean) {
        //
        if (this.state !== VoiceChatState.Connected) return;

        if (b) {
            return this.enableLoopback(audioOnly);
        } else {
            return this.disableLoopback();
        }
    }

    isPlaying() {
        //
        return this._channels[1].hasStream;
    }

    async updateVoiceRange(
        spaceId: string,
        range: number,
        token: string
    ): Promise<Result<unknown>> {
        //
        return Success(null);
        // return VoiceChatApi.opts({ token }).setRange({
        //     spaceId,
        //     range,
        // });
    }
}
