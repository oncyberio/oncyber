import Emitter from "events";
import { Role } from "./types";
import { MIC_MAX_BITRATE, mungeMicOpus } from "./sdp";
import { getTurnIceServers } from "./turnCredentials";
import type { SignalingTransport, SignalPayload } from "./ColyseusSignaling";

const RTC_CONFIG: RTCConfiguration = {
    iceServers: [
        {
            urls: [
                "stun:stun1.l.google.com:19302",
                "stun:stun2.l.google.com:19302",
            ],
        },
    ],

    // one transport per peer instead of one per media kind
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",

    // PCs are created lazily right before negotiating, so pre-gathering
    // buys nothing and multiplies STUN traffic during join storms
    iceCandidatePoolSize: 0,
};

const MAX_ICE_RESTARTS = 3;

const MAX_PENDING_DESCRIPTIONS = 8;
const MAX_PENDING_CANDIDATES = 64;
const MAX_SDP_LENGTH = 64 * 1024;

// New peer connections (first publish into a crowd, mass ungate) are
// created in batches to avoid an ICE/signaling storm in a single tick.
const PC_BATCH_SIZE = 8;
const PC_BATCH_INTERVAL = 500;
const INITIAL_OFFER_YIELD_MS = 150;

export interface PeerUser {
    uid: string;
}

interface PeerState {
    // presence-scoped: lives while the peer is in the signaling room
    user: PeerUser;
    micGated: boolean;
    remoteStreams: Record<string, string>;
    pendingCandidates: RTCIceCandidateInit[];
    operations: { tail: Promise<void>; pending: number; candidates: number };

    // connection-scoped: reset together whenever the pc is torn down
    initialOfferTimer: ReturnType<typeof setTimeout> | null;
    pc: RTCPeerConnection | null;
    makingOffer: boolean;
    ignoreOffer: boolean;
    micSender: RTCRtpSender | null;
    iceRestarts: number;
}

function isDebugEnabled() {
    try {
        return (
            typeof window !== "undefined" &&
            (window.localStorage?.getItem("webrtcdebug") != null ||
                window.location?.search.includes("webrtcdebug"))
        );
    } catch (err) {
        return false;
    }
}

export class WebRTCClient {
    //
    debug = isDebugEnabled();

    log(...args) {
        if (this.debug) {
            console.log("[WebRTCClient]", ...args);
        }
    }

    error(...args) {
        console.error("[WebRTCClient]", ...args);
    }

    private _emitter = new Emitter();
    private transport: SignalingTransport | null = null;
    userId = "";
    localUuid = null;

    state: "idle" | "connecting" | "connected" | "error" = "idle";

    ready: Promise<unknown>;

    private _rtcConfig: RTCConfiguration = RTC_CONFIG;

    private _peers: Record<string, PeerState> = Object.create(null);
    private _generation = 0;

    private _role: Role = "audience";

    private _localStreams: MediaStream[] = [];
    private _trackReplacements = new WeakMap<MediaStream, Promise<void>>();

    private _pcQueue: string[] = [];
    private _pcQueueTimer = null;

    constructor() {
        globalThis.$webrtc = this;
    }

    get uid() {
        return this.userId;
    }

    //#region emitter
    emit(event, ...args) {
        this._emitter.emit(event, ...args);
    }

    on(event, cb) {
        this._emitter.on(event, cb);
        return () => {
            this.off(event, cb);
        };
    }

    off(event, cb) {
        return this._emitter.off(event, cb);
    }
    //#endregion

    setRole(role: Role) {
        //
        this._role = role;
    }

