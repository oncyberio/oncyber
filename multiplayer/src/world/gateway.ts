import { LobbyFlash, readLobbyFlash } from "../../protocol/lobby-flash";
import type { LobbyGroupPose } from "../../protocol/lobby-groups";
import { InputAuthority } from "./input";
import { decodeInputs } from "../../protocol/movement";
import { performance } from "perf_hooks";
import { CrowdModel, Person, TokenBucket } from "../rooms/crowd/core";
import { profile, Profile } from "../rooms/crowd/protocol";
import { SharedWorld, SharedWorldData, ActorPose, blankPose, VOICE_STRIDE, VOICE_PICKS, VOICE_HEARERS } from "./shared";
import { STAGE_ACTIONS, STAGE_VOICE_EXIT_RADIUS, STAGE_VOICE_RADIUS, StageRole, StageSnapshot } from "./stage";
import { InterestIndex } from "./interest";
import { decodeMovement, encodeMotionPose, encodePose, encodeSnapshotParts } from "../../protocol/lobby-v2";
/** Same ring as "teleport all here" in spaces. */
export const SUMMON_RADIUS = 10;
export interface Endpoint {
    sendControl(type: string, data: any): boolean;
    sendDatagram(bytes: Uint8Array): boolean;
    bufferedAmount(): number;
    maxDatagramSize?(): number;
    close(code?: number, reason?: string): void;
}
export interface Reservation {
    token: string;
    id: number;
    slot: number;
    owner: number;
    expires: number;
    profile: Profile;
}
export interface Member {
    id: number;
    slot: number;
    owner: number;
    profile: Profile;
    revision: number;
}
interface Connection {
    id: number;
    sessionId: string;
    phase: number;
    token: string;
    slot: number;
    endpoint: Endpoint;
    person: Person;
    pose: ActorPose;
    ready: boolean;
    visible: number[];
    roster: Map<number, number>;
    voice: number[];
    /** "listenOnly|speakOnly" as last sent, so a direction change is resent. */
    voiceKey: string;
    stageRevision: number;
    pins: number[];
    ack: any;
    pendingMove: any;
    input?: InputAuthority;
    velocitySnapshots?: boolean;
    rates: Record<string, TokenBucket>;
    strikes: number;
    slowAt: number;
    lastHeartbeat: number;
    population: number;
    lastRosterRevision: number;
    sent: Map<number, { revision: number; at: number }>;
    connectedAt: number;
    groupHold?: string;
    groupPins?: number[];
    activeWorld?: boolean;
}
export class WorldGateway {
    readonly reservations = new Map<string, Reservation>();
    readonly sessions = new Map<string, Connection>();
    readonly members = new Map<number, Member>();
    readonly shared: SharedWorld;
    readonly actors = new Map<number, ActorPose>();
    private slots: ActorPose[];
    private index = new InterestIndex();
    private model = new CrowdModel();
    private encoded = new Map<number, { revision: number; bytes: Uint8Array; view: DataView; motion: Uint8Array; motionView: DataView; urgentRevision: number }>();
    private networkBudget = 128;
    private tick = 0;
    // Global actor IDs can share a modulo within one worker; stagger locally.
    private nextPhase = 0;
    private rosterRevision = 0;
    private samples: number[] = [];
    private intervals: number[] = [];
    private lastStepAt = 0;
    private stages = { simulation: 0, refresh: 0, interest: 0, delivery: 0 };
    private indexCells = new Map<number, number>();
    private indexDirty = true;
    private timer: NodeJS.Timeout;
    private bytesOut = 0;
    private bytesIn = 0;
    private drops = 0;
    private corrections = 0;
    private candidateVisits = 0;
    private stageState: StageSnapshot = { revision: -1, limit: 5, speakers: [], requests: [], muted: [], roles: [] };
    private speakers = new Set<number>();
    private roles = new Map<number, StageRole>();
    constructor(readonly options: { owner: number; detailThreshold?: number; shared: SharedWorldData; epoch: number; roomId: string; region: string; post(message: any): void }) {
        this.shared = new SharedWorld(options.shared);
        this.slots = Array.from({ length: options.shared.capacity }, (_, i) => blankPose(i));
    }
    start() {
        this.timer = setInterval(() => this.step(), 50);
    }
    stop() {
        clearInterval(this.timer);
        for (const c of this.sessions.values()) c.endpoint.close(1001, "World stopped");
        for (const id of Array.from(this.sessions.keys())) this.disconnect(id);
    }
    reserve(ticket: Reservation) {
        this.reservations.set(ticket.token, ticket);
    }
    revoke(token: string) {
        this.reservations.delete(token);
        for (const c of this.sessions.values())
            if (c.token === token) {
                c.endpoint.close(4001, "Session replaced");
                this.disconnect(c.sessionId);
                break;
            }
    }
    member(member: Member) {
        const prior = this.members.get(member.id);
        // A worker can receive its own older profile echo after a newer local stop.
        if (prior && member.revision < prior.revision) return;
        const previous = prior?.profile.flash;
        this.members.set(member.id, member);
        this.rosterRevision++;
        const flash = member.profile.flash || null;
        if (previous?.nonce === flash?.nonce && previous?.startedAt === flash?.startedAt) return;
        // Profile replication also carries Flash across gateway workers. Only
        // observers who already own this roster entry receive the immediate event.
        for (const c of this.sessions.values())
            if (c.ready && (c.id === member.id || c.roster.has(member.id)))
                this.control(c, "lobby-flash", { sessionId: member.profile.sessionId, flash });
    }
    remove(id: number) {
        this.members.delete(id);
        this.actors.delete(id);
        this.indexCells.delete(id);
        this.indexDirty = true;
        this.encoded.delete(id);
        this.rosterRevision++;
    }
    async accept(token: string, endpoint: Endpoint): Promise<string | null> {
        const r = this.reservations.get(token);
        this.reservations.delete(token);
        if (!r || r.expires < Date.now()) return null;
        const sessionId = String(r.id),
            now = Date.now(),
            person = this.model.add(sessionId, r.profile, now),
            pose = { ...blankPose(r.slot), id: r.id, owner: this.options.owner, x: person.x, z: person.z, revision: 1 };
        const rates: Record<string, TokenBucket> = {};
        for (const [name, rate, burst] of [
            ["move", 30, 60],
            ["request", 10, 20],
            ["profile", 1, 3],
            ["flash", 1, 3],
            ["chat", 1, 4],
            ["signal", 20, 40],
        ] as Array<[string, number, number]>)
            rates[name] = new TokenBucket(rate, burst, now);
        const c: Connection = { id: r.id, sessionId, phase: this.nextPhase++ % 20, token, slot: r.slot, endpoint, person, pose, ready: false, visible: [], roster: new Map(), voice: [], voiceKey: "", stageRevision: -2, pins: [], ack: null, pendingMove: null, rates, strikes: 0, slowAt: 0, lastHeartbeat: 0, population: -1, lastRosterRevision: -1, sent: new Map(), connectedAt: now };
        this.sessions.set(sessionId, c);
        this.shared.write(pose);
        this.member({ id: r.id, slot: r.slot, owner: r.owner, profile: r.profile, revision: 1 });
        this.options.post({ type: "accepted", id: r.id, token });
        this.control(c, "session-accepted", { sessionId });
        return sessionId;
    }
    disconnect(sessionId: string) {
        const c = this.sessions.get(sessionId);
        if (!c) return;
        this.setFlash(c, null);
        this.sessions.delete(sessionId);
        this.model.remove(sessionId);
        this.shared.remove(c.slot, c.id);
        this.remove(c.id);
        this.options.post({ type: "left", id: c.id, token: c.token });
    }
    private allow(c: Connection, kind: string) {
        if (c.rates[kind].take(Date.now())) return true;
        if (++c.strikes > 120) c.endpoint.close(4008, "Message rate exceeded");
        return false;
    }
    private control(c: Connection, type: string, data: any): boolean {
        if (c.endpoint.bufferedAmount() > 128 * 1024) {
            c.endpoint.close(4008, "Control backlog");
            return false;
        }
        const ok = c.endpoint.sendControl(type, data);
        if (ok) this.bytesOut += Buffer.byteLength(JSON.stringify({ type, data }));
        else c.endpoint.close(4008, "Reliable control backlog");
        return ok;
    }
    receiveDatagram(sessionId: string, bytes: Uint8Array) {
        this.bytesIn += bytes.byteLength;
        const c = this.sessions.get(sessionId);
        if (!c?.ready) return;
        if (c.input) {
            const batch = decodeInputs(bytes);
            if (batch) {
                if (c.groupHold || c.activeWorld) c.ack = c.input.discard(batch, Date.now());
                else c.input.receive(batch);
            }
            return;
        }
        if (c.groupHold || c.activeWorld) return;
        const m = decodeMovement(bytes);
        if (!m || m.sequence <= c.person.seq || m.sequence <= (c.pendingMove?.sequence ?? -1)) return;
        c.pendingMove = m;
    }
    private move(c: Connection, data: any) {
        if (c.groupHold || c.activeWorld) return;
        const before = { x: c.pose.x, y: c.pose.y, z: c.pose.z, at: c.person.movedAt };
        const ack = this.model.move(c.person, data, Date.now());
        if (!ack) {
            if (++c.strikes > 100) c.endpoint.close(4002, "Invalid movement");
            return;
        }
        if (ack.corrected) this.corrections++;
        if (Math.hypot(c.person.x - before.x, c.person.y - before.y, c.person.z - before.z) > 0.002 || !c.person.floor) this.setFlash(c, null);
        c.ack = ack;
        Object.assign(c.pose, { sequence: c.person.seq, x: c.person.x, y: c.person.y, z: c.person.z, yaw: c.person.yaw, animation: c.person.animation, floor: c.person.floor, revision: c.person.revision });
        const dt = Math.max(0.05, (Date.now() - before.at) / 1000);
        c.pose.vx = Math.max(-8, Math.min(8, (c.pose.x - before.x) / dt));
        c.pose.vy = Math.max(-12, Math.min(12, (c.pose.y - before.y) / dt));
        c.pose.vz = Math.max(-8, Math.min(8, (c.pose.z - before.z) / dt));
        this.shared.write(c.pose);
    }
    receiveControl(sessionId: string, type: string, data: any) {
        const c = this.sessions.get(sessionId);
        if (!c) return;
        this.bytesIn += Buffer.byteLength(JSON.stringify({ type, data }));
        if (type === "lobby-move") {
            if (c.ready && !c.input && this.allow(c, "move")) this.move(c, data);
            return;
        }
        if (type === "lobby-flash") {
            if (!c.ready) return;
            if (data?.flash === null) { this.setFlash(c, null); return; }
            if (c.groupHold || c.activeWorld) return;
            const flash = data?.flash && typeof data.flash === "object" && !Array.isArray(data.flash)
                ? readLobbyFlash({ ...data.flash, startedAt: Date.now() }) : null;
            if (!flash || c.person.profile.flash?.nonce === flash.nonce || !this.allow(c, "flash")) return;
            this.setFlash(c, flash);
            return;
        }
        const rate = type === "rtc-signal" ? "signal" : type === "lobby-profile" ? "profile" : (type === "chat-channel" || type === "chat-peer" || (type === "lobby-group-action" && data?.action === "message")) ? "chat" : "request";
        if (!this.allow(c, rate)) return;
        if (type === "lobby-ready") {
            if (c.ready) return;
            c.ready = true;
            c.velocitySnapshots = data?.motion === "velocity-v1";
            if (data?.movement === "input-v1") c.input = new InputAuthority({ x: c.pose.x, y: c.pose.y, z: c.pose.z, rotation: c.pose.yaw }, Date.now());
            this.control(c, "lobby-welcome", { lobbyProtocol: 2, flash: true, movement: c.input ? "input-v1" : "pose-v1", sessionId, roomId: this.options.roomId, region: this.options.region, partyIdentity: c.person.profile.partyIdentity, role: this.roles.get(c.id) || null, tickRate: 20, aoiLimit: this.networkBudget, voiceLimit: 8, position: [c.pose.x, c.pose.y, c.pose.z, c.pose.yaw], snapshotRates: { near: 20, mid: 5, far: 2 }, snapshotBands: this.networkBudget === 64 ? [8, 32, 64] : [16, 48, 128], epoch: this.options.epoch });
            this.options.post({ type: "group-ready", actor: c.id });
            return;
        }
        if (!c.ready) return;
        if (type === "lobby-group-action") {
            this.options.post({ type: "group-action", actor: c.id, data });
        } else if (type === "lobby-ping") {
            if ((typeof data?.id === "number" || typeof data?.id === "string") && String(data.id).length <= 64 && Number.isFinite(data.clientTime)) this.control(c, "lobby-pong", { id: data.id, clientTime: data.clientTime, serverTime: Date.now() });
        } else if (type === "lobby-profile") {
            if (!data || typeof data !== "object") return;
            const member = this.members.get(c.id)!;
            const next = profile(sessionId, { ...member.profile, username: data.username ?? member.profile.username, avatar: data.avatar ?? member.profile.avatar, VRM: data.VRM ?? member.profile.VRM, scale: data.scale ?? member.profile.scale }, member.profile.partyIdentity, member.profile.flash);
            const role = this.roles.get(c.id);
            member.profile = role ? { ...next, role } : next;
            c.stageRevision = -2;
            member.revision++;
            c.person.profile = member.profile;
            this.rosterRevision++;
            this.options.post({ type: "profile", member });
        } else if (type === "lobby-interest") {
            c.pins = Array.isArray(data?.peers) ? Array.from(new Set<number>(data.peers.map(Number).filter((id: number) => Number.isSafeInteger(id) && id > 0))).slice(0, 8) : [];
        } else if (type === "chat-channel") {
            if (data?.type !== "MESSAGE" || typeof data.text !== "string") return;
            const text = data.text.trim().slice(0, 500);
            if (!text) return;
            const message = { from: sessionId, server_ts: Date.now(), data: { type: "MESSAGE", text, acc_date: new Date().toISOString() } };
            this.control(c, "chat-channel", message);
            this.options.post({ type: "relay", from: c.id, to: c.visible.filter((id) => this.near(c.id, id, 32)), event: "chat-channel", data: message });
        } else if (type === "chat-peer") {
            if (typeof data?.to !== "string" || data.data?.type !== "MESSAGE" || typeof data.data.text !== "string") return;
            const to = Number(data.to),
                text = data.data.text.trim().slice(0, 500);
            if (!Number.isSafeInteger(to) || String(to) !== data.to || to === c.id || !this.members.has(to) || !text) return;
            this.options.post({ type: "relay", from: c.id, to: [to], event: "chat-peer", data: { from: sessionId, to: String(to), server_ts: Date.now(), profile: { username: c.person.profile.username, avatar: c.person.profile.avatar }, data: { type: "MESSAGE", text } } });
        } else if (type === "rtc-ready") {
            c.person.voiceReady = !c.activeWorld && data?.enabled !== false;
            Atomics.store(this.shared.voice, c.slot * VOICE_STRIDE, Number(c.person.voiceReady));
            if (!c.person.voiceReady) for (let i = 1; i < VOICE_STRIDE; i++) Atomics.store(this.shared.voice, c.slot * VOICE_STRIDE + i, 0);
        } else if (type === "rtc-signal") {
            const to = Number(data?.to);
            if (c.activeWorld || !Number.isSafeInteger(to) || !data?.payload || !["offer", "answer", "candidate"].includes(data.payload.kind) || JSON.stringify(data.payload).length > 15000 || !this.mutualVoice(c.id, to) || !this.near(c.id, to, STAGE_VOICE_EXIT_RADIUS)) return;
            this.options.post({ type: "relay", from: c.id, to: [to], event: "rtc-signal", data: { from: sessionId, payload: data.payload } });
        } else if (type === "lobby-teleport") {
            // Go to someone, or answer an admin's summon: land on a ring
            // around them, 2 m out, or 10 m like a summon in spaces.
            const to = Number(data?.sessionId),
                radius = data?.radius === SUMMON_RADIUS ? SUMMON_RADIUS : 2,
                target = this.actors.get(to);
            if (c.groupHold || c.activeWorld || to === c.id || !target || typeof data?.sessionId !== "string") return;
            const away = Math.hypot(target.x - c.pose.x, target.z - c.pose.z);
            if (radius === SUMMON_RADIUS && away <= SUMMON_RADIUS) return;
            const angle = Math.random() * Math.PI * 2,
                x = target.x + Math.cos(angle) * radius,
                z = target.z + Math.sin(angle) * radius;
            this.place(c, x, z, Math.atan2(target.x - x, target.z - z));
        } else if (type === "lobby-summon") {
            if (!this.roles.has(c.id)) return;
            this.options.post({ type: "stage-action", actor: c.id, data: { kind: "summon" } });
        } else if (type === "lobby-voice-request") {
            this.options.post({ type: "stage-action", actor: c.id, data: { kind: "request", cancel: data?.cancel === true } });
        } else if (type === "lobby-stage-leave") {
            this.options.post({ type: "stage-action", actor: c.id, data: { kind: "leave" } });
        } else if (type === "lobby-admin") {
            const action = data?.action,
                target = data?.sessionId;
            if (!(STAGE_ACTIONS as readonly string[]).includes(action) || typeof target !== "string" || !/^[1-9][0-9]{0,9}$/.test(target)) return;
            if (!this.roles.has(c.id)) {
                this.control(c, "lobby-admin-result", { action, sessionId: target, ok: false, error: "You’re not an admin here." });
                return;
            }
            this.options.post({ type: "stage-action", actor: c.id, data: { kind: "admin", action, sessionId: target } });
        } else if (type === "attr-get-user" || type === "attr-get-channel") this.control(c, "attr-reply", { requestId: typeof data?.requestId === "string" ? data.requestId.slice(0, 128) : "", values: {} });
    }
    private setFlash(c: Connection, flash: LobbyFlash | null) {
        const prior = this.members.get(c.id);
        if (!prior || (!flash && !prior.profile.flash)) return;
        const member = { ...prior, profile: { ...prior.profile, flash }, revision: prior.revision + 1 };
        c.person.profile = member.profile;
        this.member(member);
        this.options.post({ type: "profile", member });
    }
    deliver(from: number, to: number, event: string, data: any) {
        const c = this.sessions.get(String(to));
        if (!c?.ready) return;
        if (event === "chat-channel") {
            if (!c.visible.includes(from) || !this.near(from, to, 32)) return;
        } else if (event === "chat-peer") {
            if (!this.members.has(from) || data?.from !== String(from) || data?.to !== c.sessionId) return;
        } else if (event === "rtc-signal" && (!this.mutualVoice(from, to) || !this.near(from, to, STAGE_VOICE_EXIT_RADIUS))) return;
        if (!this.control(c, event, data)) c.endpoint.close(4008, "Reliable control backlog");
    }
    deliverGroup(to: string, event: string, data: unknown) {
        const c = this.sessions.get(to);
        if (c?.ready && ["lobby-groups", "lobby-group-result"].includes(event)) this.control(c, event, data);
    }
    placeGroup(id: string, travelId: string, pose: LobbyGroupPose, peers: string[], held: boolean) {
        const c = this.sessions.get(id);
        if (!c?.ready || !pose || ![pose.x, pose.y, pose.z, pose.rotation].every(Number.isFinite)) return;
        if (!held && c.groupHold !== travelId) return;
        this.setFlash(c, null);
        c.groupHold = held ? travelId : undefined;
        c.groupPins = held ? peers.map(Number).filter(id => Number.isSafeInteger(id) && id > 0).slice(0, 7) : [];
        c.pendingMove = null;
        Object.assign(c.pose, { x: pose.x, y: 0, z: pose.z, yaw: pose.rotation, vx: 0, vy: 0, vz: 0, animation: -1, floor: true, revision: c.pose.revision + 1 });
        Object.assign(c.person, { x: pose.x, y: 0, z: pose.z, yaw: pose.rotation, animation: -1, floor: true, movedAt: Date.now(), revision: c.pose.revision });
        if (c.input) c.ack = c.input.place({ x: pose.x, y: 0, z: pose.z, rotation: pose.rotation, animation: -1, floor: true }, Date.now());
        else c.ack = { seq: c.person.seq, position: [pose.x, 0, pose.z, pose.rotation], animation: -1, floor: true, serverTime: Date.now(), corrected: true };
        if (!c.activeWorld) this.shared.write(c.pose);
        this.control(c, "lobby-group-position", { travelId, pose: { ...pose, y: 0 }, held, serverNow: Date.now() });
        this.control(c, "lobby-ack", c.ack); c.ack = null;
        if (held) this.options.post({ type: "group-placed", actor: c.id, travelId });
    }
    groupPresence(id: string, active: boolean) {
        const c = this.sessions.get(id);
        if (!c?.ready) return;
        if (active) this.setFlash(c, null);
        c.activeWorld = active; c.pendingMove = null;
        if (active) {
            c.person.voiceReady = false;
            this.shared.remove(c.slot, c.id);
            this.receiveVoiceOff(c);
        } else {
            this.shared.write(c.pose);
            if (c.input) c.ack = c.input.place({ x: c.pose.x, y: 0, z: c.pose.z, rotation: c.pose.yaw, animation: -1, floor: true }, Date.now());
        }
    }
    private place(c: Connection, x: number, z: number, yaw: number) {
        this.setFlash(c, null);
        c.pendingMove = null;
        Object.assign(c.pose, { x, y: 0, z, yaw, vx: 0, vy: 0, vz: 0, animation: -1, floor: true, revision: c.pose.revision + 1 });
        Object.assign(c.person, { x, y: 0, z, yaw, animation: -1, floor: true, movedAt: Date.now(), revision: c.pose.revision });
        if (c.input) c.ack = c.input.place({ x, y: 0, z, rotation: yaw, animation: -1, floor: true }, Date.now());
        else c.ack = { seq: c.person.seq, position: [x, 0, z, yaw], animation: -1, floor: true, serverTime: Date.now(), corrected: true };
        this.shared.write(c.pose);
        this.control(c, "lobby-group-position", { travelId: "teleport", pose: { x, y: 0, z, rotation: yaw }, held: false, serverNow: Date.now() });
        this.control(c, "lobby-ack", c.ack);
        c.ack = null;
    }
    /** An admin's "bring everyone here", for everyone further than the summon ring. */
    summon(from: number) {
        const member = this.members.get(from),
            origin = this.actors.get(from);
        if (!member || !origin) return;
        const data = { sessionId: String(from), username: member.profile.username, avatar: member.profile.avatar, radius: SUMMON_RADIUS };
        for (const c of this.sessions.values())
            if (c.ready && c.id !== from && !c.activeWorld && !c.groupHold && Math.hypot(c.pose.x - origin.x, c.pose.z - origin.z) > SUMMON_RADIUS)
                this.control(c, "lobby-summon", data);
    }
    /** The main thread's moderation state; every worker holds the same copy. */
    setStage(stage: StageSnapshot) {
        if (!stage || stage.revision === this.stageState.revision) return;
        this.stageState = stage;
        this.speakers = new Set(stage.speakers);
        this.roles = new Map(stage.roles);
        // Roles travel in profiles too, so rosters on every worker can badge admins.
        for (const c of this.sessions.values()) {
            const member = this.members.get(c.id),
                role = this.roles.get(c.id);
            if (!member || member.profile.role === role) continue;
            const { role: _previous, ...base } = member.profile;
            const next = { ...member, profile: role ? { ...base, role } : base, revision: member.revision + 1 };
            c.person.profile = next.profile;
            this.member(next);
            this.options.post({ type: "profile", member: next });
        }
    }
    deliverStageResult(id: number, data: any) {
        const c = this.sessions.get(String(id));
        if (c?.ready) this.control(c, "lobby-admin-result", data);
    }
    kick(id: number) {
        const c = this.sessions.get(String(id));
        if (!c) return;
        if (c.ready) this.control(c, "kick", { reason: "Removed by an admin" });
        c.endpoint.close(4003, "Removed by an admin");
        this.disconnect(c.sessionId);
    }
    private stageView(c: Connection) {
        const stage = this.stageState,
            admin = this.roles.has(c.id);
        const entry = (id: number) => {
            const p = this.members.get(id)?.profile;
            return p && { sessionId: String(id), username: p.username, avatar: p.avatar, role: this.roles.get(id) };
        };
        return {
            speakers: stage.speakers.map(entry).filter(Boolean),
            limit: stage.limit,
            role: this.roles.get(c.id) || null,
            muted: stage.muted.includes(c.id),
            requested: stage.requests.includes(c.id),
            // Only admins see who asked to speak, and who is muted.
            requests: admin ? stage.requests.map(entry).filter(Boolean) : [],
            mutedPeople: admin ? stage.muted.map(String) : [],
            spatial: true,
        };
    }
    private receiveVoiceOff(c: Connection) {
        for (const id of c.voice) this.control(c, "rtc-leave", { sessionId: String(id) });
        c.voice = [];
        c.voiceKey = "";
        this.control(c, "lobby-voice", { peers: [] });
    }
    private near(a: number, b: number, radius: number) {
        const x = this.actors.get(a),
            y = this.actors.get(b);
        return !!x && !!y && (x.x - y.x) ** 2 + (x.z - y.z) ** 2 <= radius * radius;
    }
    /**
     * Only admin-approved speakers send audio, like spaces on oncyber.io.
     * A speaker picks the other speakers in range (two-way); everyone else
     * picks the speakers in range to hear. The speaker then accepts its
     * nearest listeners who picked it. Voice reaches past the avatars you
     * can see, so this reads every actor's pose, not the AOI.
     */
    private selectVoice(c: Connection) {
        const peers: number[] = [], scores: number[] = [];
        for (const id of this.speakers) {
            if (id === c.id) continue;
            const member = this.members.get(id), pose = this.actors.get(id);
            if (!member || !pose || !Atomics.load(this.shared.voice, member.slot * VOICE_STRIDE)) continue;
            const retained = c.voice.includes(id);
            const distance = Math.hypot(pose.x - c.pose.x, pose.z - c.pose.z);
            if (distance > (retained ? STAGE_VOICE_EXIT_RADIUS : STAGE_VOICE_RADIUS)) continue;
            this.rank(peers, scores, id, distance - (retained ? 2 : 0), VOICE_PICKS);
        }
        return peers;
    }
    private selectHearers(c: Connection) {
        const peers: number[] = [], scores: number[] = [];
        if (!this.speakers.has(c.id)) return peers;
        for (const [id, pose] of this.actors) {
            if (id === c.id || this.speakers.has(id)) continue;
            const member = this.members.get(id);
            if (!member || !this.picked(member.slot, c.id)) continue;
            const distance = Math.hypot(pose.x - c.pose.x, pose.z - c.pose.z);
            if (distance <= STAGE_VOICE_EXIT_RADIUS) this.rank(peers, scores, id, distance, VOICE_HEARERS);
        }
        return peers;
    }
    private rank(peers: number[], scores: number[], id: number, score: number, limit: number) {
        let at = peers.length;
        while (at > 0 && (score < scores[at - 1] || (score === scores[at - 1] && id < peers[at - 1]))) at--;
        if (at >= limit) return;
        peers.splice(at, 0, id); scores.splice(at, 0, score);
        if (peers.length > limit) { peers.pop(); scores.pop(); }
    }
    private picked(slot: number, id: number) {
        const row = slot * VOICE_STRIDE;
        for (let i = 1; i <= VOICE_PICKS; i++) if (Atomics.load(this.shared.voice, row + i) === id) return true;
        return false;
    }
    private hears(slot: number, id: number) {
        const row = slot * VOICE_STRIDE + 1 + VOICE_PICKS;
        for (let i = 0; i < VOICE_HEARERS; i++) {
            const value = Atomics.load(this.shared.voice, row + i);
            if (value === id) return true;
            if (!value) return false;
        }
        return false;
    }
    private hearersOf(slot: number) {
        const ids: number[] = [], row = slot * VOICE_STRIDE + 1 + VOICE_PICKS;
        for (let i = 0; i < VOICE_HEARERS; i++) {
            const id = Atomics.load(this.shared.voice, row + i);
            if (!id) break;
            ids.push(id);
        }
        return ids;
    }
    /** 0: no link. 1: two speakers. 2: a speaks to b. 3: a listens to b. */
    private voiceLink(a: number, b: number) {
        const x = this.members.get(a),
            y = this.members.get(b);
        if (!x || !y || !Atomics.load(this.shared.voice, x.slot * VOICE_STRIDE) || !Atomics.load(this.shared.voice, y.slot * VOICE_STRIDE)) return 0;
        const sa = this.speakers.has(a), sb = this.speakers.has(b);
        if (sa && sb) return this.picked(x.slot, b) && this.picked(y.slot, a) ? 1 : 0;
        if (sa) return this.picked(y.slot, a) && this.hears(x.slot, b) ? 2 : 0;
        if (sb) return this.picked(x.slot, b) && this.hears(y.slot, a) ? 3 : 0;
        return 0;
    }
    private mutualVoice(a: number, b: number) {
        return this.voiceLink(a, b) !== 0;
    }
    private roster(c: Connection) {
        if (c.lastRosterRevision === this.rosterRevision && c.population === this.members.size && c.visible.length === c.roster.size && c.visible.every((id) => c.roster.has(id))) return;
        const visible = new Set(c.visible),
            leave = Array.from(c.roster.keys()).filter((id) => !visible.has(id)),
            enter = c.visible
                .filter((id) => c.roster.get(id) !== this.members.get(id)?.revision)
                .map((id) => this.members.get(id))
                .filter(Boolean);
        let chunk: any[] = [];
        let size = 128;
        const flush = () => {
            if (!chunk.length) return true;
            if (c.endpoint.bufferedAmount() > 16 * 1024) return false;
            const ok = this.control(c, "lobby-roster", { enter: chunk, leave: [], population: this.members.size });
            if (ok) for (const p of chunk) c.roster.set(Number(p.sessionId), this.members.get(Number(p.sessionId))!.revision);
            chunk = [];
            size = 128;
            return ok;
        };
        if (leave.length || c.population !== this.members.size) {
            if (!this.control(c, "lobby-roster", { enter: [], leave: leave.map(String), population: this.members.size })) return;
            for (const id of leave) {
                c.roster.delete(id);
                c.sent.delete(id);
            }
            c.population = this.members.size;
        }
        for (const member of enter) {
            const p = member!.profile,
                n = Buffer.byteLength(JSON.stringify(p)) + 2;
            if (size + n > 15000 && !flush()) return;
            chunk.push(p);
            size += n;
        }
        if (!flush()) return;
        c.lastRosterRevision = this.rosterRevision;
    }
    step() {
        const started = performance.now(),
            now = Date.now();
        if (this.lastStepAt) {
            this.intervals.push(started - this.lastStepAt);
            if (this.intervals.length > 600) this.intervals.shift();
        }
        this.lastStepAt = started;
        this.tick++;
        const priorBudget = this.networkBudget;
        if (this.members.size > (this.options.detailThreshold || 4096)) this.networkBudget = 64;
        else if (this.members.size < Math.max(1, (this.options.detailThreshold || 4096) - 1024)) this.networkBudget = 128;
        if (priorBudget !== this.networkBudget) for (const c of this.sessions.values()) if (c.ready) this.control(c, "lobby-config", { aoiLimit: this.networkBudget, snapshotBands: this.networkBudget === 64 ? [8, 32, 64] : [16, 48, 128], snapshotRates: { near: 20, mid: 5, far: 2 } });
        const nearBand = this.networkBudget === 64 ? 8 : 16,
            midBand = this.networkBudget === 64 ? 32 : 48;
        for (const c of this.sessions.values()) {
            if (c.groupHold || c.activeWorld) continue;
            if (c.input) {
                const ack = c.input.advance(now);
                if (ack) {
                    if (ack.corrected) this.corrections++;
                    c.ack = ack;
                    const p = c.input.state;
                    if (Math.hypot(c.pose.x - p.x, c.pose.y - p.y, c.pose.z - p.z) > 0.002 || !p.floor) this.setFlash(c, null);
                    const changed = Math.abs(c.pose.x - p.x) + Math.abs(c.pose.y - p.y) + Math.abs(c.pose.z - p.z) + Math.abs(c.pose.yaw - p.rotation) > 0.00001 || c.pose.animation !== p.animation || c.pose.floor !== p.floor;
                    Object.assign(c.pose, { sequence: ack.seq, x: p.x, y: p.y, z: p.z, yaw: p.rotation, animation: p.animation, floor: p.floor, revision: c.pose.revision + Number(changed) });
                    c.pose.vx = Math.cos(c.input.yaw) * p.vx + Math.sin(c.input.yaw) * p.vz;
                    c.pose.vz = -Math.sin(c.input.yaw) * p.vx + Math.cos(c.input.yaw) * p.vz;
                    c.pose.vy = p.vy;
                    Object.assign(c.person, { x: p.x, y: p.y, z: p.z, yaw: p.rotation, animation: p.animation, floor: p.floor, seq: ack.seq });
                    this.shared.write(c.pose);
                }
            }
            const m = c.pendingMove;
            if (m) {
                c.pendingMove = null;
                this.move(c, [m.sequence, m.x, m.y, m.z, m.yaw, m.animation, m.floor]);
            }
        }
        for (const [token, r] of this.reservations) if (r.expires < now) this.reservations.delete(token);
        const simulatedAt = performance.now();
        this.stages.simulation = simulatedAt - started;
        for (const member of this.members.values()) {
            const p = this.slots[member.slot];
            if (this.shared.read(member.slot, p) && p.id === member.id) {
                this.actors.set(p.id, p);
                const cell = (Math.floor(p.x / 8) + 32768) * 65536 + Math.floor(p.z / 8) + 32768;
                if (this.indexCells.get(p.id) !== cell) {
                    this.indexCells.set(p.id, cell);
                    this.indexDirty = true;
                }
                const cached = this.encoded.get(p.id);
                if (!cached) {
                    const bytes = encodePose([p.id, p.sequence, p.x, p.y, p.z, p.yaw, p.animation, p.floor]);
                    const motion = encodeMotionPose([p.id, this.tick, p.x, p.y, p.z, p.yaw, p.animation, p.floor, p.vx, p.vy, p.vz]);
                    this.encoded.set(p.id, { revision: p.revision, bytes, view: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), motion, motionView: new DataView(motion.buffer), urgentRevision: p.revision });
                } else if (cached.revision !== p.revision) {
                    const old = cached.motionView,
                        ox = old.getInt16(16, true) / 256,
                        oz = old.getInt16(20, true) / 256;
                    const speed = Math.hypot(p.vx, p.vz),
                        priorSpeed = Math.hypot(ox, oz);
                    if (cached.motion[23] !== Number(p.floor) || old.getInt8(22) !== p.animation || (priorSpeed >= 0.1 && speed < 0.1) || (speed > 0.5 && priorSpeed > 0.5 && (ox * p.vx + oz * p.vz) / (speed * priorSpeed) < 0.5)) cached.urgentRevision = p.revision;
                    encodeMotionPose([p.id, this.tick, p.x, p.y, p.z, p.yaw, p.animation, p.floor, p.vx, p.vy, p.vz], cached.motion);
                    cached.view.setFloat32(8, p.x, true);
                    cached.view.setFloat32(12, p.y, true);
                    cached.view.setFloat32(16, p.z, true);
                    cached.view.setFloat32(20, p.yaw, true);
                    cached.view.setInt8(24, p.animation);
                    cached.view.setUint8(25, Number(p.floor));
                    cached.revision = p.revision;
                }
                this.encoded.get(p.id)!.view.setUint32(4, this.tick, true);
                this.encoded.get(p.id)!.motionView.setUint32(4, this.tick, true);
            } else this.actors.delete(member.id);
        }
        if (this.indexDirty) {
            this.index.rebuild(this.actors.values());
            this.indexDirty = false;
        }
        const refreshedAt = performance.now();
        this.stages.refresh = refreshedAt - simulatedAt;
        let interestMs = 0;
        for (const c of this.sessions.values()) {
            if (!c.ready) {
                if (now - c.connectedAt > 10000) c.endpoint.close(4008, "Ready timeout");
                continue;
            }
            if (c.activeWorld) continue;
            const buffer = c.endpoint.bufferedAmount();
            if (buffer > 16 * 1024) {
                c.slowAt ||= now;
                this.drops++;
                if (buffer > 128 * 1024 || now - c.slowAt > 5000) c.endpoint.close(4008, "Slow connection");
                continue;
            }
            c.slowAt = 0;
            if (c.ack && (c.ack.corrected || this.tick % 4 === c.phase % 4) && this.control(c, "lobby-ack", c.ack)) c.ack = null;
            if (!c.visible.length || this.tick % 4 === c.phase % 4) {
                const interestAt = performance.now();
                c.visible = this.index.select(c.pose, c.visible, this.actors, [...(c.groupPins || []), ...c.pins], this.networkBudget);
                interestMs += performance.now() - interestAt;
                this.candidateVisits += this.index.candidateVisits;
                this.roster(c);
                if (c.person.voiceReady) {
                    const picks = this.selectVoice(c),
                        hearers = this.selectHearers(c),
                        row = c.slot * VOICE_STRIDE;
                    for (let i = 0; i < VOICE_PICKS; i++) Atomics.store(this.shared.voice, row + 1 + i, picks[i] || 0);
                    for (let i = 0; i < VOICE_HEARERS; i++) Atomics.store(this.shared.voice, row + 1 + VOICE_PICKS + i, hearers[i] || 0);
                }
            } else if (this.tick % 20 === c.phase % 20) this.roster(c);
            if (c.stageRevision !== this.stageState.revision && this.stageState.revision >= 0 && this.control(c, "lobby-stage", this.stageView(c))) c.stageRevision = this.stageState.revision;
            if ((c.person.voiceReady || c.voice.length) && this.tick % 4 === c.phase % 4) {
                const voice: number[] = [], listenOnly: string[] = [], speakOnly: string[] = [];
                // Speakers' links name them; listeners' links come from speakers' rows.
                const candidates = this.speakers.has(c.id) ? [...this.speakers, ...this.hearersOf(c.slot)] : this.speakers;
                for (const id of candidates) {
                    if (id === c.id) continue;
                    const link = this.voiceLink(c.id, id);
                    if (!link) continue;
                    voice.push(id);
                    if (link === 2) speakOnly.push(String(id));
                    else if (link === 3) listenOnly.push(String(id));
                }
                voice.sort((a, b) => a - b);
                listenOnly.sort(); speakOnly.sort();
                const key = `${listenOnly.join()}|${speakOnly.join()}`;
                if (key !== c.voiceKey || voice.length !== c.voice.length || voice.some((id, i) => id !== c.voice[i])) {
                    if (this.control(c, "lobby-voice", { peers: voice.map(String), listenOnly, speakOnly })) {
                        for (const id of c.voice) if (!voice.includes(id)) this.control(c, "rtc-leave", { sessionId: String(id) });
                        for (const id of voice) if (!c.voice.includes(id)) this.control(c, "rtc-join", { sessionId: String(id) });
                        c.voice = voice;
                        c.voiceKey = key;
                    }
                }
            }
            const poses: Uint8Array[] = [],
                sent: number[] = [];
            for (let i = 0; i < c.visible.length; i++) {
                const id = c.visible[i],
                    p = this.actors.get(id),
                    encoded = this.encoded.get(id);
                if (!p || !encoded || !c.roster.has(id)) continue;
                const prior = c.sent.get(id),
                    heartbeat = !prior || now - prior.at >= (c.velocitySnapshots && Math.hypot(p.vx, p.vy, p.vz) < 0.02 ? 2000 : 500);
                const urgent = c.velocitySnapshots && (!prior || prior.revision < encoded.urgentRevision);
                if (!heartbeat && !urgent && i >= nearBand && (i < midBand ? this.tick % 4 !== c.phase % 4 : this.tick % 10 !== c.phase % 10)) continue;
                if (!heartbeat && prior?.revision === p.revision) continue;
                poses.push(c.velocitySnapshots ? encoded.motion : encoded.bytes);
                sent.push(id);
            }
            if (poses.length) {
                let ok = true;
                for (const bytes of encodeSnapshotParts({ epoch: this.options.epoch, tick: this.tick, serverTime: now, poses, motion: c.velocitySnapshots }, c.endpoint.maxDatagramSize?.() || 1200)) {
                    if (!c.endpoint.sendDatagram(bytes)) {
                        ok = false;
                        this.drops++;
                        break;
                    }
                    this.bytesOut += bytes.byteLength;
                }
                if (ok) {
                    for (const id of sent) {
                        const prior = c.sent.get(id);
                        if (prior) {
                            prior.revision = this.actors.get(id)!.revision;
                            prior.at = now;
                        } else c.sent.set(id, { revision: this.actors.get(id)!.revision, at: now });
                    }
                }
            }
        }
        this.stages.interest = interestMs;
        this.stages.delivery = performance.now() - refreshedAt - interestMs;
        this.samples.push(performance.now() - started);
        if (this.samples.length > 600) this.samples.shift();
    }
    resetSamples() {
        this.samples = [];
        this.intervals = [];
    }
    stats() {
        const sorted = this.samples.slice().sort((a, b) => a - b);
        const cadence = this.intervals.slice().sort((a, b) => a - b);
        const inputs = Array.from(this.sessions.values()).flatMap(c => c.input ? [c.input.diagnostics()] : []);
        return { tickIntervalMs: { p50: cadence[Math.floor(cadence.length * .5)] || 0, p95: cadence[Math.floor(cadence.length * .95)] || 0, p99: cadence[Math.floor(cadence.length * .99)] || 0 }, input: { maxQueued: Math.max(0, ...inputs.map(i => i.queued)), missing: inputs.reduce((sum, i) => sum + i.missing, 0), simulated: inputs.reduce((sum, i) => sum + i.simulated, 0) }, worker: this.options.owner, networkBudget: this.networkBudget, stageMs: { ...this.stages }, snapshotBands: this.networkBudget === 64 ? [8, 32, 64] : [16, 48, 128], connections: this.sessions.size, ready: Array.from(this.sessions.values()).filter((c) => c.ready).length, population: this.members.size, tick: this.tick, tickMs: { p50: sorted[Math.floor(sorted.length * 0.5)] || 0, p95: sorted[Math.floor(sorted.length * 0.95)] || 0, p99: sorted[Math.floor(sorted.length * 0.99)] || 0 }, sentBytes: this.bytesOut, receivedBytes: this.bytesIn, droppedSnapshots: this.drops, corrections: this.corrections, aoiMax: Math.max(0, ...Array.from(this.sessions.values(), (c) => c.visible.length)), voiceMax: Math.max(0, ...Array.from(this.sessions.values(), (c) => c.voice.length)), candidateVisits: this.candidateVisits };
    }
}
