import {
    UserStreams,
    ChannelType,
    Role,
    Events,
    TypedEmitter,
    VolumeStats,
} from "./types";
import { PeerUser, WebRTCClient } from "./WebRTCClient";
import type { SignalingTransport } from "./ColyseusSignaling";
import { AUDIO_LOW_BAR, decibelsToLevel } from "./levels";

export interface ChannelConfig {
    readonly type: ChannelType;
    readonly isPrimary: boolean;
    readonly enableVolumeStats: boolean;
}

/** Speaking indicators are sampled four times a second, never per frame. */
const VOLUME_SAMPLE_MS = 250;

/** About 170ms of audio at 48kHz: most of the time between two samples. */
const VOLUME_WINDOW = 8192;

/** The inputs that let a browser resume a suspended AudioContext. */
const GESTURE_EVENTS = ["pointerdown", "pointerup", "keydown"];

interface VolumeMeter {
    stream: MediaStream;
    track: MediaStreamTrack;
    source?: MediaStreamAudioSourceNode;
    analyser: AnalyserNode | null;
}

function getAudioContextClass(): typeof AudioContext | undefined {
    const scope = globalThis as any;

    return scope.AudioContext || scope.webkitAudioContext;
}

export class AgoraChannel {
    //

    private _joinId: string;

    private client: WebRTCClient;
    private generation = 0;
    private joined = false;

    private token: string;

    public streams: Record<string, MediaStream> = {};

    public localStream: MediaStream | null;

    /** The level above which someone counts as speaking: see levels.ts. */
    public audioLowBar = AUDIO_LOW_BAR;

    private lastVolumesUpdated: number = 0;
    public volumes: Record<string, VolumeStats> = {};
    private iv: any = null;
    private audioContext: AudioContext | null = null;
    private meters: Record<string, VolumeMeter> = {};
    private samples: Float32Array | null = null;

    public _onUnpublish: () => unknown;

    private _unsubs: Array<() => void> = [];

    constructor(
        public readonly emitter: TypedEmitter,
        public readonly config: ChannelConfig
    ) {
        //
    }

    async setRole(role: Role) {
        //
        return this.client?.setRole(role);
    }

    private _getMediaType(stream: MediaStream): "audio" | "video" {
        //
        return stream.getVideoTracks().length > 0 ? "video" : "audio";
    }

    private init() {
        //

        // Guard against double registration if join() runs twice in a row.
        this._unsubs.forEach((unsub) => unsub());
        this._unsubs = [];

        const { type: channel, isPrimary, enableVolumeStats } = this.config;

        // Both channels share one WebRTCClient and one emitter, so only the
        // primary channel relays the connection-level join/leave events —
        // otherwise every event would fire twice.
        if (isPrimary) {
            this._unsubs.push(
                this.client.on("user-joined", (user) => {
                    //
                    const uid = String(user.uid);

                    this.emitter.emit(Events.USER_JOINED, uid, {
                        hasAudio: user.hasAudio,
                        hasVideo: user.hasVideo,
                    });
                })
            );
        }

        this._unsubs.push(
            this.client.on("user-left", (user, reason) => {
                const uid = String(user?.uid);

                // Disconnect can arrive without unpublish. Each channel must
                // release its own mic or screen stream and its scene surface.
                const stream = this.streams[uid];
                if (stream != null) {
                    delete this.streams[uid];

                    this.emitter.emit(Events.USER_UNPUBLISHED, uid, {
                        channel,
                        mediaType: this._getMediaType(stream),
                        stream,
                    });
                }
                if (isPrimary) {
                    this.emitter.emit(Events.USER_LEFT, uid, { reason });
                }
            })
        );

        this._unsubs.push(this.client.on(
            "user-published",
            async (user: PeerUser, stream: MediaStream, channel: string) => {
                //
                if (channel !== this.config.type) return;

                const uid = String(user.uid);

                console.log("user-published", channel, uid);

                // Store unconditionally: after a peer-connection rebuild
                // (re-announce / ICE recovery / glare) the old dead stream may
                // still be in the map, and a `== null` guard would keep it and
                // drop this fresh one — leaving the listener stuck on silence.
                this.streams[uid] = stream;

                const mediaType = this._getMediaType(stream);

                this.emitter.emit(Events.USER_PUBLISHED, uid, {
                    channel,
                    mediaType,
                    stream,
                });
            }
        ));

        this._unsubs.push(this.client.on("user-unpublished", async (user, stream) => {
            //

            const uid = String(user.uid);

            let mediaType = this._getMediaType(stream);

            if (this.streams[uid] != stream) {
                return;
            }

            if (this.streams[uid] == null) {
                //
                console.log("unpublished again WTFFFF Agora!!", uid);

                return;
            }

            console.log("user-unpublished", mediaType, user);

            delete this.streams[uid];

            this.emitter.emit(Events.USER_UNPUBLISHED, uid, {
                channel,
                mediaType,
                stream,
            });

            //
        }));

        if (enableVolumeStats) {
            this.startVolumeStats();
        }
    }

