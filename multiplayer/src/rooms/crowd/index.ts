import { readLobbyFlash, LobbyFlash } from "../../../protocol/lobby-flash";
import { verifyLobbyClaims } from "../../identity/lobby";
import { encodePose, encodeSnapshot } from "./snapshot";
import { Room, Client } from "colyseus";
import { performance } from "perf_hooks";
import { CrowdModel, Person, TokenBucket } from "./core";
import { AOI_LIMIT, VOICE_LIMIT, STAGE_SPEAKER_LIMIT, TICK_RATE, configuredCapacity, configuredRegion, configuredLabel, profile, boundedString } from "./protocol";

interface Connection {
    client: Client;
    person: Person;
    ready: boolean;
    visible: Map<string, number>;
    poses: Map<string, number>;
    voice: Set<string>;
    voiceKey: string;
    stageRevision: number;
    population: number;
    slowSince: number;
    invalid: number;
    rateViolations: number;
    limits: Record<string, TokenBucket>;
    attributes: Map<string, string>;
    phase: number;
    rosterSelection: Set<string> | null;
    rosterGeneration: number;
    controls: Array<{ type: string; data: any; bytes: number; at: number }>;
    controlBytes: number;
}
const BUFFER_SOFT = 256 * 1024;
const KICK_BAN_MS = 15 * 60 * 1000;
type Role = "owner" | "admin";
const ADMIN_ACTIONS = ["stage-add", "stage-remove", "mute", "unmute", "kick", "decline-request", "grant-admin", "revoke-admin"];
const BUFFER_HARD = 1024 * 1024;
export const activeCrowdRooms = new Map<string, CrowdLobbyRoom>();
export class CrowdLobbyRoom extends Room {
    readonly model = new CrowdModel();
    readonly connections = new Map<string, Connection>();
    region = "local";
    tick = 0;
    private tickSamples: number[] = [];
    private stageSamples: Array<{ interest: number; voice: number; encode: number; delivery: number }> = [];
    private sentBytes = 0;
    private receivedBytes = 0;
    private droppedSnapshots = 0;
    private candidateVisits = 0;
    private rosterGeneration = 0;
    private encodedPoses = new Map<string, { revision: number; bytes: Buffer }>();
    /** Moderation outlives a session: keyed by verified party identity when there is one. */
    private grants = new Map<string, Role>();
    private mutes = new Set<string>();
    private bans = new Map<string, number>();
    private requests = new Map<string, number>();
    private stageRevision = 0;
    onCreate(options: any) {
        if (options?.label != null && options.label !== configuredLabel()) throw new Error("Unsupported lobby label");
        this.maxClients = configuredCapacity();
        this.region = configuredRegion(options?.region);
        this.setMetadata({ spaceId: configuredLabel(), region: this.region, lobbyProtocol: 1 });
        this.setPatchRate(null); // No all-player schema serialization or broadcasts.
        activeCrowdRooms.set(this.roomId, this);
        this.setSimulationInterval(() => this.step(), 1000 / TICK_RATE);
        this.onMessage("lobby-ready", (client) => {
            const c = this.connections.get(client.sessionId);
            if (!c || !this.allow(c, "request") || c.ready) return;
            c.ready = true;
            this.sendBounded(c, "lobby-welcome", { lobbyProtocol: 1, flash: true, sessionId: client.sessionId, roomId: this.roomId, region: this.region, partyIdentity: c.person.profile.partyIdentity, role: c.person.profile.role, tickRate: TICK_RATE, aoiLimit: AOI_LIMIT, voiceLimit: VOICE_LIMIT, position: [c.person.x, c.person.y, c.person.z, c.person.yaw], snapshotRates: { near: 20, mid: 10, far: 5 }, snapshotBands: [32, 64, 128] });
            this.model.selectVisible(c.person);
            this.roster(c);
        });
        this.onMessage("lobby-move", (client, message) => {
            const c = this.connections.get(client.sessionId);
            if (!c?.ready || !this.allow(c, "move")) return;
            const before = { x: c.person.x, y: c.person.y, z: c.person.z };
            const ack = this.model.move(c.person, message, Date.now());
            if (!ack) {
                this.invalid(c);
                return;
            }
            if (Math.hypot(c.person.x - before.x, c.person.y - before.y, c.person.z - before.z) > 0.002 || !c.person.floor) this.setFlash(c, null);
            this.sendBounded(c, "lobby-ack", ack);
        });
        this.onMessage("lobby-ping", (client, message) => {
            const c = this.connections.get(client.sessionId);
            if (c && this.allow(c, "request") && (typeof message?.id === "number" || typeof message?.id === "string") && String(message.id).length <= 64 && typeof message.clientTime === "number" && Number.isFinite(message.clientTime)) this.sendBounded(c, "lobby-pong", { id: message.id, clientTime: message.clientTime, serverTime: Date.now() });
        });
        this.onMessage("lobby-flash", (client, message) => {
            const c = this.connections.get(client.sessionId);
            if (!c?.ready) return;
            // Stop always passes, even after exhausting the start budget.
            if (message?.flash === null) { this.setFlash(c, null); return; }
            const flash = message?.flash && typeof message.flash === "object" && !Array.isArray(message.flash)
                ? readLobbyFlash({ ...message.flash, startedAt: Date.now() }) : null;
            if (!flash) { this.invalid(c); return; }
            if (c.person.profile.flash?.nonce === flash.nonce || !this.allow(c, "flash")) return;
            this.setFlash(c, flash);
        });
        this.onMessage("lobby-profile", (client, message) => {
            const c = this.connections.get(client.sessionId);
            if (!c?.ready || !message || !this.allow(c, "profile")) return;
            c.person.profile = this.withRole(profile(client.sessionId, { ...c.person.profile, username: message.username ?? c.person.profile.username, avatar: message.avatar ?? c.person.profile.avatar, VRM: message.VRM ?? c.person.profile.VRM, scale: message.scale ?? c.person.profile.scale }, c.person.profile.partyIdentity, c.person.profile.flash), c.person.profile.role);
            c.person.profileRevision++;
            if (this.model.speakers.has(c.person.id) || this.requests.has(c.person.id)) this.stageRevision++;
            this.rosterGeneration++;
        });
        this.onMessage("chat-channel", (client, message) => {
            const c = this.connections.get(client.sessionId);
            if (!c?.ready || !this.allow(c, "chat") || message?.type !== "MESSAGE" || typeof message.text !== "string") return;
            const text = message.text.trim().slice(0, 500);
            if (!text) return;
            const envelope = { from: client.sessionId, server_ts: Date.now(), data: { type: "MESSAGE", text, acc_date: new Date().toISOString() } };
            this.sendBounded(c, "chat-channel", envelope);
            for (const id of c.person.visible) {
                const peer = this.connections.get(id);
                if (peer?.ready && peer.person.visible.has(c.person.id) && this.model.nearby(c.person, peer.person, 32)) this.sendBounded(peer, "chat-channel", envelope);
            }
        });
        this.onMessage("chat-peer", (client, message) => {
            const c = this.connections.get(client.sessionId);
            if (!c?.ready || !this.allow(c, "chat") || typeof message?.to !== "string" || message.data?.type !== "MESSAGE" || typeof message.data.text !== "string") return;
            const target = this.connections.get(message.to),
                text = message.data.text.trim().slice(0, 500);
            if (!target?.ready || target === c || !text) return;
            this.sendControl(target, "chat-peer", { from: client.sessionId, to: target.client.sessionId, server_ts: Date.now(), profile: { username: c.person.profile.username, avatar: c.person.profile.avatar }, data: { type: "MESSAGE", text } });
        });
        this.onMessage("rtc-ready", (client, message) => {
            const c = this.connections.get(client.sessionId);
            if (c?.ready && this.allow(c, "request")) c.person.voiceReady = message?.enabled !== false;
        });
        this.onMessage("rtc-signal", (client, message) => {
            const c = this.connections.get(client.sessionId);
            if (!c?.ready || !this.allow(c, "signal")) return;
            const target = this.connections.get(message?.to);
            if (!target?.ready || !this.model.linked(c.person, target.person)) return;
            if (!message?.payload || !["offer", "answer", "candidate"].includes(message.payload.kind) || JSON.stringify(message.payload).length > 16000) return;
            this.sendControl(target, "rtc-signal", { from: client.sessionId, payload: message.payload });
        });
        this.onMessage("lobby-voice-request", (client, message) => {
            const c = this.connections.get(client.sessionId);
            if (!c?.ready || !this.allow(c, "request")) return;
            if (message?.cancel === true) {
                if (this.requests.delete(c.person.id)) this.stageRevision++;
            } else if (!this.model.speakers.has(c.person.id) && !c.person.muted && !this.requests.has(c.person.id) && this.requests.size < 64) {
                this.requests.set(c.person.id, Date.now());
                this.stageRevision++;
            }
        });
        this.onMessage("lobby-stage-leave", (client) => {
            const c = this.connections.get(client.sessionId);
            if (c?.ready && this.allow(c, "request") && this.model.speakers.delete(c.person.id)) this.stageRevision++;
        });
        this.onMessage("lobby-admin", (client, message) => {
            const c = this.connections.get(client.sessionId);
            if (!c?.ready || !this.allow(c, "request")) return;
            if (!c.person.profile.role || !ADMIN_ACTIONS.includes(message?.action)) return;
            const target = this.connections.get(message?.sessionId);
            const result = (ok: boolean, error = "") => this.sendBounded(c, "lobby-admin-result", { action: message.action, sessionId: message.sessionId, ok, error });
            if (!target) return result(false, "That person has left the lobby.");
            this.moderate(c, target, message.action, result);
        });
        // Compatibility for existing voice UI; only bounded voice-state attributes, no room-wide attributes.
        this.onMessage("attr-set-user", (client, message) => {
            const c = this.connections.get(client.sessionId);
            if (!c || !this.allow(c, "request") || message?.key !== "voiceState") return;
            if (message.value === null) c.attributes.delete(message.key);
            else if (typeof message.value === "string" && message.value.length <= 1024) c.attributes.set(message.key, message.value);
        });
        this.onMessage("attr-get-user", (client, message) => {
            const c = this.connections.get(client.sessionId);
            if (!c || !this.allow(c, "request")) return;
            const target = this.connections.get(message?.sessionId),
                values: Record<string, string> = {};
            if (target && (target === c || c.person.visible.has(target.person.id)) && Array.isArray(message.keys) && message.keys.includes("voiceState") && target.attributes.has("voiceState")) values.voiceState = target.attributes.get("voiceState")!;
            this.sendBounded(c, "attr-reply", { requestId: boundedString(message?.requestId, 128), values });
        });
        this.onMessage("attr-get-channel", (client, message) => {
            const c = this.connections.get(client.sessionId);
            if (c && this.allow(c, "request")) this.sendBounded(c, "attr-reply", { requestId: boundedString(message?.requestId, 128), values: {} });
        });
        this.onMessage("attr-set-channel", (client) => {
            const c = this.connections.get(client.sessionId);
            if (c) this.allow(c, "request");
        });
        this.onMessage("*", (client) => {
            const c = this.connections.get(client.sessionId);
            if (c) this.invalid(c);
        });
    }
    onAuth(_client: Client, options: any) {
        if (typeof options?.userId !== "string" || !options.userId || options.userId.length > 128) return false;
        const claims = verifyLobbyClaims(options.lobbyIdentityToken);
        if (claims && (this.bans.get(claims.sub) || 0) > Date.now()) return false;
        return { partyIdentity: claims?.sub, role: claims?.role };
    }
    onJoin(client: Client, options: any) {
        this.rosterGeneration++;
        const now = Date.now(),
            identity = client.auth?.partyIdentity,
            person = this.model.add(client.sessionId, this.withRole(profile(client.sessionId, { ...options, userId: `guest:${client.sessionId}` }, identity), client.auth?.role || (identity ? this.grants.get(identity) : undefined)), now);
        person.muted = this.mutes.has(identity || client.sessionId);
        const limits: Record<string, TokenBucket> = {};
        for (const [name, rate, burst] of [
            ["move", 30, 60],
            ["request", 10, 20],
            ["chat", 1, 4],
            ["profile", 1, 3],
            ["flash", 1, 3],
            ["signal", 20, 40],
        ] as Array<[string, number, number]>)
            limits[name] = new TokenBucket(rate, burst, now);
        this.connections.set(client.sessionId, { client, person, ready: false, visible: new Map(), poses: new Map(), voice: new Set(), voiceKey: "", stageRevision: -1, population: -1, slowSince: 0, invalid: 0, rateViolations: 0, limits, attributes: new Map(), controls: [], controlBytes: 0, rosterSelection: null, rosterGeneration: -1, phase: Array.from(client.sessionId).reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 20 });
        // Count actual websocket payload bytes (Colyseus MessagePack), not estimated JSON size.
        const ws = client.ref as any,
            originalSend = ws.send;
        ws.send = (...args: any[]) => {
            const data = args[0];
            this.sentBytes += typeof data === "string" ? Buffer.byteLength(data) : data?.byteLength || data?.length || 0;
            return originalSend.apply(ws, args);
        };
        ws.on("message", (data: any) => {
            this.receivedBytes += data?.byteLength || data?.length || 0;
        });
    }
    onLeave(client: Client) {
        const c = this.connections.get(client.sessionId);
        if (c) this.setFlash(c, null);
        this.rosterGeneration++;
        this.connections.delete(client.sessionId);
        if (this.model.speakers.has(client.sessionId) || this.requests.delete(client.sessionId)) this.stageRevision++;
        this.model.remove(client.sessionId);
        this.encodedPoses.delete(client.sessionId);
    }
    onDispose() {
        activeCrowdRooms.delete(this.roomId);
    }
    private withRole(p: ReturnType<typeof profile>, role?: Role) {
        return role ? { ...p, role } : p;
    }
    private stage(c: Connection) {
        const entry = (id: string) => {
            const p = this.model.people.get(id);
            return p && { sessionId: id, username: p.profile.username, avatar: p.profile.avatar, role: p.profile.role };
        };
        return {
            speakers: Array.from(this.model.speakers, entry).filter(Boolean),
            limit: STAGE_SPEAKER_LIMIT,
            role: c.person.profile.role || null,
            muted: c.person.muted,
            requested: this.requests.has(c.person.id),
            // Only admins see who asked to speak.
            requests: c.person.profile.role ? Array.from(this.requests.keys(), entry).filter(Boolean) : [],
            mutedPeople: c.person.profile.role ? Array.from(this.model.people.values()).filter((p) => p.muted).slice(0, 256).map((p) => p.id) : [],
        };
    }
    private setRole(c: Connection, role?: Role) {
        const { role: _previous, ...base } = c.person.profile;
        c.person.profile = this.withRole(base, role);
        c.person.profileRevision++;
        this.rosterGeneration++;
        this.stageRevision++;
    }
    private moderate(actor: Connection, target: Connection, action: string, result: (ok: boolean, error?: string) => unknown) {
        const t = target.person,
            key = t.profile.partyIdentity || t.id,
            owner = actor.person.profile.role === "owner";
        // Admins cannot act on the owner or on other admins; only the owner manages admins.
        if (target !== actor && t.profile.role && (t.profile.role === "owner" || !owner)) return result(false, "Only the main admin can moderate admins.");
        if (action === "stage-add") {
            if (t.muted) return result(false, "Unmute them first.");
            if (!this.model.speakers.has(t.id) && this.model.speakers.size >= STAGE_SPEAKER_LIMIT) return result(false, `Voice is full (${STAGE_SPEAKER_LIMIT} speakers).`);
            this.model.speakers.add(t.id);
            this.requests.delete(t.id);
        } else if (action === "stage-remove") this.model.speakers.delete(t.id);
        else if (action === "decline-request") this.requests.delete(t.id);
        else if (action === "mute" || action === "unmute") {
            if (target === actor) return result(false, "You can’t mute yourself here.");
            t.muted = action === "mute";
            if (t.muted) {
                this.mutes.add(key);
                this.model.speakers.delete(t.id);
                this.requests.delete(t.id);
            } else this.mutes.delete(key);
        } else if (action === "kick") {
            if (target === actor) return result(false, "You can’t remove yourself.");
            if (t.profile.partyIdentity) this.bans.set(t.profile.partyIdentity, Date.now() + KICK_BAN_MS);
            this.sendBounded(target, "kick", { reason: "Removed by an admin" });
            target.client.leave(4003, "Removed by an admin");
        } else if (action === "grant-admin" || action === "revoke-admin") {
            if (!owner) return result(false, "Only the main admin can change admins.");
            if (target === actor) return result(false, "You’re already the main admin.");
            if (!t.profile.partyIdentity) return result(false, "They need to sign in before they can be an admin.");
            const role = action === "grant-admin" ? "admin" : undefined;
            if (role) this.grants.set(key, role);
            else this.grants.delete(key);
            this.setRole(target, role);
        }
        this.stageRevision++;
        result(true);
        this.model.updateVoice();
    }
    private setFlash(c: Connection, flash: LobbyFlash | null) {
        if (!flash && !c.person.profile.flash) return;
        c.person.profile = { ...c.person.profile, flash };
        c.person.profileRevision++;
        this.rosterGeneration++;
        const data = { sessionId: c.person.id, flash };
        for (const observer of this.connections.values())
            if (observer.ready && (observer === c || observer.visible.has(c.person.id)))
                this.sendControl(observer, "lobby-flash", data);
    }
    private allow(c: Connection, name: string) {
        if (c.limits[name].take(Date.now())) return true;
        if (++c.rateViolations >= 120) c.client.leave(4008, "Lobby rate limit exceeded");
        return false;
    }
    private invalid(c: Connection) {
        if (++c.invalid >= 100) c.client.leave(4002, "Invalid lobby messages");
    }
    private canSend(c: Connection): boolean {
        const buffered = (c.client.ref as any).bufferedAmount || 0;
        if (buffered <= BUFFER_SOFT) {
            c.slowSince = 0;
            return true;
        }
        c.slowSince ||= Date.now();
        if (buffered > BUFFER_HARD || Date.now() - c.slowSince > 5000) c.client.leave(4008, "Lobby connection cannot keep up");
        return false;
    }
    private sendBounded(c: Connection, type: string, data: any) {
        if (!this.canSend(c)) return false;
        c.client.send(type, data);
        return true;
    }
    private sendControl(c: Connection, type: string, data: any) {
        if (!c.controls.length && this.sendBounded(c, type, data)) return;
        const bytes = Buffer.byteLength(JSON.stringify(data)) + 64;
        if (c.controls.length >= 16 || c.controlBytes + bytes > 65536) {
            c.client.leave(4008, "Lobby control backlog exceeded");
            return;
        }
        c.controls.push({ type, data, bytes, at: Date.now() });
        c.controlBytes += bytes;
    }
    private flushControls(c: Connection) {
        while (c.controls.length) {
            const next = c.controls[0];
            if (Date.now() - next.at > 5000) {
                c.client.leave(4008, "Lobby control delivery expired");
                return false;
            }
            // A queued peer may have left proximity while the socket was blocked.
            const sender = this.model.people.get(next.data.from);
            if (next.type === "rtc-signal" && (!sender || !this.model.linked(c.person, sender))) {
                c.controls.shift();
                c.controlBytes -= next.bytes;
                continue;
            }
            if (!this.sendBounded(c, next.type, next.data)) return false;
            c.controls.shift();
            c.controlBytes -= next.bytes;
        }
        return true;
    }
    private roster(c: Connection) {
        if (c.rosterSelection === c.person.visible && c.rosterGeneration === this.rosterGeneration && c.population === this.model.people.size) return;
        const enter: any[] = [],
            leave: string[] = [];
        for (const id of c.visible.keys()) if (!c.person.visible.has(id) || !this.model.people.has(id)) leave.push(id);
        for (const id of c.person.visible) {
            const peer = this.model.people.get(id);
            if (peer && c.visible.get(id) !== peer.profileRevision) enter.push(peer.profile);
        }
        const changed = enter.length || leave.length || c.population !== this.model.people.size;
        if (!changed || this.sendBounded(c, "lobby-roster", { enter, leave, population: this.model.people.size })) {
            for (const id of leave) {
                c.visible.delete(id);
                c.poses.delete(id);
            }
            for (const p of enter) c.visible.set(p.sessionId, this.model.people.get(p.sessionId)!.profileRevision);
            c.population = this.model.people.size;
            c.rosterSelection = c.person.visible;
            c.rosterGeneration = this.rosterGeneration;
        }
    }
    step() {
        const started = performance.now();
        this.tick++;
        // Distribute AOI work over four ticks instead of one room-wide periodic spike.
        let slot = 0;
        for (const p of this.model.people.values())
            if (slot++ % 4 === this.tick % 4) {
                this.model.selectVisible(p);
                this.candidateVisits += this.model.lastCandidateVisits;
            }
        const interestDone = performance.now();
        if (this.tick % 5 === 1) this.model.updateVoice();
        const voiceDone = performance.now();
        // Quantize and MessagePack-encode each changed pose once per tick, shared by all viewers.
        for (const p of this.model.people.values()) if (this.encodedPoses.get(p.id)?.revision !== p.revision) this.encodedPoses.set(p.id, { revision: p.revision, bytes: encodePose(this.model.pose(p)) });
        const serverTime = Date.now(),
            encodeDone = performance.now();
        for (const c of this.connections.values()) {
            if (!c.ready) continue;
            if (!this.canSend(c)) {
                this.droppedSnapshots++;
                continue;
            }
            if (!this.flushControls(c)) continue;
            this.roster(c);
            const voice = c.person.voice,
                listenOnly = Array.from(c.person.listenOnly),
                speakOnly = Array.from(c.person.speakOnly),
                voiceKey = `${listenOnly.join()}|${speakOnly.join()}`;
            if (voiceKey !== c.voiceKey || voice.size !== c.voice.size || Array.from(voice).some((id) => !c.voice.has(id))) {
                if (this.sendBounded(c, "lobby-voice", { peers: Array.from(voice), listenOnly, speakOnly })) {
                    for (const id of c.voice) if (!voice.has(id)) this.sendBounded(c, "rtc-leave", { sessionId: id });
                    for (const id of voice) if (!c.voice.has(id)) this.sendBounded(c, "rtc-join", { sessionId: id });
                    c.voice = new Set(voice);
                    c.voiceKey = voiceKey;
                }
            }
            if (c.stageRevision !== this.stageRevision && this.sendBounded(c, "lobby-stage", this.stage(c))) c.stageRevision = this.stageRevision;
            const poses: Buffer[] = [],
                changed: Person[] = [];
            let rank = 0;
            const heartbeat = (this.tick + c.phase) % 10 === 0;
            for (const id of c.person.visible) {
                const cadence = rank < 32 ? 1 : rank < 64 ? 2 : 4;
                rank++;
                const due = (this.tick + c.phase) % cadence === 0,
                    previousRevision = c.poses.get(id);
                if (!due && !heartbeat && previousRevision !== undefined) continue;
                const p = this.model.people.get(id);
                if (p && (previousRevision !== undefined || c.visible.has(id)) && (previousRevision === undefined || heartbeat || previousRevision !== p.revision)) {
                    poses.push(this.encodedPoses.get(id)!.bytes);
                    changed.push(p);
                }
            }
            if (poses.length && this.canSend(c)) {
                c.client.enqueueRaw(encodeSnapshot(this.tick, serverTime, poses));
                for (const p of changed) c.poses.set(p.id, p.revision);
            }
        }
        const finished = performance.now();
        this.tickSamples.push(finished - started);
        if (this.tickSamples.length > 2400) this.tickSamples.shift();
        if (process.env.LOBBY_PROFILE_TICKS === "1") {
            this.stageSamples.push({ interest: interestDone - started, voice: voiceDone - interestDone, encode: encodeDone - voiceDone, delivery: finished - encodeDone });
            if (this.stageSamples.length > 2400) this.stageSamples.shift();
        }
    }
    resetMetrics() {
        this.tickSamples = [];
        this.stageSamples = [];
        this.sentBytes = 0;
        this.receivedBytes = 0;
        this.droppedSnapshots = 0;
        this.candidateVisits = 0;
    }
    metrics() {
        const sorted = this.tickSamples.slice().sort((a, b) => a - b);
        const stages: Record<string, { p50: number; p95: number }> = {};
        for (const key of ["interest", "voice", "encode", "delivery"] as const) {
            const values = this.stageSamples.map((sample) => sample[key]).sort((a, b) => a - b);
            stages[key] = { p50: values[Math.floor(values.length * 0.5)] || 0, p95: values[Math.floor(values.length * 0.95)] || 0 };
        }
        return { roomId: this.roomId, region: this.region, population: this.connections.size, maxClients: this.maxClients, tick: this.tick, stageMs: stages, snapshotRates: { near: 20, mid: 10, far: 5 }, tickMs: { p50: sorted[Math.floor(sorted.length * 0.5)] || 0, p95: sorted[Math.floor(sorted.length * 0.95)] || 0 }, aoiMax: Math.max(0, ...Array.from(this.model.people.values()).map((p) => p.visible.size)), voiceMax: Math.max(0, ...Array.from(this.model.people.values()).map((p) => p.voice.size)), sentBytes: this.sentBytes, receivedBytes: this.receivedBytes, droppedSnapshots: this.droppedSnapshots, candidateVisits: this.candidateVisits };
    }
}