    // The transport (a live Colyseus room) is already connected, so this is
    // synchronous apart from the one-shot TURN fetch.
    init(opts: {
        transport: SignalingTransport;
        userId: string;
        turnBaseUrl?: string;
    }) {
        //
        if (this.state === "connecting" || this.state === "connected") {
            return this.ready;
        }

        this.state = "connected";
        this.userId = opts.userId;
        this.transport = opts.transport;
        const generation = ++this._generation;
        const transport = opts.transport;
        const current = () =>
            this._generation === generation &&
            this.transport === transport &&
            this.state === "connected";

        this.ready = (async () => {
            // TURN must be merged before any PC exists — restartIce re-gathers
            // with the same config, so a STUN-only PC never learns relay
            // candidates. Spread the base config so the bundle/mux/pool
            // policies survive; fail open to STUN.
            const turn = await getTurnIceServers(2500, opts.turnBaseUrl);
            if (!current()) return;

            this._rtcConfig = {
                ...RTC_CONFIG,
                iceServers: [...RTC_CONFIG.iceServers, ...turn],
            };

            transport.initialPeers().forEach(this._onPeerJoin);
            transport.start({
                onSignal: (from, payload) => {
                    if (current()) this._onSignal(from, payload);
                },
                onPeerJoin: (id) => {
                    if (current()) this._onPeerJoin(id);
                },
                onPeerLeave: (id) => {
                    if (current()) this._onPeerLeave(id);
                },
            });
        })();

        return this.ready;
    }

    private _onPeerJoin = (userId: string) => {
        //
        if (!this._validPeerId(userId)) return;

        const existed = !!this._peers[userId];

        const peer = this._addPeerUser(userId);

        if (!existed) {
            // A peer that joins while we are already publishing must get a
            // connection now — nothing else will offer to them.
            if (this._hasStreamsFor(userId)) {
                this._queueConnection(userId);
            }
            return;
        }

        // Re-announce (rtc-ready): the peer's voice stack (re)started. An
        // offer we sent before it was listening is gone, and a completed
        // session may now be attached to a corpse — rebuild via the queue
        // (NOT a direct _recoverPeer, so a burst of re-announces in a join
        // storm doesn't recreate the ICE storm the queue prevents).
        if (
            peer.pc &&
            (peer.pc.signalingState === "have-local-offer" ||
                (peer.pc.signalingState === "stable" &&
                    this._hasStreamsFor(userId)))
        ) {
            this._resetPeerConnection(peer);
            this._queueConnection(userId);
        } else if (!peer.pc && this._hasStreamsFor(userId)) {
            this._queueConnection(userId);
        }
    };

    private _onPeerLeave = (userId: string) => {
        this._removePeer(userId);
    };

    private _onSignal = (from: string, payload: SignalPayload) => {
        if (
            this.state !== "connected" ||
            !this._validPeerId(from) ||
            !this._validSignal(payload)
        )
            return;

        // Admission belongs to the signaling roster, never to an SDP sender.
        // A full-state roster can arrive before its join callbacks.
        if (!this._peers[from]) {
            if (!this.transport?.initialPeers().includes(from)) return;
            this._onPeerJoin(from);
        }
        const peer = this._peers[from];
        this._queuePeerOperation(
            peer,
            async () => {
                switch (payload.kind) {
                    case "offer":
                        await this._onOffer(from, payload.offer);
                        break;
                    case "answer":
                        await this._onAnswer(from, payload.answer);
                        break;
                    case "candidate":
                        await this._onCandidate(from, payload.candidate);
                        break;
                }
            },
            payload.kind === "candidate"
        );
    };

    private _validPeerId(id: unknown): id is string {
        return (
            typeof id === "string" &&
            id.length > 0 &&
            id.length <= 128 &&
            id !== this.userId
        );
    }

    private _validSignal(payload: SignalPayload) {
        if (!payload || typeof payload !== "object") return false;
        if (payload.kind === "candidate") {
            const candidate = payload.candidate;
            return (
                candidate &&
                typeof candidate.candidate === "string" &&
                candidate.candidate.length <= 4096 &&
                (candidate.usernameFragment == null ||
                    (typeof candidate.usernameFragment === "string" &&
                        candidate.usernameFragment.length <= 256)) &&
                (candidate.sdpMid == null ||
                    (typeof candidate.sdpMid === "string" &&
                        candidate.sdpMid.length <= 64)) &&
                (candidate.sdpMLineIndex == null ||
                    (Number.isInteger(candidate.sdpMLineIndex) &&
                        candidate.sdpMLineIndex >= 0 &&
                        candidate.sdpMLineIndex < 128))
            );
        }
        const description =
            payload.kind === "offer"
                ? payload.offer?.offer
                : payload.kind === "answer"
                ? payload.answer
                : null;
        return (
            description?.type === payload.kind &&
            typeof description.sdp === "string" &&
            description.sdp.length > 0 &&
            description.sdp.length <= MAX_SDP_LENGTH
        );
    }