    setPlaybackDevice(id) {
        //
        Object.values(this.streams).forEach((stream) => {
            //
            // stream.audioTrack?.setPlaybackDevice(id);
        });
    }

    private startVolumeStats() {
        this.stopVolumeStats();

        // Without WebAudio there is nothing to measure, so no timer either.
        if (!getAudioContextClass()) return;

        this.iv = setInterval(() => this.sampleVolumes(), VOLUME_SAMPLE_MS);
    }

    private stopVolumeStats() {
        if (this.iv) {
            clearInterval(this.iv);

            this.iv = null;
        }

        Object.keys(this.meters).forEach((uid) => this.releaseMeter(uid));
        this.watchGestures("removeEventListener");

        const context = this.audioContext;

        this.audioContext = null;
        this.lastVolumesUpdated = 0;

        try {
            void context?.close()?.catch?.(() => {});
        } catch {
            // Already closed.
        }
    }

    private sampleVolumes() {
        try {
            const now = performance.now();

            Object.keys(this.streams).forEach((uid) => {
                //
                this.updateVolumeStats(uid, this.streams[uid], now);
            });

            //
            if (this.localStream) {
                this.updateVolumeStats(this.uid, this.localStream, now);
            }

            Object.keys(this.volumes).forEach((uid) => {
                const stream =
                    uid === this.uid ? this.localStream : this.streams[uid];

                if (stream == null) {
                    delete this.volumes[uid];
                    this.releaseMeter(uid);
                }
            });

            this.lastVolumesUpdated = now;
        } catch (error) {
            // Speaking indicators are optional; voice itself carries on. The
            // last event is empty so nobody is left marked as speaking.
            console.warn("[voice] volume stats stopped", error);
            this.stopVolumeStats();
            this.volumes = {};
        }

        try {
            this.emitter.emit(Events.VOLUME_INDICATOR, {
                channel: this.config.type,
                volumes: this.volumes,
                threshold: this.audioLowBar,
            });
        } catch (error) {
            console.error("[voice] volume listener failed", error);
        }
    }

    /** A context created before the visitor's first gesture starts suspended
     * and reads silence; browsers only let it resume from a gesture. */
    private resumeAudioContext = () => {
        const context = this.audioContext;

        if (context?.state !== "suspended") return;

        try {
            void context.resume()?.catch?.(() => {});
        } catch {
            // Still suspended; the next gesture tries again.
        }
    };

    private watchGestures(method: "addEventListener" | "removeEventListener") {
        GESTURE_EVENTS.forEach((name) => {
            globalThis[method]?.(name, this.resumeAudioContext, true);
        });
    }

    private releaseMeter(uid: string) {
        const meter = this.meters[uid];

        delete this.meters[uid];

        try {
            meter?.source?.disconnect();
        } catch {
            // The context may already be closed.
        }
    }

    private createMeter(stream: MediaStream, track: MediaStreamTrack) {
        const meter: VolumeMeter = { stream, track, analyser: null };

        if (track == null) return meter;

        try {
            if (this.audioContext == null) {
                this.audioContext = new (getAudioContextClass())();
                this.watchGestures("addEventListener");
            }

            const analyser = this.audioContext.createAnalyser();

            try {
                analyser.fftSize = VOLUME_WINDOW;
            } catch {
                // A browser that caps the window keeps its shorter default.
            }

            // Analysis only: the analyser is never connected to the context's
            // destination, so measuring a stream plays nothing.
            meter.source = this.audioContext.createMediaStreamSource(stream);
            meter.source.connect(analyser);
            meter.analyser = analyser;
        } catch (error) {
            console.warn("[voice] cannot measure volume", error);
        }

        return meter;
    }

    /** 0..1 on the scale the Agora SDK reported (decibels below full scale,
     * -100dB and quieter as 0), so `audioLowBar` keeps its meaning. */
    private measureLevel(uid: string, stream: MediaStream) {
        const track = stream.getAudioTracks()[0];

        let meter = this.meters[uid];

        // replaceTrack swaps the track inside the same stream, and a source
        // node only ever reads the track it was created with.
        if (meter?.stream !== stream || meter.track !== track) {
            this.releaseMeter(uid);

            meter = this.meters[uid] = this.createMeter(stream, track);
        }

        const { analyser } = meter;

        if (analyser == null) return 0;

        if (this.samples?.length !== analyser.fftSize) {
            this.samples = new Float32Array(analyser.fftSize);
        }

        const samples = this.samples;
        let sum = 0;

        analyser.getFloatTimeDomainData(samples);

        for (let i = 0; i < samples.length; i++) {
            sum += samples[i] * samples[i];
        }

        return decibelsToLevel(10 * Math.log10(sum / samples.length)) || 0;
    }

