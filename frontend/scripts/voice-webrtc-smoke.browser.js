// Local integration fixture: real Chromium ICE/DTLS/Opus with synthetic audio.
// This is a correctness check, not a network, mobile, echo or capacity benchmark.
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { WebRTCClient } from "../utils/voiceChat/WebRTCClient";
const NativePC = window.RTCPeerConnection;
window.RTCPeerConnection = class extends NativePC {
  constructor(config) {
    super({ ...config, iceServers: [] });
    __publicField(this, "iceEvents", []);
    __publicField(this, "added", []);
    this.addEventListener("icecandidate", (e) => this.iceEvents.push(e.candidate?.toJSON() || null));
  }
  addIceCandidate(candidate) {
    this.added.push(candidate);
    return super.addIceCandidate(candidate);
  }
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitFor = async (predicate, label) => {
  const until = Date.now() + 2e4;
  while (!predicate()) {
    if (Date.now() > until) throw new Error(`Timed out: ${label}`);
    await delay(100);
  }
};
window.runVoiceSmoke = async () => {
  const audio = new AudioContext();
  await audio.resume();
  const bus = /* @__PURE__ */ new Map();
  const oscillators = [];
  const makeTransport = (id) => {
    const t = {
      selfId: id,
      handlers: null,
      disposed: false,
      start(handlers) {
        this.handlers = handlers;
      },
      initialPeers() {
        return [...bus.keys()].filter((key) => key !== id);
      },
      send(to, payload) {
        const message = JSON.parse(JSON.stringify(payload));
        queueMicrotask(() => {
          if (!this.disposed) bus.get(to)?.handlers?.onSignal(id, message);
        });
      },
      dispose() {
        if (this.disposed) return;
        this.disposed = true;
        bus.delete(id);
        for (const peer of bus.values()) peer.handlers?.onPeerLeave(id);
      }
    };
    bus.set(id, t);
    return t;
  };
  const makeStream = (frequency) => {
    const source = audio.createOscillator();
    source.frequency.value = frequency;
    const gain = audio.createGain();
    gain.gain.value = 0.07;
    const sink = audio.createMediaStreamDestination();
    source.connect(gain).connect(sink);
    source.start();
    oscillators.push(source);
    return sink.stream;
  };
  const clients = Array.from({ length: 9 }, () => new WebRTCClient());
  const streams = [];
  const received = clients.map(() => /* @__PURE__ */ new Map());
  const transports = clients.map((_, i) => makeTransport(`peer-${i}`));
  const subscribe = (client, i) => {
    client.on("user-published", (user, stream, channel) => received[i].set(`${user.uid}:${channel}`, stream));
    client.on("user-left", (user) => {
      for (const key of received[i].keys()) if (key.startsWith(`${user.uid}:`)) received[i].delete(key);
    });
  };
  clients.forEach(subscribe);
  const peers = (client) => Object.values(client._peers);
  const allConnected = () => clients.every((c) => peers(c).length === 8 && peers(c).every((p) => p.pc?.connectionState === "connected"));
  const stats = async () => {
    const rows = [];
    for (let i = 0; i < clients.length; i++) {
      let inbound = 0, packets = 0, bytes = 0;
      const tracks = [];
      for (const peer of peers(clients[i])) {
        const report = await peer.pc.getStats();
        report.forEach((r) => {
          if (r.type === "inbound-rtp" && r.kind === "audio") {
            inbound++;
            packets += r.packetsReceived;
            bytes += r.bytesReceived;
            tracks.push({ key: `${peer.user.uid}:${r.id}`, packets: r.packetsReceived, bytes: r.bytesReceived });
          }
        });
      }
      rows.push({ client: i, peers: peers(clients[i]).length, inbound, packets, bytes, tracks });
    }
    return rows;
  };
  try {
    await Promise.all(clients.map((c, i) => c.init({ transport: transports[i], userId: `peer-${i}` })));
    clients.forEach((c, i) => {
      c.setRole("host");
      const s = makeStream(230 + i * 31);
      streams.push(s);
      c.publish(s, "mic");
    });
    await waitFor(allConnected, "nine-client mesh connection");
    await waitFor(() => received.every((r) => r.size === 8), "all remote microphone streams");
    await delay(2500);
    const before = await stats();
    await delay(2500);
    const after = await stats();
    if (!after.every((r, i) => r.inbound === 8 && r.tracks.every((t) => {
      const previous = before[i].tracks.find((p) => p.key === t.key);
      return previous && t.packets > previous.packets && t.bytes > previous.bytes;
    }))) throw new Error("RTP did not advance for every individual audio source");
    const micParameters = peers(clients[0]).map((p) => p.micSender?.getParameters().encodings[0]?.maxBitrate);
    if (!micParameters.every((n) => n === 24e3)) throw new Error(`Bitrate cap mismatch: ${micParameters}`);
    const ptime = peers(clients[0])[0].pc.remoteDescription.sdp.match(/a=ptime:(\d+)/)?.[1];
    const share = makeStream(800);
    clients[0].publish(share, "stream");
    await waitFor(() => received.slice(1).every((r) => r.has("peer-0:stream")), "shared audio alongside mic");
    clients[0].setMicGated("peer-1", true);
    await waitFor(() => peers(clients[0]).find((p) => p.user.uid === "peer-1").micSender.track === null, "mic gate");
    const gatedPeer = peers(clients[0]).find((p) => p.user.uid === "peer-1");
    if (!gatedPeer.pc.getSenders().some((s) => s.track === share.getAudioTracks()[0])) throw new Error("Mic gate interrupted shared audio");
    clients[0].setMicGated("peer-1", false);
    await waitFor(() => gatedPeer.micSender.track === streams[0].getAudioTracks()[0], "mic resume");
    clients[8].leave();
    if (streams[8].getTracks().some((t) => t.readyState !== "ended")) throw new Error("Capture leaked after leave");
    if (clients.slice(0, 8).some((c) => peers(c).length !== 7)) throw new Error("Peer leaked after leave");
    received[8].clear();
    subscribe(clients[8], 8);
    const replacementTransport = makeTransport("peer-8");
    for (const [id, t] of bus) if (id !== "peer-8") t.handlers.onPeerJoin("peer-8");
    await clients[8].init({ transport: replacementTransport, userId: "peer-8" });
    const replacement = makeStream(610);
    clients[8].publish(replacement, "mic");
    await waitFor(allConnected, "rejoined mesh");
    await waitFor(() => received.every((r, i) => r.size === (i === 0 ? 8 : 9)), "remote streams after rejoin");
    await delay(1500);
    const rejoined = await stats();
    if (!rejoined.every((r) => r.inbound >= 8 && r.tracks.every((t) => t.packets > 0 && t.bytes > 0))) throw new Error("Missing media after rejoin");
    return { browser: navigator.userAgent, clients: 9, remotePeersPerClient: 8, connectedPeerConnections: 72, before, after, rejoined, micParameters, negotiatedPtime: ptime, shareSurvivedMicGate: true, rejoin: true };
  } catch (error) {
    window.voiceFailure = { error: String(error), received: received.map((r) => [...r.keys()]), peers: clients.map((c, i) => ({ i, peers: peers(c).map((p) => ({ id: p.user.uid, connection: p.pc?.connectionState, ice: p.pc?.iceConnectionState, signaling: p.pc?.signalingState, local: p.pc?.localDescription?.type, remote: p.pc?.remoteDescription?.type, queued: p.operations?.pending, candidates: p.pendingCandidates?.length, gathering: p.pc?.iceGatheringState, iceEvents: p.pc?.iceEvents, added: p.pc?.added, localUfrag: p.pc?.localDescription?.sdp.match(/a=ice-ufrag:[^\r\n]+/g), remoteUfrag: p.pc?.remoteDescription?.sdp.match(/a=ice-ufrag:[^\r\n]+/g) })) })) };
    throw error;
  } finally {
    clients.forEach((c) => c.leave());
    oscillators.forEach((o) => o.stop());
    await audio.close();
  }
};