    private _isCurrentPeer(peer: PeerState, pc?: RTCPeerConnection) {
        return (
            this.state === "connected" &&
            this._peers[peer.user.uid] === peer &&
            (!pc || peer.pc === pc)
        );
    }

    private _queuePeerOperation(
        peer: PeerState,
        operation: () => Promise<void>,
        candidate = false
    ) {
        const queue = peer.operations;
        if (candidate && queue.candidates >= MAX_PENDING_CANDIDATES) return;
        if (
            !candidate &&
            queue.pending - queue.candidates >= MAX_PENDING_DESCRIPTIONS
        ) {
            // Keep SDP/negotiation capacity separate from trickle ICE. An
            // abnormal description flood resets the connection instead of
            // silently dropping its only answer and leaving it stuck.
            this._resetPeerConnection(peer);
            if (this._hasStreamsFor(peer.user.uid))
                this._queueConnection(peer.user.uid);
            return;
        }
        queue.pending++;
        if (candidate) queue.candidates++;
        queue.tail = queue.tail
            .then(async () => {
                if (this._isCurrentPeer(peer) && peer.operations === queue)
                    await operation();
            })
            .catch((error) => {
                if (this._isCurrentPeer(peer) && peer.operations === queue)
                    this.error(error);
            })
            .finally(() => {
                queue.pending--;
                if (candidate) queue.candidates--;
            });
    }

    private _addPeerUser(userId: string): PeerState {
        //
        let peer = this._peers[userId];

        if (!peer) {
            peer = this._peers[userId] = {
                user: { uid: userId },
                micGated: false,
                remoteStreams: Object.create(null),
                pendingCandidates: [],
                operations: {
                    tail: Promise.resolve(),
                    pending: 0,
                    candidates: 0,
                },
                initialOfferTimer: null,
                pc: null,
                makingOffer: false,
                ignoreOffer: false,
                micSender: null,
                iceRestarts: 0,
            };

            this.emit("user-joined", {
                uid: userId,
                hasAudio: false,
                hasVideo: false,
            });
        }

        return peer;
    }

    private _removePeer(userId: string) {
        //
        const peer = this._peers[userId];

        if (!peer) return;

        this._cancelInitialOffer(peer);
        if (peer.pc) {
            this._removePeerConnection(peer.pc);
        }

        peer.pendingCandidates = [];

        delete this._peers[userId];

        this._pcQueue = this._pcQueue.filter((uid) => uid !== userId);

        this.emit("user-left", peer.user, "left");
    }

    // Deterministic role for offer-collision (glare) handling: exactly one
    // side of each pair is polite and yields by rolling back its own offer.
    private _isPolite(userId: string) {
        return this.userId < userId;
    }

    private _ensurePeerConnection(
        userId: string,
        opts: { syncStreams?: boolean } = {}
    ): RTCPeerConnection {
        //
        const peer = this._addPeerUser(userId);

        if (peer.pc) return peer.pc;

        return this._createPeerConnection(userId, opts.syncStreams !== false);
    }