    /**
     * Tries another speaking threshold, from the next sample on. For tuning
     * (`?voiceDebug=<number>`): the value to keep goes in AUDIO_LOW_BAR.
     * Anything outside 0..1 is ignored. Returns the threshold in force.
     */
    setAudioLowBar(level: number) {
        if (Number.isFinite(level) && level >= 0 && level <= 1) {
            this.audioLowBar = level;
        }

        return this.audioLowBar;
    }

    private updateVolumeStats(uid: string, stream: MediaStream, now: number) {
        //
        const level = this.measureLevel(uid, stream);

        const isActive = level > this.audioLowBar;

        let stats = this.volumes[uid];

        if (stats == null) {
            //
            stats = this.volumes[uid] = {
                level: 0,
                isActive: false,
                inactiveTime: Infinity,
            };
        }

        if (this.lastVolumesUpdated > 0) {
            //
            if (!isActive && !stats.isActive) {
                stats.inactiveTime += now - this.lastVolumesUpdated;
            } else {
                stats.inactiveTime = 0;
            }
        }

        stats.level = level;
        stats.isActive = isActive;
    }

    setBaseRoomId(id: string) {
        this._joinId = this.config.isPrimary ? id : `${id}-${this.config.type}`;
    }

    get uid() {
        return this.client?.uid as string;
    }

    get roomId() {
        return this._joinId;
    }

    async refreshToken(token: string) {
        // await this.client.renewToken(token);

        this.token = token;
    }

    async join(uid: string, token: string, transport: SignalingTransport) {
        //
        const generation = ++this.generation;
        this.joined = false;
        if (this.client == null) {
            this.client = WebRTCClient.instance;
        }
        const client = this.client;

        // Both channels share the singleton; the second init() is a no-op
        // (already connected), so the transport is started exactly once.
        await client.init({
            transport,
            userId: uid,
        });
        if (generation !== this.generation || this.client !== client) {
            throw new Error("voice join aborted");
        }
        this.init();

        this.token = token;
        this.joined = true;
    }

    async leave() {
        //
        this.generation++;
        this.joined = false;
        this.stopVolumeStats();

        this._unsubs.forEach((unsub) => unsub());

        this._unsubs = [];

        // Complete cleanup before yielding: a newer room may join this same
        // facade and singleton as soon as leave() returns its promise.
        const unpublished = this.unpublish();

        // Both channels share the client singleton; leave() is idempotent so
        // whichever channel gets here second is a no-op.
        this.client?.leave?.();

        this.client = null;

        this._joinId = null;

        this.token = null;

        this.streams = {};

        this.localStream = null;

        this.volumes = {};
        await unpublished;
    }

    setMicGated(uid: string, gated: boolean) {
        //
        if (this.config.type !== "mic") return;

        this.client?.setMicGated(uid, gated);
    }

    publish(stream: MediaStream, onUnpublish?: () => unknown) {
        //
        if (this.localStream === stream) return;
        if (!this.joined || !this.client || this.localStream) {
            stream.getTracks().forEach((track) => track.stop());
            onUnpublish?.();
            return;
        }
        this._onUnpublish = onUnpublish;
        this.localStream = stream;
        try {
            return this.client.publish(stream, this.config.type);
        } catch (error) {
            this.localStream = null;
            this._onUnpublish = undefined;
            stream.getTracks().forEach((track) => track.stop());
            onUnpublish?.();
            throw error;
        }
    }

    async unpublish() {
        //
        if (this.localStream == null) return false;
        const stream = this.localStream;
        const onUnpublish = this._onUnpublish;
        this.localStream = null;
        this._onUnpublish = undefined;
        try {
            this.client?.unpublish(stream);
        } finally {
            stream.getTracks().forEach((track) => {
                if (track.readyState !== "ended") track.stop();
            });
            onUnpublish?.();
        }
        return true;
    }

    async replaceTrack(newTrack: MediaStreamTrack) {
        //
        if (!this.joined || !this.client || this.localStream == null) {
            newTrack.stop();
            return;
        }

        return this.client?.replaceLocalTrack(this.localStream, newTrack);
    }

    get hasStream() {
        return this.localStream != null;
    }

    get enabled() {
        return this.localStream?.getTracks().every((t) => t.enabled);
    }

    async setEnabled(b) {
        //
        this.localStream?.getTracks().forEach((t) => (t.enabled = b));
    }
}
