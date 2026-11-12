import { WebRTCClient } from "./WebRTCClient";
import { MIC_MAX_BITRATE } from "./sdp";
import { getTurnIceServers } from "./turnCredentials";
jest.mock("./turnCredentials", () => ({
    getTurnIceServers: jest.fn().mockResolvedValue([]),
}));
import {
    FakePC,
    FakeMediaStream,
    FakeTrack,
    installGlobals,
} from "./webrtcFakes";

installGlobals();

// Stand-in for ColyseusSignaling: records what the client sends and lets a
// test drive inbound roster/signal events.
class FakeTransport {
    sent: Array<{ to: string; payload: any }> = [];
    disposed = false;
    starts = 0;
    readonly selfId = "me";
    private handlers: any = null;
    constructor(private initial: string[] = []) {}
    start(handlers: any) {
        this.starts++;
        this.handlers = handlers;
    }
    initialPeers() {
        return [...this.initial];
    }
    send(to: string, payload: any) {
        this.sent.push({ to, payload });
    }
    dispose() {
        this.disposed = true;
    }
    // drivers
    peerJoin(id: string) {
        this.handlers.onPeerJoin(id);
    }
    peerLeave(id: string) {
        this.handlers.onPeerLeave(id);
    }
    signal(from: string, payload: any) {
        this.handlers.onSignal(from, payload);
    }
}

function deferred<T = void>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
}

const flush = async (rounds = 6) => {
    for (let i = 0; i < rounds; i++) {
        await new Promise((r) => setTimeout(r, 0));
    }
};

async function connect(
    client: WebRTCClient,
    userId = "me",
    initial: string[] = []
) {
    const transport = new FakeTransport(initial);
    await client.init({ transport: transport as any, userId });
    return transport;
}

function sentOfKind(t: FakeTransport, kind: string) {
    return t.sent.filter((m) => m.payload.kind === kind);
}

function micStream() {
    const track = new FakeTrack("audio");
    return { track, stream: new FakeMediaStream([track]) };
}

const OFFER_SDP =
    [
        "v=0",
        "o=- 0 0 IN IP4 127.0.0.1",
        "s=-",
        "t=0 0",
        "m=audio 9 UDP/TLS/RTP/SAVPF 111",
        "a=mid:0",
        "a=rtpmap:111 opus/48000/2",
        "a=fmtp:111 minptime=10",
    ].join("\r\n") + "\r\n";

function sendOffer(
    t: FakeTransport,
    from: string,
    map: Record<string, string>
) {
    t.signal(from, {
        kind: "offer",
        offer: { offer: { type: "offer", sdp: OFFER_SDP }, map },
    });
}