    private _createPeerConnection(userId: string, syncStreams: boolean) {
        //
        this.log("createPeerConnection", userId);

        const peer = this._addPeerUser(userId);

        this._cancelInitialOffer(peer);
        let pc = new RTCPeerConnection(this._rtcConfig);

        peer.pc = pc;
        peer.makingOffer = false;
        peer.ignoreOffer = false;
        peer.micSender = null;
        peer.iceRestarts = 0;

        pc.onicecandidate = (event) => {
            if (!this._isCurrentPeer(peer, pc)) return;
            this.log("onicecandidate", event);
            if (event.candidate) {
                this._sendSignal(userId, {
                    kind: "candidate",
                    candidate: event.candidate.toJSON(),
                });
            }
        };

        pc.ontrack = (event) => {
            if (!this._isCurrentPeer(peer, pc)) return;
            const stream = event.streams[0];
            if (!stream) return;
            const mediaType = peer.remoteStreams[stream.id];
            if (!mediaType) return;

            this.log("ontrack", event, mediaType);

            const user = this._peers[userId]?.user;

            this.emit("user-published", user, stream, mediaType);

            stream.onremovetrack = (e) => {
                if (!this._isCurrentPeer(peer, pc)) return;
                this.log("onremovetrack", e);
                this.emit("user-unpublished", user, stream);
            };
        };

        // Single source of truth for sending offers: fires after addTrack/
        // removeTrack and on restartIce. Never create offers anywhere else,
        // or two concurrent offers race and negotiation breaks midway.
        pc.onnegotiationneeded = () => {
            if (!this._isCurrentPeer(peer, pc)) return;
            this._queuePeerOperation(peer, async () => {
                if (
                    !this._isCurrentPeer(peer, pc) ||
                    pc.signalingState !== "stable"
                )
                    return;
                try {
                    peer.makingOffer = true;
                    await pc.setLocalDescription();
                    if (!this._isCurrentPeer(peer, pc)) return;
                    this._sendSignal(userId, {
                        kind: "offer",
                        offer: {
                            offer: pc.localDescription,
                            map: { ...this._streamMap },
                        },
                    });
                } catch (err) {
                    if (this._isCurrentPeer(peer, pc))
                        this.error("Error during negotiation:", err);
                } finally {
                    if (this._isCurrentPeer(peer, pc)) peer.makingOffer = false;
                }
            });
        };

        pc.oniceconnectionstatechange = () => {
            const current = peer;
            if (!this._isCurrentPeer(peer, pc)) return;

            if (pc.iceConnectionState === "connected") {
                current.iceRestarts = 0;
            }

            if (pc.iceConnectionState === "failed") {
                // STUN-only meshes have pairs that can never connect;
                // don't churn signaling forever
                if (current.iceRestarts++ < MAX_ICE_RESTARTS) {
                    pc.restartIce();
                }
            }
        };

        if (syncStreams) {
            this._syncUserStream(pc, userId);
        }

        return pc;
    }

    private _removePeerConnection(pc: RTCPeerConnection) {
        pc.ontrack = null;
        pc["onremovetrack"] = null;
        pc.onicecandidate = null;
        pc.onnegotiationneeded = null;
        pc.oniceconnectionstatechange = null;
        pc.onsignalingstatechange = null;
        pc.close();
    }

    private _cancelInitialOffer(peer: PeerState) {
        if (peer.initialOfferTimer == null) return;
        clearTimeout(peer.initialOfferTimer);
        peer.initialOfferTimer = null;
    }

    private _resetPeerConnection(peer: PeerState) {
        this._cancelInitialOffer(peer);
        if (peer.pc) this._removePeerConnection(peer.pc);
        peer.pc = null;
        peer.makingOffer = false;
        peer.ignoreOffer = false;
        peer.micSender = null;
        peer.iceRestarts = 0;
        peer.pendingCandidates = [];
        peer.remoteStreams = Object.create(null);
        peer.operations = {
            tail: Promise.resolve(),
            pending: 0,
            candidates: 0,
        };
    }

    // Tears down a poisoned connection and rebuilds it so a lost or
    // mismatched signaling round converges instead of deadlocking.
    private _recoverPeer(userId: string) {
        //
        const peer = this._peers[userId];

        if (!peer || !peer.pc) return;

        this.log("Recovering peer connection for", userId);

        this._resetPeerConnection(peer);

        if (this._hasStreamsFor(userId)) {
            this._queueConnection(userId);
        }
    }

    private _applyRemoteMap(peer: PeerState, map: Record<string, string>) {
        if (!map || typeof map !== "object" || Array.isArray(map)) return;
        peer.remoteStreams = Object.create(null);
        // One microphone and one shared stream are normal; leave room for
        // replacement tracks without accepting an unbounded remote map.
        for (const id of Object.keys(map).slice(0, 8)) {
            if (id.length <= 256 && (map[id] === "mic" || map[id] === "stream"))
                peer.remoteStreams[id] = map[id];
        }
    }

