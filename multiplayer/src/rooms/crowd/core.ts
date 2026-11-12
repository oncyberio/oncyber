import { AOI_LIMIT, AOI_RADIUS, CANDIDATE_LIMIT, Move, Pose, Profile, STAGE_LISTENER_LIMIT, VOICE_LIMIT, VOICE_RADIUS, VOICE_EXIT_RADIUS } from "./protocol";

export class TokenBucket {
    private tokens: number;
    private updated: number;
    constructor(private rate: number, private capacity: number, now: number) {
        this.tokens = capacity;
        this.updated = now;
    }
    take(now: number, amount = 1): boolean {
        this.tokens = Math.min(this.capacity, this.tokens + (Math.max(0, now - this.updated) * this.rate) / 1000);
        this.updated = now;
        if (this.tokens < amount) return false;
        this.tokens -= amount;
        return true;
    }
}
export interface Person {
    id: string;
    profile: Profile;
    profileRevision: number;
    x: number;
    y: number;
    z: number;
    yaw: number;
    animation: number;
    floor: boolean;
    revision: number;
    seq: number;
    movedAt: number;
    horizontalCredit: number;
    verticalCredit: number;
    visible: Set<string>;
    voice: Set<string>;
    /** Linked peers this person hears but must not send its mic to. */
    listenOnly: Set<string>;
    /** Linked peers this person sends to but must not play. */
    speakOnly: Set<string>;
    voiceReady: boolean;
    /** Admin mute: may still listen, but never sends audio. */
    muted: boolean;
    cell: string;
    cellIndex: number;
}
const hash = (id: string) => {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
    return h >>> 0;
};
const distanceSq = (a: Person, b: Person) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const cellKey = (x: number, z: number) => `${Math.floor(x / 8)},${Math.floor(z / 8)}`;
const offsets: Array<[number, number]> = [];
for (let x = -7; x <= 7; x++) for (let z = -7; z <= 7; z++) offsets.push([x, z]);
offsets.sort((a, b) => a[0] * a[0] + a[1] * a[1] - b[0] * b[0] - b[1] * b[1]);

interface RankedPerson {
    peer: Person;
    score: number;
}
const compareRanked = (a: RankedPerson, b: RankedPerson) => a.score - b.score || a.peer.id.localeCompare(b.peer.id);
/** Keep only the best bounded candidates. The root is the worst retained entry;
 * rejected candidates allocate nothing, and admitted entries reuse a fixed pool. */
function offerRanked(heap: RankedPerson[], pool: RankedPerson[], peer: Person, score: number, limit: number) {
    if (heap.length < limit) {
        const index = heap.length;
        const entry = pool[index] || (pool[index] = { peer, score });
        entry.peer = peer;
        entry.score = score;
        heap.push(entry);
        let child = index;
        while (child > 0) {
            const parent = (child - 1) >> 1;
            if (compareRanked(heap[parent], entry) >= 0) break;
            heap[child] = heap[parent];
            child = parent;
        }
        heap[child] = entry;
        return;
    }
    const worst = heap[0];
    if (score > worst.score || (score === worst.score && peer.id.localeCompare(worst.peer.id) >= 0)) return;
    worst.peer = peer;
    worst.score = score;
    let parent = 0;
    while (true) {
        let child = parent * 2 + 1;
        if (child >= heap.length) break;
        if (child + 1 < heap.length && compareRanked(heap[child + 1], heap[child]) > 0) child++;
        if (compareRanked(worst, heap[child]) >= 0) break;
        heap[parent] = heap[child];
        parent = child;
    }
    heap[parent] = worst;
}