describe("WebRTCClient", () => {
    let client: WebRTCClient;

    beforeEach(() => {
        FakePC.reset();
        client = new WebRTCClient();
    });

    afterEach(() => {
        client.leave();
        jest.restoreAllMocks();
    });

    test("requests TURN from the selected regional deployment while preserving default callers", async () => {
        await client.init({
            transport: new FakeTransport(),
            userId: "me",
            turnBaseUrl: "https://eu.example",
        });
        expect(getTurnIceServers).toHaveBeenLastCalledWith(
            2500,
            "https://eu.example"
        );
        client.leave();
        await connect(client);
        expect(getTurnIceServers).toHaveBeenLastCalledWith(2500, undefined);
    });

    test("pure listeners create zero peer connections (initial roster path)", async () => {
        const joined: string[] = [];
        client.on("user-joined", (user) => joined.push(user.uid));

        await connect(client, "me", ["B", "C"]);
        await flush();

        expect(FakePC.instances.length).toBe(0);
        expect(joined.sort()).toEqual(["B", "C"]);
        expect(Object.keys((client as any)._peers).sort()).toEqual(["B", "C"]);
    });

    test("pure listener via a later peerJoin also makes no PC", async () => {
        const joined: string[] = [];
        client.on("user-joined", (user) => joined.push(user.uid));

        const t = await connect(client);
        t.peerJoin("B");
        await flush();

        expect(FakePC.instances.length).toBe(0);
        expect(joined).toEqual(["B"]);
    });

    test("peer leaving emits user-left and prunes state", async () => {
        const left: string[] = [];
        client.on("user-left", (user) => left.push(user.uid));

        const t = await connect(client, "me", ["B", "C"]);

        t.peerLeave("C");
        await flush();

        expect(left).toEqual(["C"]);
        expect(Object.keys((client as any)._peers)).toEqual(["B"]);
    });

    test("offer from an admitted peer creates a PC on demand and answers, then syncs local streams in a follow-up offer", async () => {
        const t = await connect(client);

        const { stream } = micStream();
        client.publish(stream as any, "mic");
        await flush();

        // no peers yet: nothing created or sent
        expect(FakePC.instances.length).toBe(0);

        t.peerJoin("D");
        sendOffer(t, "D", { "remote-1": "mic" });
        await flush();

        expect(FakePC.instances.length).toBe(1);

        const answers = sentOfKind(t, "answer");
        expect(answers.length).toBe(1);
        expect(answers[0].to).toBe("D");

        // our mic went out AFTER the answer, in an offer that carries the map
        const offers = sentOfKind(t, "offer");
        expect(offers.length).toBe(1);
        expect(offers[0].to).toBe("D");
        expect(offers[0].payload.offer.map[stream.id]).toBe("mic");

        const answerIndex = t.sent.indexOf(answers[0]);
        const offerIndex = t.sent.indexOf(offers[0]);
        expect(answerIndex).toBeLessThan(offerIndex);
    });

    test("a lone polite publisher yields once, then offers to a silent listener", async () => {
        const t = await connect(client, "A", ["Z"]);
        const { stream } = micStream();
        client.publish(stream as any, "mic");
        const peer = (client as any)._peers.Z;
        const timer = peer.initialOfferTimer;
        const share = new FakeMediaStream([new FakeTrack("audio")]);
        client.publish(share as any, "stream");
        await flush();
        expect(FakePC.instances).toHaveLength(0);
        expect(peer.initialOfferTimer).toBe(timer);
        await new Promise((resolve) => setTimeout(resolve, 170));
        await flush();
        expect(FakePC.instances).toHaveLength(1);
        expect(peer.initialOfferTimer).toBeNull();
        const offers = sentOfKind(t, "offer");
        expect(offers).toHaveLength(1);
        expect(offers[0].payload.offer.map).toEqual({
            [stream.id]: "mic",
            [share.id]: "stream",
        });
    });

    test("an incoming offer cancels the polite yield and announces local tracks after answering", async () => {
        const t = await connect(client, "A", ["Z"]);
        const { stream } = micStream();
        client.publish(stream as any, "mic");
        sendOffer(t, "Z", { remote: "mic" });
        await flush();
        expect((client as any)._peers.Z.initialOfferTimer).toBeNull();
        expect(t.sent.map(({ payload }) => payload.kind)).toEqual([
            "answer",
            "offer",
        ]);
        expect(sentOfKind(t, "offer")[0].payload.offer.map[stream.id]).toBe(
            "mic"
        );
        await new Promise((resolve) => setTimeout(resolve, 170));
        expect(FakePC.instances).toHaveLength(1);
        expect(sentOfKind(t, "offer")).toHaveLength(1);
    });

    test.each(["peer", "session"])(
        "a pending initial offer is cancelled on %s departure",
        async (departure) => {
            const t = await connect(client, "A", ["Z"]);
            const { stream } = micStream();
            client.publish(stream as any, "mic");
            const peer = (client as any)._peers.Z;
            expect(peer.initialOfferTimer).not.toBeNull();
            if (departure === "peer") t.peerLeave("Z");
            else {
                client.leave();
                await connect(client, "A", ["Z"]);
            }
            expect(peer.initialOfferTimer).toBeNull();
            await new Promise((resolve) => setTimeout(resolve, 170));
            expect(FakePC.instances).toHaveLength(0);
            expect(t.sent).toEqual([]);
        }
    );

    test("negotiation reapplies the mic encoder cap after encodings become available without capping shared audio", async () => {
        const t = await connect(client, "me", ["B"]);
        const { stream } = micStream();
        const shareTrack = new FakeTrack("audio");
        client.publish(stream as any, "mic");
        client.publish(new FakeMediaStream([shareTrack]) as any, "stream");
        await flush();
        const pc = FakePC.instances[0];
        const sender = (client as any)._peers.B.micSender;
        sender.setParameters.mockClear();
        t.signal("B", {
            kind: "answer",
            answer: { type: "answer", sdp: OFFER_SDP },
        });
        await flush();
        expect(sender.setParameters).toHaveBeenCalledWith({
            encodings: [{ maxBitrate: MIC_MAX_BITRATE }],
        });
        expect(
            pc.getSenders().find((s) => s.track === shareTrack).setParameters
        ).not.toHaveBeenCalled();
    });

    test("a failed mic gate rebuilds the current connection with shared audio and keeps its mic gated", async () => {
        const error = jest.spyOn(console, "error").mockImplementation(() => {});
        await connect(client, "me", ["B"]);
        const { stream, track } = micStream();
        const shareTrack = new FakeTrack("audio");
        client.publish(stream as any, "mic");
        client.publish(new FakeMediaStream([shareTrack]) as any, "stream");
        await flush();
        const peer = (client as any)._peers.B;
        const old = peer.pc;
        peer.micSender.replaceTrack.mockRejectedValueOnce(
            new Error("closed sender")
        );
        client.setMicGated("B", true);
        await flush();
        expect(error).toHaveBeenCalledTimes(1);
        expect(old.closed).toBe(true);
        expect(peer.pc).not.toBe(old);
        expect(peer.micGated).toBe(true);
        expect(peer.pc.getSenders().some((s) => s.track === shareTrack)).toBe(
            true
        );
        expect(peer.pc.getSenders().some((s) => s.track === track)).toBe(false);
    });

    test("a late mic gate failure cannot reset a replacement peer", async () => {
        const error = jest.spyOn(console, "error").mockImplementation(() => {});
        const t = await connect(client, "me", ["B"]);
        const { stream } = micStream();
        client.publish(stream as any, "mic");
        await flush();
        const pending = deferred();
        (client as any)._peers.B.micSender.replaceTrack.mockReturnValueOnce(
            pending.promise
        );
        client.setMicGated("B", true);
        t.peerLeave("B");
        t.peerJoin("B");
        await flush();
        const replacement = (client as any)._peers.B.pc;
        pending.reject(new Error("old sender closed"));
        await flush();
        expect(error).not.toHaveBeenCalled();
        expect((client as any)._peers.B.pc).toBe(replacement);
        expect(replacement.closed).toBe(false);
    });

    test("a peer joining while we publish gets a connection and our mic", async () => {
        const t = await connect(client);

        const { track, stream } = micStream();
        client.publish(stream as any, "mic");
        await flush();

        t.peerJoin("B");
        await flush();

        expect(FakePC.instances.length).toBe(1);

        const pc = FakePC.instances[0];
        expect(pc.getSenders().some((s) => s.track === (track as any))).toBe(
            true
        );

        expect(sentOfKind(t, "offer").length).toBe(1);
        expect((client as any)._peers["B"].micSender).toBeTruthy();
    });

    test("repeated negotiation does not duplicate senders", async () => {
        const t = await connect(client, "me", ["B"]);

        sendOffer(t, "B", { "remote-1": "mic" });
        await flush();

        const { track, stream } = micStream();
        client.publish(stream as any, "mic");
        await flush();

        // renegotiation offer from B
        sendOffer(t, "B", { "remote-1": "mic" });
        await flush();

        const pc = FakePC.instances[0];
        const micSenders = pc
            .getSenders()
            .filter((s) => s.track === (track as any));
        expect(micSenders.length).toBe(1);
    });

    test("gating replaces the mic track with null and ungating restores it without renegotiation", async () => {
        const t = await connect(client);

        const { track, stream } = micStream();
        client.publish(stream as any, "mic");
        t.peerJoin("B");
        await flush();

        const sender = (client as any)._peers["B"].micSender;
        const offersBefore = sentOfKind(t, "offer").length;

        client.setMicGated("B", true);
        expect(sender.track).toBe(null);

        client.setMicGated("B", false);
        expect(sender.track).toBe(track);

        await flush();
        expect(sentOfKind(t, "offer").length).toBe(offersBefore);
    });

    test("publish skips gated peers entirely; ungating creates the connection lazily", async () => {
        const t = await connect(client);

        t.peerJoin("B");
        await flush();

        client.setMicGated("B", true);

        const { stream } = micStream();
        client.publish(stream as any, "mic");
        await flush();

        // gated peer never got a connection
        expect(FakePC.instances.length).toBe(0);

        client.setMicGated("B", false);
        await flush();

        expect(FakePC.instances.length).toBe(1);
        expect((client as any)._peers["B"].micSender).toBeTruthy();
    });

    test("re-announce recovery rebuilds a stuck have-local-offer PC", async () => {
        const t = await connect(client);

        const { stream } = micStream();
        client.publish(stream as any, "mic");
        t.peerJoin("B");
        await flush();

        const firstPc = (client as any)._peers["B"].pc;
        // simulate the offer never being answered
        firstPc.signalingState = "have-local-offer";

        const offersBefore = sentOfKind(t, "offer").length;

        // B's voice stack restarted -> re-announce
        t.peerJoin("B");
        await flush();

        expect(firstPc.closed).toBe(true);
        const secondPc = (client as any)._peers["B"].pc;
        expect(secondPc).not.toBe(firstPc);
        expect(sentOfKind(t, "offer").length).toBeGreaterThan(offersBefore);
    });

    test("leave disposes the transport and resets state; the client can connect again", async () => {
        const t = await connect(client);

        const { stream } = micStream();
        client.publish(stream as any, "mic");
        t.peerJoin("B");
        await flush();

        expect(FakePC.instances.length).toBe(1);

        client.leave();

        expect(t.disposed).toBe(true);
        expect(client.state).toBe("idle");
        expect(Object.keys((client as any)._peers).length).toBe(0);
        expect(FakePC.instances[0].closed).toBe(true);

        const joined: string[] = [];
        client.on("user-joined", (user) => joined.push(user.uid));

        const t2 = await connect(client);
        expect(client.state).toBe("connected");

        t2.peerJoin("B");
        await flush();
        expect(joined).toEqual(["B"]);
    });

    test("replaceLocalTrack swaps live senders, skips gated ones, keeps the stream identity", async () => {
        const t = await connect(client);

        const { track, stream } = micStream();
        client.publish(stream as any, "mic");
        t.peerJoin("B");
        t.peerJoin("C");
        await flush();

        const senderB = (client as any)._peers["B"].micSender;
        const senderC = (client as any)._peers["C"].micSender;

        client.setMicGated("C", true);
        expect(senderC.track).toBe(null);

        const offersBefore = sentOfKind(t, "offer").length;
        const streamId = stream.id;

        const newTrack = new FakeTrack("audio");
        await client.replaceLocalTrack(stream as any, newTrack as any);

        expect(senderB.track).toBe(newTrack);
        expect(senderC.track).toBe(null);
        expect(track.stop).toHaveBeenCalled();
        expect(stream.id).toBe(streamId);
        expect(stream.getAudioTracks()).toEqual([newTrack]);

        // ungating after a device switch attaches the NEW track
        client.setMicGated("C", false);
        expect(senderC.track).toBe(newTrack);

        await flush();
        expect(sentOfKind(t, "offer").length).toBe(offersBefore);
    });

    test("a delayed TURN result cannot initialize a replacement session", async () => {
        const turn = deferred<RTCIceServer[]>();
        (getTurnIceServers as jest.Mock).mockReturnValueOnce(turn.promise);
        const old = new FakeTransport(["old-peer"]);
        const init = client.init({ transport: old, userId: "old-self" });
        client.leave();
        const current = await connect(client, "new-self", ["new-peer"]);
        turn.resolve([{ urls: "turn:old.example" }]);
        await init;
        expect(old.starts).toBe(0);
        expect(old.disposed).toBe(true);
        expect(current.starts).toBe(1);
        expect(client.uid).toBe("new-self");
        expect(Object.keys((client as any)._peers)).toEqual(["new-peer"]);
        const { stream } = micStream();
        client.publish(stream as any, "mic");
        await flush();
        expect(FakePC.instances[0].config.iceServers).not.toContainEqual({
            urls: "turn:old.example",
        });
    });

    test("mic and screenshare initialization share one pending session", async () => {
        const turn = deferred<RTCIceServer[]>();
        (getTurnIceServers as jest.Mock).mockReturnValueOnce(turn.promise);
        const transport = new FakeTransport(["B"]);
        const first = client.init({ transport, userId: "me" });
        const second = client.init({ transport, userId: "me" });
        expect(second).toBe(first);
        expect(transport.starts).toBe(0);
        turn.resolve([]);
        await Promise.all([first, second]);
        expect(transport.starts).toBe(1);
        expect(Object.keys((client as any)._peers)).toEqual(["B"]);
    });

    test("late callbacks from a disposed transport cannot mutate a new session", async () => {
        const old = await connect(client, "me", ["B"]);
        client.leave();
        const current = await connect(client, "me", ["B"]);
        old.peerLeave("B");
        old.peerJoin("stale");
        sendOffer(old, "B", { old: "mic" });
        await flush();
        expect(Object.keys((client as any)._peers)).toEqual(["B"]);
        expect(FakePC.instances).toHaveLength(0);
        expect(current.sent).toEqual([]);
    });

    test("unknown, self and malformed offers cannot allocate connections", async () => {
        const t = await connect(client, "me", ["B"]);
        for (const id of ["stranger", "me", "__proto__", "constructor"])
            sendOffer(t, id, { remote: "mic" });
        for (const offer of [
            null,
            {},
            { type: "answer", sdp: OFFER_SDP },
            { type: "offer", sdp: "x".repeat(65537) },
        ]) {
            t.signal("B", { kind: "offer", offer: { offer, map: {} } });
        }
        await flush();
        expect(FakePC.instances).toHaveLength(0);
        expect(Object.keys((client as any)._peers)).toEqual(["B"]);
    });

    test("early ICE is bounded and applied only after a matching remote description", async () => {
        const t = await connect(client, "me", ["B"]);
        for (let i = 0; i < 100; i++) {
            t.signal("B", {
                kind: "candidate",
                candidate: {
                    candidate: `candidate:${i}`,
                    sdpMid: "0",
                    usernameFragment: "current",
                },
            });
        }
        await flush();
        expect(FakePC.instances).toHaveLength(0);
        expect((client as any)._peers.B.pendingCandidates).toHaveLength(64);
        t.signal("B", {
            kind: "offer",
            offer: {
                offer: {
                    type: "offer",
                    sdp: OFFER_SDP + "a=ice-ufrag:current\r\n",
                },
                map: { remote: "mic" },
            },
        });
        await flush();
        const pc = FakePC.instances[0];
        expect(pc.addIceCandidate).toHaveBeenCalledTimes(64);
        expect((client as any)._peers.B.pendingCandidates).toEqual([]);
        t.signal("B", {
            kind: "candidate",
            candidate: {
                candidate: "candidate:stale",
                usernameFragment: "old",
            },
        });
        await flush();
        expect(pc.addIceCandidate).toHaveBeenCalledTimes(64);
    });

    test("a full trickle ICE burst cannot crowd out the initial offer", async () => {
        const t = await connect(client, "me", ["B"]);
        for (let i = 0; i < 150; i++)
            t.signal("B", {
                kind: "candidate",
                candidate: { candidate: `candidate:${i}`, sdpMid: "0" },
            });
        sendOffer(t, "B", { remote: "mic" });
        await flush();
        expect(sentOfKind(t, "answer")).toHaveLength(1);
        expect(FakePC.instances[0].addIceCandidate).toHaveBeenCalledTimes(64);
        expect((client as any)._peers.B.pendingCandidates).toEqual([]);
        expect((client as any)._peers.B.operations.pending).toBe(0);
    });

    test("candidates arriving during remote-description application are serialized", async () => {
        const t = await connect(client, "me", ["B"]);
        const wait = deferred();
        const original = FakePC.prototype.setRemoteDescription;
        const setRemote = jest
            .spyOn(FakePC.prototype, "setRemoteDescription")
            .mockImplementationOnce(async function (description) {
                await wait.promise;
                return original.call(this, description);
            });
        sendOffer(t, "B", { remote: "mic" });
        await flush();
        const pc = FakePC.instances[0];
        t.signal("B", {
            kind: "candidate",
            candidate: { candidate: "candidate:early", sdpMid: "0" },
        });
        await flush();
        expect(pc.addIceCandidate).not.toHaveBeenCalled();
        wait.resolve();
        await flush();
        expect(pc.addIceCandidate).toHaveBeenCalledTimes(1);
        expect(sentOfKind(t, "answer")).toHaveLength(1);
        setRemote.mockRestore();
    });

    test("restart candidates wait for their new ICE generation", async () => {
        const t = await connect(client, "me", ["B"]);
        const offer = (fragment: string) =>
            t.signal("B", {
                kind: "offer",
                offer: {
                    offer: {
                        type: "offer",
                        sdp: OFFER_SDP + `a=ice-ufrag:${fragment}\r\n`,
                    },
                    map: { remote: "mic" },
                },
            });
        offer("old");
        await flush();
        const pc = FakePC.instances[0];
        t.signal("B", {
            kind: "candidate",
            candidate: {
                candidate: "candidate:restart",
                usernameFragment: "new",
            },
        });
        await flush();
        expect(pc.addIceCandidate).not.toHaveBeenCalled();
        offer("new");
        await flush();
        expect(pc.addIceCandidate).toHaveBeenCalledWith(
            expect.objectContaining({
                candidate: "candidate:restart",
                usernameFragment: "new",
            })
        );
    });

    test("glare discards the ignored generation but preserves early ICE for the answer", async () => {
        const t = await connect(client, "Z", ["M"]);
        const { stream } = micStream();
        client.publish(stream as any, "mic");
        await flush();
        t.signal("M", {
            kind: "offer",
            offer: {
                offer: {
                    type: "offer",
                    sdp: OFFER_SDP + "a=ice-ufrag:ignored\r\n",
                },
                map: { remote: "mic" },
            },
        });
        for (const fragment of ["ignored", "accepted"])
            t.signal("M", {
                kind: "candidate",
                candidate: {
                    candidate: `candidate:${fragment}`,
                    usernameFragment: fragment,
                },
            });
        await flush();
        t.signal("M", {
            kind: "answer",
            answer: {
                type: "answer",
                sdp: OFFER_SDP + "a=ice-ufrag:accepted\r\n",
            },
        });
        await flush();
        expect(FakePC.instances[0].addIceCandidate).toHaveBeenCalledTimes(1);
        expect(FakePC.instances[0].addIceCandidate).toHaveBeenCalledWith(
            expect.objectContaining({ usernameFragment: "accepted" })
        );
    });

    test("glare preserves candidates when the answer reuses the ignored offer's ICE generation", async () => {
        const t = await connect(client, "Z", ["M"]);
        const { stream } = micStream();
        client.publish(stream as any, "mic");
        await flush();
        const sdp = OFFER_SDP + "a=ice-ufrag:shared-generation\r\n";
        t.signal("M", {
            kind: "offer",
            offer: {
                offer: { type: "offer", sdp },
                map: { remote: "mic" },
            },
        });
        t.signal("M", {
            kind: "candidate",
            candidate: {
                candidate: "candidate:reused",
                usernameFragment: "shared-generation",
            },
        });
        await flush();
        expect(FakePC.instances[0].addIceCandidate).not.toHaveBeenCalled();
        t.signal("M", { kind: "answer", answer: { type: "answer", sdp } });
        await flush();
        expect(FakePC.instances[0].addIceCandidate).toHaveBeenCalledWith(
            expect.objectContaining({ candidate: "candidate:reused" })
        );
    });

    test("a stale offer failure cannot tear down the replacement peer connection", async () => {
        const t = await connect(client, "me", ["B"]);
        const wait = deferred();
        const setRemote = jest
            .spyOn(FakePC.prototype, "setRemoteDescription")
            .mockImplementationOnce(() => wait.promise);
        sendOffer(t, "B", { remote: "mic" });
        await flush();
        const stale = FakePC.instances[0];
        t.peerLeave("B");
        t.peerJoin("B");
        sendOffer(t, "B", { replacement: "mic" });
        await flush();
        const replacement = FakePC.instances[1];
        const sent = t.sent.length;
        wait.reject(new Error("old operation failed"));
        await flush();
        expect(stale.closed).toBe(true);
        expect(replacement.closed).toBe(false);
        expect((client as any)._peers.B.pc).toBe(replacement);
        expect(t.sent).toHaveLength(sent);
        setRemote.mockRestore();
    });

    test("a local offer completing after leave cannot signal through the next transport", async () => {
        const old = await connect(client, "me", ["B"]);
        const wait = deferred();
        const original = FakePC.prototype.setLocalDescription;
        const setLocal = jest
            .spyOn(FakePC.prototype, "setLocalDescription")
            .mockImplementationOnce(async function (description) {
                await wait.promise;
                return original.call(this, description);
            });
        const { stream } = micStream();
        client.publish(stream as any, "mic");
        await flush();
        client.leave();
        const current = await connect(client, "me", ["B"]);
        wait.resolve();
        await flush();
        expect(old.sent).toEqual([]);
        expect(current.sent).toEqual([]);
        expect(FakePC.instances).toHaveLength(1);
        setLocal.mockRestore();
    });

    test.each(["A", "Z"])(
        "simultaneous offers settle for the %s peer without overlapping descriptions",
        async (self) => {
            const t = await connect(client, self, ["M"]);
            const { stream } = micStream();
            client.publish(stream as any, "mic");
            // Force genuine glare even when the polite side yields first.
            if (self === "A")
                await new Promise((resolve) => setTimeout(resolve, 170));
            await flush();
            sendOffer(t, "M", { remote: "mic" });
            await flush();
            const pc = FakePC.instances[0];
            if (self === "A") {
                expect(pc.signalingState).toBe("stable");
                expect(sentOfKind(t, "answer")).toHaveLength(1);
            } else {
                expect(sentOfKind(t, "answer")).toHaveLength(0);
                t.signal("M", {
                    kind: "answer",
                    answer: { type: "answer", sdp: OFFER_SDP },
                });
                await flush();
                expect(pc.signalingState).toBe("stable");
            }
            expect(pc.closed).toBe(false);
            expect(FakePC.instances).toHaveLength(1);
        }
    );

    test("remote stream labels stay scoped to their peer and old tracks cannot emit after leave", async () => {
        const t = await connect(client, "me", ["B", "C"]);
        const published = jest.fn();
        const unpublished = jest.fn();
        client.on("user-published", published);
        client.on("user-unpublished", unpublished);
        sendOffer(t, "B", { shared: "mic" });
        sendOffer(t, "C", { shared: "stream", invalid: "other" });
        await flush();
        const a = new FakeMediaStream([], "shared");
        const b = new FakeMediaStream([], "shared");
        FakePC.instances[0].receiveStream(a);
        FakePC.instances[1].receiveStream(b);
        expect(
            published.mock.calls.map((args) => [args[0].uid, args[2]])
        ).toEqual([
            ["B", "mic"],
            ["C", "stream"],
        ]);
        t.peerLeave("B");
        a.onremovetrack?.();
        expect(unpublished).not.toHaveBeenCalled();
        FakePC.instances[1].receiveStream(new FakeMediaStream([], "invalid"));
        expect(published).toHaveBeenCalledTimes(2);
    });

    test("speech bitrate cap is applied only to microphone senders", async () => {
        await connect(client, "me", ["B"]);
        const mic = micStream();
        const shared = micStream();
        client.publish(mic.stream as any, "mic");
        client.publish(shared.stream as any, "stream");
        await flush();
        const senders = FakePC.instances[0].getSenders();
        expect(
            senders.find((sender) => sender.track === mic.track).setParameters
        ).toHaveBeenCalledWith({
            encodings: [{ maxBitrate: MIC_MAX_BITRATE }],
        });
        expect(
            senders.find((sender) => sender.track === shared.track)
                .setParameters
        ).not.toHaveBeenCalled();
    });

    test("device replacement completing after leave stops the new microphone", async () => {
        await connect(client, "me", ["B"]);
        const { stream } = micStream();
        client.publish(stream as any, "mic");
        await flush();
        const wait = deferred();
        FakePC.instances[0]
            .getSenders()[0]
            .replaceTrack.mockImplementationOnce(() => wait.promise);
        const track = new FakeTrack("audio");
        const replacing = client.replaceLocalTrack(stream as any, track as any);
        client.leave();
        wait.resolve();
        await replacing;
        expect(track.stop).toHaveBeenCalledTimes(1);
        expect(stream.getTracks()).not.toContain(track);
    });

    test("overlapping device replacements serialize so the latest microphone wins", async () => {
        await connect(client, "me", ["B"]);
        const { stream } = micStream();
        client.publish(stream as any, "mic");
        await flush();
        const sender = FakePC.instances[0].getSenders()[0];
        const wait = deferred();
        sender.replaceTrack.mockImplementationOnce(async (track) => {
            await wait.promise;
            sender.track = track;
        });
        const first = new FakeTrack("audio");
        const latest = new FakeTrack("audio");
        const firstChange = client.replaceLocalTrack(
            stream as any,
            first as any
        );
        await flush();
        const latestChange = client.replaceLocalTrack(
            stream as any,
            latest as any
        );
        await flush();
        expect(sender.replaceTrack).toHaveBeenCalledTimes(1);
        wait.resolve();
        await Promise.all([firstChange, latestChange]);
        expect(sender.track).toBe(latest);
        expect(stream.getAudioTracks()).toEqual([latest]);
        expect(first.stop).toHaveBeenCalledTimes(1);
        expect(latest.stop).not.toHaveBeenCalled();
    });

    test.each([false, true])(
        "one failed sender does not stop a microphone adopted by other peers (peer left: %s)",
        async (left) => {
            const t = await connect(client, "me", ["B", "C"]);
            const { stream } = micStream();
            client.publish(stream as any, "mic");
            await flush();
            const goodSender = FakePC.instances[0].getSenders()[0];
            const failedPc = FakePC.instances[1];
            const wait = deferred();
            failedPc
                .getSenders()[0]
                .replaceTrack.mockImplementationOnce(() => wait.promise);
            const newTrack = new FakeTrack("audio");
            const replacing = client.replaceLocalTrack(
                stream as any,
                newTrack as any
            );
            await flush();
            if (left) t.peerLeave("C");
            wait.reject(new Error("sender closed during device switch"));
            await expect(replacing).resolves.toBeUndefined();
            await flush();
            expect(goodSender.track).toBe(newTrack);
            expect(newTrack.stop).not.toHaveBeenCalled();
            expect(stream.getAudioTracks()).toEqual([newTrack]);
            expect(failedPc.closed).toBe(true);
            if (left) {
                expect((client as any)._peers.C).toBeUndefined();
                expect(FakePC.instances).toHaveLength(2);
            } else {
                expect((client as any)._peers.C.pc).not.toBe(failedPc);
                expect((client as any)._peers.C.micSender.track).toBe(newTrack);
            }
        }
    );
});