    // Mids of m-sections that carry OUR mic. Munging the remote SDP on
    // these mids is what caps our own encoder (libwebrtc configures the
    // encoder from the last applied remote description).
    private _micMids(pc: RTCPeerConnection, userId: string): Set<string> {
        //
        const mids = new Set<string>();

        const micSender = this._peers[userId]?.micSender;

        pc.getTransceivers().forEach((t) => {
            if (!t.mid) return;

            if (micSender && t.sender === micSender) {
                mids.add(t.mid);
                return;
            }

            const track = t.sender?.track;

            if (track && this._isLocalMicTrack(track)) {
                mids.add(t.mid);
            }
        });

        return mids;
    }

    private _isLocalMicTrack(track: MediaStreamTrack) {
        //
        return this._localStreams.some(
            (s) =>
                this._streamMap[s.id] === "mic" && s.getTracks().includes(track)
        );
    }

    private _safeMunge(pc: RTCPeerConnection, userId: string, sdp: string) {
        //
        try {
            return mungeMicOpus(sdp, this._micMids(pc, userId));
        } catch (err) {
            this.error("munge failed", err);
            return sdp;
        }
    }

    private _onOffer = async (from, data) => {
        const peer = this._peers[from];
        const created = !peer.pc;
        const pc = this._ensurePeerConnection(from, { syncStreams: false });

        try {
            this.log("onOffer from", from, data);

            // Deliver the map even when the offer is ignored below: after a
            // glare rollback, tracks announced in this offer may end up
            // riding our answer, and we need the map to label them.
            this._applyRemoteMap(peer, data.map);

            const offerCollision =
                peer.makingOffer || pc.signalingState !== "stable";

            peer.ignoreOffer = !this._isPolite(from) && offerCollision;

            if (peer.ignoreOffer) {
                this.log("Ignoring colliding offer from", from);
                return;
            }

            const munged = {
                type: data.offer.type,
                sdp: this._safeMunge(pc, from, data.offer.sdp),
            };

            // setRemoteDescription rolls back our own pending offer
            // implicitly when we are the polite peer.
            await pc.setRemoteDescription(new RTCSessionDescription(munged));
            if (!this._isCurrentPeer(peer, pc)) return;
            await this._flushCandidates(peer, pc);
            if (!this._isCurrentPeer(peer, pc)) return;

            await pc.setLocalDescription();
            if (!this._isCurrentPeer(peer, pc)) return;

            if (peer.micSender) this._capMicBitrate(peer.micSender);
            this._sendSignal(from, {
                kind: "answer",
                answer: pc.localDescription,
            });

            if (created) {
                // Our streams go out in a follow-up offer that carries the
                // stream map — tracks riding an answer would be unlabeled.
                this._syncUserStream(pc, from);
            }
        } catch (err) {
            if (this._isCurrentPeer(peer, pc)) {
                this.error(err);
                this._recoverPeer(from);
            }
        }
    };

    private _onAnswer = async (from, data) => {
        const peer = this._peers[from];
        const pc = peer?.pc;
        if (!pc) return;
        try {
            this.log("onAnswer from", from, data);

            if (!data) return;

            if (pc.signalingState !== "have-local-offer") {
                this.log("Stale answer from", from, "in", pc.signalingState);
                return;
            }

            const munged = {
                type: data.type,
                sdp: this._safeMunge(pc, from, data.sdp),
            };

            await pc.setRemoteDescription(new RTCSessionDescription(munged));
            if (!this._isCurrentPeer(peer, pc)) return;
            peer.ignoreOffer = false;
            // A sender attached after answering may not have encodings yet
            // when addTrack first tries setParameters. Apply the cap again
            // once its offer has been accepted by the remote peer.
            if (peer.micSender) this._capMicBitrate(peer.micSender);
            await this._flushCandidates(peer, pc);
        } catch (err) {
            if (this._isCurrentPeer(peer, pc)) {
                this.error(err);
                this._recoverPeer(from);
            }
        }
    };

    private _onCandidate = async (from, data) => {
        if (!data) return;

        const peer = this._peers[from];
        const pc = peer?.pc;
        if (!peer) return;
        if (
            !pc?.remoteDescription ||
            peer.ignoreOffer ||
            !this._candidateMatches(pc, data)
        ) {
            if (peer.pendingCandidates.length < MAX_PENDING_CANDIDATES)
                peer.pendingCandidates.push(data);
            return;
        }
        await this._addCandidate(peer, pc, data);
    };