/** A bounded candidate AOI; approximate nearest in dense buckets, with retained-member hysteresis. */
export class CrowdModel {
    readonly people = new Map<string, Person>();
    /** Admin-selected speakers, in the order they were added. */
    readonly speakers = new Set<string>();
    private cells = new Map<string, Person[]>();
    lastCandidateVisits = 0;
    private readonly aoiHeap: RankedPerson[] = [];
    private readonly aoiPool: RankedPerson[] = [];
    private readonly voiceHeap: RankedPerson[] = [];
    private readonly voicePool: RankedPerson[] = [];
    private readonly voiceEdges: Array<{ a: Person; b: Person; score: number }> = [];
    private readonly voiceEdgePool: Array<{ a: Person; b: Person; score: number }> = [];
    add(id: string, metadata: Profile, now: number): Person {
        const seed = hash(id),
            angle = (seed % 6283) / 1000,
            radius = 2 + (seed % 600) / 100;
        const p: Person = { id, profile: metadata, profileRevision: 1, x: Math.cos(angle) * radius, y: 0, z: Math.sin(angle) * radius, yaw: 0, animation: -1, floor: true, revision: 1, seq: -1, movedAt: now, horizontalCredit: 1.5, verticalCredit: 1.5, visible: new Set(), voice: new Set(), listenOnly: new Set(), speakOnly: new Set(), voiceReady: false, muted: false, cell: "", cellIndex: -1 };
        this.people.set(id, p);
        this.index(p);
        return p;
    }
    remove(id: string) {
        const p = this.people.get(id);
        if (!p) return;
        this.unindex(p);
        this.people.delete(id);
        this.speakers.delete(id);
    }
    private unindex(p: Person) {
        const bucket = this.cells.get(p.cell);
        if (!bucket) return;
        const last = bucket.pop()!;
        if (last !== p) {
            bucket[p.cellIndex] = last;
            last.cellIndex = p.cellIndex;
        }
        if (!bucket.length) this.cells.delete(p.cell);
    }
    index(p: Person) {
        const key = cellKey(p.x, p.z);
        if (p.cell === key) return;
        this.unindex(p);
        const bucket = this.cells.get(key) || [];
        p.cell = key;
        p.cellIndex = bucket.length;
        bucket.push(p);
        this.cells.set(key, bucket);
    }
    move(p: Person, input: unknown, now: number) {
        if (!Array.isArray(input) || input.length !== 7) return null;
        const [seq, x, y, z, yaw, animation, floor] = input as Move;
        if (!Number.isSafeInteger(seq) || seq < 0 || seq <= p.seq || ![x, y, z, yaw].every((v) => typeof v === "number" && Number.isFinite(v)) || !Number.isInteger(animation) || animation < -1 || animation > 127 || typeof floor !== "boolean") return null;
        const dt = Math.min(0.25, Math.max(0, now - p.movedAt) / 1000);
        p.horizontalCredit = Math.min(1.5, p.horizontalCredit + dt * 6.5);
        p.verticalCredit = Math.min(1.5, p.verticalCredit + dt * 10);
        const targetX = Math.max(-200, Math.min(200, x)),
            targetZ = Math.max(-200, Math.min(200, z));
        const dx = targetX - p.x,
            dz = targetZ - p.z,
            distance = Math.hypot(dx, dz);
        const ratio = distance > 0 ? Math.min(1, p.horizontalCredit / distance) : 1;
        const nextY = Math.max(0, Math.min(3, y));
        const dy = Math.max(-p.verticalCredit, Math.min(p.verticalCredit, nextY - p.y));
        p.x += dx * ratio;
        p.z += dz * ratio;
        p.y += dy;
        p.horizontalCredit -= distance * ratio;
        p.verticalCredit -= Math.abs(dy);
        p.yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
        p.animation = animation;
        p.floor = p.y <= 0.02;
        p.seq = seq;
        p.movedAt = now;
        p.revision++;
        this.index(p);
        return { seq, serverTime: now, position: [p.x, p.y, p.z, p.yaw], animation: p.animation, floor: p.floor, corrected: Math.abs(p.x - x) + Math.abs(p.y - y) + Math.abs(p.z - z) > 0.002 || floor !== p.floor };
    }
    selectVisible(p: Person): Set<string> {
        const ranked = this.aoiHeap;
        ranked.length = 0;
        // Previous members are unique and already in this query. Their two-metre
        // preference is applied once, before adding new spatial candidates.
        for (const id of p.visible) {
            const peer = this.people.get(id);
            if (!peer) continue;
            const squared = distanceSq(p, peer);
            if (squared <= 52 ** 2) offerRanked(ranked, this.aoiPool, peer, Math.sqrt(squared) - 2, AOI_LIMIT);
        }
        const cx = Math.floor(p.x / 8),
            cz = Math.floor(p.z / 8),
            seed = hash(p.id);
        let visits = 0;
        for (const [dx, dz] of offsets) {
            const bucket = this.cells.get(`${cx + dx},${cz + dz}`);
            if (!bucket) continue;
            const count = Math.min(bucket.length, CANDIDATE_LIMIT - visits);
            const start = seed % bucket.length;
            for (let i = 0; i < count; i++) {
                const peer = bucket[(start + i) % bucket.length];
                visits++;
                if (peer === p || p.visible.has(peer.id)) continue;
                const squared = distanceSq(p, peer);
                if (squared <= AOI_RADIUS ** 2) offerRanked(ranked, this.aoiPool, peer, Math.sqrt(squared), AOI_LIMIT);
            }
            if (visits >= CANDIDATE_LIMIT) break;
        }
        this.lastCandidateVisits = visits;
        // Preserve nearest-first insertion order for distance-based snapshot tiers.
        ranked.sort(compareRanked);
        const visible = new Set<string>();
        for (const entry of ranked) visible.add(entry.peer.id);
        p.visible = visible;
        return visible;
    }
    updateVisibility() {
        for (const p of this.people.values()) this.selectVisible(p);
    }
    updateVoice() {
        // Only mutually visible, nearby, ready peers can negotiate. Every edge has a degree cap.
        const edges = this.voiceEdges;
        edges.length = 0;
        for (const p of this.people.values()) {
            if (!p.voiceReady) continue;
            const nearest = this.voiceHeap;
            nearest.length = 0;
            for (const id of p.visible) {
                const peer = this.people.get(id);
                if (!peer || !peer.voiceReady || !peer.visible.has(p.id)) continue;
                const squared = distanceSq(p, peer);
                const retained = p.voice.has(peer.id) && peer.voice.has(p.id);
                if (squared <= (retained ? VOICE_EXIT_RADIUS : VOICE_RADIUS) ** 2) offerRanked(nearest, this.voicePool, peer, squared, 16);
            }
            for (const { peer, score: squared } of nearest)
                if (p.id < peer.id) {
                    const score = Math.sqrt(squared) - (p.voice.has(peer.id) ? 2 : 0);
                    const index = edges.length;
                    const edge = this.voiceEdgePool[index] || (this.voiceEdgePool[index] = { a: p, b: peer, score });
                    edge.a = p;
                    edge.b = peer;
                    edge.score = score;
                    edges.push(edge);
                }
        }
        this.voiceEdgePool.length = edges.length;
        edges.sort((a, b) => a.score - b.score || a.a.id.localeCompare(b.a.id) || a.b.id.localeCompare(b.b.id));
        for (const p of this.people.values()) {
            p.voice.clear();
            p.listenOnly.clear();
            p.speakOnly.clear();
        }
        const proximity = new Map<Person, number>();
        for (const { a, b } of edges) {
            if (a.muted && b.muted) continue;
            const degreeA = proximity.get(a) || 0, degreeB = proximity.get(b) || 0;
            if (degreeA >= VOICE_LIMIT || degreeB >= VOICE_LIMIT) continue;
            proximity.set(a, degreeA + 1);
            proximity.set(b, degreeB + 1);
            if (a.muted) this.link(b, a, true);
            else if (b.muted) this.link(a, b, true);
            else this.link(a, b, false);
        }
        // Each speaker reaches its nearest ready listeners anywhere in the room.
        const ranked = this.voiceHeap;
        for (const id of this.speakers) {
            const speaker = this.people.get(id);
            if (!speaker?.voiceReady || speaker.muted) continue;
            ranked.length = 0;
            for (const peer of this.people.values())
                if (peer !== speaker && peer.voiceReady) offerRanked(ranked, this.voicePool, peer, distanceSq(speaker, peer), STAGE_LISTENER_LIMIT);
            for (const { peer } of ranked) this.link(speaker, peer, true);
        }
    }
    /** Adds a voice link; a one-way link becomes two-way when the reverse already exists. */
    private link(from: Person, to: Person, oneWay: boolean) {
        if (from.voice.has(to.id)) {
            // Existing two-way, or the same direction again: nothing to add.
            if (!from.listenOnly.has(to.id)) return;
            from.listenOnly.delete(to.id);
            to.speakOnly.delete(from.id);
            return;
        }
        from.voice.add(to.id);
        to.voice.add(from.id);
        if (!oneWay) return;
        from.speakOnly.add(to.id);
        to.listenOnly.add(from.id);
    }
    /** Both ends must agree, and proximity links must still be in range. */
    linked(a: Person, b: Person) {
        return a.voiceReady && b.voiceReady && a.voice.has(b.id) && b.voice.has(a.id) && (this.speakers.has(a.id) || this.speakers.has(b.id) || this.nearby(a, b, VOICE_EXIT_RADIUS));
    }
    pose(p: Person): Pose {
        return [p.id, Math.round(p.x * 100), Math.round(p.y * 100), Math.round(p.z * 100), Math.round(p.yaw * 1000), p.animation, Number(p.floor)];
    }
    nearby(a: Person, b: Person, radius: number) {
        return distanceSq(a, b) <= radius * radius;
    }
}
