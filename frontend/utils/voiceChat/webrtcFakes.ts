// Hand-rolled WebRTC fakes for testing WebRTCClient in a node jest
// environment (jsdom provides neither RTCPeerConnection nor MediaStream).

let idCounter = 0;

export class FakeTrack {
    kind: string;
    enabled = true;
    muted = false;
    readyState = "live";
    id = "track-" + ++idCounter;

    stop = jest.fn(() => {
        this.readyState = "ended";
    });

    constructor(kind = "audio") {
        this.kind = kind;
    }
}

export class FakeMediaStream {
    id: string;
    onremovetrack: (() => void) | null = null;
    private tracks: FakeTrack[];

    constructor(tracks: FakeTrack[] = [], id?: string) {
        this.id = id || "stream-" + ++idCounter;
        this.tracks = tracks;
    }

    getTracks() {
        return [...this.tracks];
    }

    getAudioTracks() {
        return this.tracks.filter((t) => t.kind === "audio");
    }

    addTrack(track: FakeTrack) {
        this.tracks.push(track);
    }

    removeTrack(track: FakeTrack) {
        this.tracks = this.tracks.filter((t) => t !== track);
    }
}

export class FakeSender {
    track: FakeTrack | null;

    constructor(track: FakeTrack) {
        this.track = track;
    }

    replaceTrack = jest.fn(async (track: FakeTrack | null) => {
        this.track = track;
    });

    getParameters() {
        return { encodings: [] } as any;
    }

    setParameters = jest.fn(async () => {});
}

export class FakeTransceiver {
    mid: string | null = null;

    constructor(public sender: FakeSender) {}
}

export class FakePC {
    static instances: FakePC[] = [];

    static reset() {
        FakePC.instances = [];
    }

    signalingState = "stable";
    iceConnectionState = "new";
    localDescription: any = null;
    remoteDescription: any = null;
    closed = false;

    onicecandidate: any = null;
    ontrack: any = null;
    onnegotiationneeded: any = null;
    oniceconnectionstatechange: any = null;
    onsignalingstatechange: any = null;

    private senders: FakeSender[] = [];
    private transceivers: FakeTransceiver[] = [];
    private negotiationScheduled = false;

    constructor(public config: any) {
        FakePC.instances.push(this);
    }

    addTrack(track: FakeTrack, stream: FakeMediaStream) {
        const sender = new FakeSender(track);
        this.senders.push(sender);
        this.transceivers.push(new FakeTransceiver(sender));
        this._scheduleNegotiation();
        return sender;
    }

    removeTrack(sender: FakeSender) {
        sender.track = null;
        this._scheduleNegotiation();
    }

    getSenders() {
        return [...this.senders];
    }

    getTransceivers() {
        return [...this.transceivers];
    }

    restartIce = jest.fn(() => {
        this._scheduleNegotiation();
    });

    // negotiationneeded coalesces and only fires from a stable state,
    // mirroring the browser's operations-chain behavior
    private _scheduleNegotiation() {
        if (this.negotiationScheduled) return;
        this.negotiationScheduled = true;
        queueMicrotask(() => {
            this.negotiationScheduled = false;
            if (this.signalingState === "stable" && !this.closed) {
                this.onnegotiationneeded?.();
            }
        });
    }

    private _assignMids() {
        this.transceivers.forEach((t, i) => {
            if (t.mid == null) t.mid = String(i);
        });
    }

    private _buildSdp(): string {
        this._assignMids();
        const lines = ["v=0", "o=- 0 0 IN IP4 127.0.0.1", "s=-", "t=0 0"];
        this.transceivers.forEach((t) => {
            lines.push(
                "m=audio 9 UDP/TLS/RTP/SAVPF 111",
                `a=mid:${t.mid}`,
                "a=rtpmap:111 opus/48000/2",
                "a=fmtp:111 minptime=10"
            );
        });
        return lines.join("\r\n") + "\r\n";
    }

    async createOffer() {
        return { type: "offer", sdp: this._buildSdp() };
    }

    async createAnswer() {
        return { type: "answer", sdp: this._buildSdp() };
    }

    async setLocalDescription(desc?: any) {
        if (this.closed) throw new Error("Peer connection is closed");
        if (!desc) {
            desc =
                this.signalingState === "have-remote-offer"
                    ? await this.createAnswer()
                    : await this.createOffer();
        }
        this.localDescription = desc;
        this.signalingState =
            desc.type === "offer" ? "have-local-offer" : "stable";
        this._assignMids();
    }

    async setRemoteDescription(desc: any) {
        if (this.closed) throw new Error("Peer connection is closed");
        this.remoteDescription = desc;
        this.signalingState =
            desc.type === "offer" ? "have-remote-offer" : "stable";
        this._assignMids();
    }

    addIceCandidate = jest.fn(async (_candidate: any) => {
        if (this.closed || !this.remoteDescription)
            throw new Error("No current remote description");
    });

    close() {
        this.closed = true;
        this.signalingState = "closed";
    }

    // test helper: deliver a remote stream as if a track arrived
    receiveStream(stream: FakeMediaStream) {
        this.ontrack?.({ streams: [stream] });
    }
}

export function installGlobals() {
    (global as any).RTCPeerConnection = FakePC;
    (global as any).RTCSessionDescription = class {
        type: string;
        sdp: string;
        constructor(init: any) {
            this.type = init.type;
            this.sdp = init.sdp;
        }
    };
    (global as any).RTCIceCandidate = class {
        constructor(init: any) {
            Object.assign(this, init);
        }
    };
}