    private _iceFragments(sdp: string) {
        return (sdp.match(/^a=ice-ufrag:(.+)$/gm) || [])
            .slice(0, 8)
            .map((line) => line.slice(12).trim());
    }

    private _candidateMatches(
        pc: RTCPeerConnection,
        data: RTCIceCandidateInit
    ) {
        const fragments = this._iceFragments(pc.remoteDescription?.sdp || "");
        return (
            !data.usernameFragment ||
            !fragments.length ||
            fragments.includes(data.usernameFragment)
        );
    }

    private async _addCandidate(
        peer: PeerState,
        pc: RTCPeerConnection,
        data: RTCIceCandidateInit
    ) {
        if (!this._isCurrentPeer(peer, pc)) return;
        // ICE restarts can leave old trickle candidates in transit. Modern
        // browsers include their generation so they need not poison this one.
        if (!this._candidateMatches(pc, data)) return;
        try {
            await pc.addIceCandidate(new RTCIceCandidate(data));
        } catch (err) {
            // Candidates that belong to an offer we deliberately ignored
            // (glare) are expected to fail.
            if (this._isCurrentPeer(peer, pc) && !peer.ignoreOffer) {
                this.error(err);
            }
        }
    }

    private async _flushCandidates(peer: PeerState, pc: RTCPeerConnection) {
        const candidates = peer.pendingCandidates;
        peer.pendingCandidates = [];
        for (const candidate of candidates) {
            if (!this._isCurrentPeer(peer, pc)) return;
            await this._addCandidate(peer, pc, candidate);
        }
    }

    private _sendSignal(to: string, payload: SignalPayload) {
        this.transport?.send(to, payload);
    }

    private _streamMap: Record<string, string> = Object.create(null);

    publish(stream: MediaStream, mediaType: string) {
        //
        if (this._localStreams.includes(stream)) return;

        this._localStreams.push(stream);
        this._streamMap[stream.id] = mediaType;

        this._publish(stream);
    }

    unpublish(stream: MediaStream) {
        //
        if (!this._localStreams.includes(stream)) return;
        this._unpublish(stream);
        this._localStreams = this._localStreams.filter((s) => s !== stream);
        delete this._streamMap[stream.id];
    }

    private _publish(stream: MediaStream) {
        //
        this.log("publish", stream);

        const isMic = this._streamMap[stream.id] === "mic";

        Object.keys(this._peers).forEach((uid) => {
            const peer = this._peers[uid];

            if (peer.pc) {
                this._sendStream(stream, peer.pc, uid);
            } else if (!isMic || this._shouldSendMicTo(uid)) {
                // laziness only — correctness is enforced in _sendStream
                this._queueConnection(uid);
            }
        });
    }

    private _unpublish(stream: MediaStream) {
        //
        this.log("unpublish");

        stream.getTracks().forEach((track) => {
            track.stop();
        });

        const isMic = this._streamMap[stream.id] === "mic";

        Object.values(this._peers).forEach((peer) => {
            const pc = peer.pc;
            if (!pc) return;

            if (isMic && peer.micSender) {
                // a soft-gated sender has a null track and would never be
                // found by track identity
                pc.removeTrack(peer.micSender);
                peer.micSender = null;
                return;
            }

            stream.getTracks().forEach((track) => {
                const sender = pc.getSenders().find((s) => s.track === track);
                if (sender) {
                    pc.removeTrack(sender);
                }
            });
        });
    }

    /** Optional policy for peers that may hear us only when allowed (e.g. lobby
     * stage listeners). Checked before a connection is first offered. */
    micAllowed: ((userId: string) => boolean) | null = null;

    private _shouldSendMicTo(userId: string) {
        //
        return (
            !this._peers[userId]?.micGated &&
            (this.micAllowed?.(userId) ?? true)
        );
    }

    private _hasStreamsFor(userId: string) {
        //
        return this._localStreams.some((s) => {
            const type = this._streamMap[s.id];
            return (
                type === "stream" ||
                (type === "mic" && this._shouldSendMicTo(userId))
            );
        });
    }

    private _sendStream(
        stream: MediaStream,
        pc: RTCPeerConnection,
        userId: string
    ) {
        //
        const peer = this._peers[userId];

        const isMic = this._streamMap[stream?.id] === "mic";

        // The single correctness gate for mic media: every attach path
        // (_publish, _syncUserStream, ungating) funnels through here.
        if (isMic && !this._shouldSendMicTo(userId)) return;

        stream?.getTracks().forEach((track) => {
            if (pc.getSenders().some((s) => s.track === track)) return;

            if (isMic && track.kind === "audio") {
                if (peer?.micSender) {
                    if (peer.micSender.track !== track) {
                        this._replaceMicTrack(peer, track);
                    }
                    return;
                }

                const sender = pc.addTrack(track, stream);
                if (peer) peer.micSender = sender;
                this._capMicBitrate(sender);
                return;
            }

            pc.addTrack(track, stream);
        });
    }

    private _replaceMicTrack(peer: PeerState, track: MediaStreamTrack | null) {
        const pc = peer.pc;
        const sender = peer.micSender;
        const failed = (error: unknown) => {
            if (!this._isCurrentPeer(peer, pc) || peer.micSender !== sender)
                return;
            this.error(error);
            this._recoverPeer(peer.user.uid);
        };
        try {
            sender.replaceTrack(track)?.catch(failed);
        } catch (error) {
            failed(error);
        }
    }

    // Belt for the SDP munge: caps our mic bitrate even when the remote is
    // an old client that doesn't munge what it sends us.
    private _capMicBitrate(sender: RTCRtpSender) {
        //
        try {
            const params = sender.getParameters();

            if (!params.encodings || params.encodings.length === 0) {
                params.encodings = [{} as RTCRtpEncodingParameters];
            }

            params.encodings[0].maxBitrate = MIC_MAX_BITRATE;

            const result = sender.setParameters(params);
            result?.catch?.(() => {});
        } catch (err) {
            // best effort
        }
    }

    // Adds our published streams to a connection (gating-blind: the mic
    // gate lives in _sendStream). addTrack fires onnegotiationneeded,
    // which sends the offer.
    private _syncUserStream(pc: RTCPeerConnection, userId: string) {
        //
        this._localStreams.forEach((stream) => {
            this._sendStream(stream, pc, userId);
        });
    }

    //#region gating

    setMicGated(uid: string, gated: boolean) {
        //
        if (this.state !== "connected") return;

        const peer = this._peers[uid];
        if (!peer) return;

        peer.micGated = gated;

        if (gated) {
            if (peer.micSender?.track) {
                this.log("gating mic to", uid);
                this._replaceMicTrack(peer, null);
            }
            return;
        }

        const micStream = this._localStreams.find(
            (s) => this._streamMap[s.id] === "mic"
        );

        if (!micStream) return;

        if (!peer.pc) {
            this._queueConnection(uid);
            return;
        }

        if (peer.micSender) {
            const track = micStream.getAudioTracks()[0] || null;
            if (peer.micSender.track !== track) {
                this.log("ungating mic to", uid);
                this._replaceMicTrack(peer, track);
            }
        } else {
            this._sendStream(micStream, peer.pc, uid);
        }
    }

    //#endregion

    //#region pc creation queue

    private _queueConnection(uid: string, yieldFirst = true) {
        //
        const peer = this._peers[uid];

        if (
            !peer ||
            peer.pc ||
            peer.initialOfferTimer != null ||
            this._pcQueue.includes(uid)
        )
            return;

        // Give one side of a new pair a short head start. This avoids most
        // initial glare (and Chromium ICE gathering stalls after rollback)
        // without delaying renegotiation. A lone polite publisher still
        // offers after the bounded wait; receiving an offer cancels it.
        if (yieldFirst && this._isPolite(uid)) {
            peer.initialOfferTimer = setTimeout(() => {
                peer.initialOfferTimer = null;
                if (this._isCurrentPeer(peer))
                    this._queueConnection(uid, false);
            }, INITIAL_OFFER_YIELD_MS);
            return;
        }

        this._pcQueue.push(uid);

        this._schedulePcDrain(0);
    }

    private _schedulePcDrain(delay: number) {
        //
        if (this._pcQueueTimer != null) return;

        this._pcQueueTimer = setTimeout(() => {
            this._pcQueueTimer = null;

            if (this.state !== "connected") {
                this._pcQueue = [];
                return;
            }

            let created = 0;

            while (this._pcQueue.length > 0 && created < PC_BATCH_SIZE) {
                const uid = this._pcQueue.shift();

                const peer = this._peers[uid];

                if (!peer || peer.pc || !this._hasStreamsFor(uid)) continue;

                this._ensurePeerConnection(uid);

                created++;
            }

            if (this._pcQueue.length > 0) {
                this._schedulePcDrain(PC_BATCH_INTERVAL);
            }
        }, delay);
    }

    //#endregion

    async replaceLocalTrack(stream: MediaStream, newTrack: MediaStreamTrack) {
        const generation = this._generation;
        const previous =
            this._trackReplacements.get(stream) || Promise.resolve();
        const replacement = previous
            .catch(() => {})
            .then(async () => {
                if (
                    generation !== this._generation ||
                    !this._localStreams.includes(stream)
                ) {
                    newTrack.stop();
                    return;
                }
                await this._replaceLocalTrack(stream, newTrack, generation);
            });
        this._trackReplacements.set(stream, replacement);
        return replacement;
    }

    private async _replaceLocalTrack(
        stream: MediaStream,
        newTrack: MediaStreamTrack,
        generation: number
    ) {
        if (!this._localStreams.includes(stream)) {
            this.error("replaceLocalTrack: unknown stream", stream?.id);
            return;
        }

        const oldTrack = stream
            .getTracks()
            .find((t) => t.kind === newTrack.kind);
        const senders = Object.values(this._peers).flatMap((peer) => {
            const pc = peer.pc;
            const sender = pc
                ?.getSenders()
                .find((s) => s.track != null && s.track === oldTrack);
            return sender ? [{ peer, pc, sender }] : [];
        });
        // A disappearing peer must not reject the whole device switch after
        // other senders already adopted the new microphone.
        const results = await Promise.allSettled(
            senders.map(async ({ sender }) => sender.replaceTrack(newTrack))
        );
        if (
            generation !== this._generation ||
            !this._localStreams.includes(stream)
        ) {
            newTrack.stop();
            return;
        }

        if (oldTrack) {
            oldTrack.stop();
            stream.removeTrack(oldTrack);
        }

        // Stable stream identity avoids renegotiating healthy connections.
        stream.addTrack(newTrack);
        results.forEach((result, index) => {
            const { peer, pc } = senders[index];
            if (result.status === "rejected" && this._isCurrentPeer(peer, pc))
                this._recoverPeer(peer.user.uid);
        });
    }

    leave() {
        //
        if (this.state === "idle") return;
        // Invalidate continuations before stopping tracks or closing PCs.
        this._generation++;
        this.state = "idle";

        this._localStreams.forEach((stream) => {
            stream?.getTracks().forEach((track) => {
                track.stop();
            });
        });

        Object.values(this._peers).forEach((peer) => {
            this._cancelInitialOffer(peer);
            if (peer.pc) {
                this._removePeerConnection(peer.pc);
            }
        });

        try {
            // detach signaling handlers — never leaves the room (the room
            // is owned by the multiplayer layer)
            this.transport?.dispose();
        } catch (err) {
            this.error(err);
        }

        this._emitter.removeAllListeners();

        if (this._pcQueueTimer != null) {
            clearTimeout(this._pcQueueTimer);
            this._pcQueueTimer = null;
        }

        // Reset everything so the next init() builds a fresh session —
        // without this, rejoining a space reuses stale state and voice is
        // silently dead for the rest of the browser session.
        this._peers = Object.create(null);
        this._pcQueue = [];
        this._localStreams = [];
        this._trackReplacements = new WeakMap();
        this._streamMap = Object.create(null);
        this.transport = null;
        this._rtcConfig = RTC_CONFIG;
        this.ready = null;
        this.userId = "";
        this.state = "idle";
    }

    private static _instance: WebRTCClient;

    static get instance() {
        if (!WebRTCClient._instance) {
            WebRTCClient._instance = new WebRTCClient();
        }

        return WebRTCClient._instance;
    }
}
