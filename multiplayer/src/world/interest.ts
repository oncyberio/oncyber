import { ActorPose } from "./shared";
export const AOI_LIMIT = 128;
export const CANDIDATE_LIMIT = 384;
const CELL = 8;
const offsets: Array<[number, number]> = [];
for (let x = -7; x <= 7; x++) for (let z = -7; z <= 7; z++) offsets.push([x, z]);
offsets.sort((a, b) => a[0] * a[0] + a[1] * a[1] - b[0] * b[0] - b[1] * b[1]);
const key = (x: number, z: number) => (x + 32768) * 65536 + z + 32768;
interface Rank {
    pose: ActorPose;
    score: number;
}
const compare = (a: Rank, b: Rank) => a.score - b.score || a.pose.id - b.pose.id;

/** Bounded selection, including a crowd concentrated entirely in one cell. */
export class InterestIndex {
    private cells = new Map<number, ActorPose[]>();
    private ranked: Rank[] = [];
    private pool: Rank[] = [];
    // Reused generation stamps avoid allocating a hash set for every viewer.
    private seen = new Uint32Array(16384);
    private generation = 0;
    candidateVisits = 0;
    private limit = AOI_LIMIT;

    rebuild(poses: Iterable<ActorPose>) {
        this.cells.clear();
        for (const p of poses) {
            const k = key(Math.floor(p.x / CELL), Math.floor(p.z / CELL));
            let cell = this.cells.get(k);
            if (!cell) this.cells.set(k, (cell = []));
            cell.push(p);
        }
    }

    private offer(p: ActorPose, viewer: ActorPose, retained: boolean, pinned = false) {
        if (p.id === viewer.id) return;
        if (p.slot >= this.seen.length) {
            const grown = new Uint32Array(2 ** Math.ceil(Math.log2(p.slot + 1)));
            grown.set(this.seen);
            this.seen = grown;
        }
        if (this.seen[p.slot] === this.generation) return;
        this.seen[p.slot] = this.generation;
        const dx = p.x - viewer.x,
            dz = p.z - viewer.z;
        const squared = dx * dx + dz * dz;
        if (squared > (retained ? 52 * 52 : 48 * 48)) return;
        const score = Math.sqrt(squared) - (retained ? 2 : 0) - (pinned ? 1000 : 0);
        const heap = this.ranked;
        if (heap.length < this.limit) {
            const index = heap.length;
            const entry = this.pool[index] || (this.pool[index] = { pose: p, score });
            entry.pose = p;
            entry.score = score;
            heap.push(entry);
            let child = index;
            while (child > 0) {
                const parent = (child - 1) >> 1;
                if (heap[parent].score >= score) break;
                heap[child] = heap[parent];
                child = parent;
            }
            heap[child] = entry;
        } else if (score < heap[0].score) {
            const entry = heap[0];
            entry.pose = p;
            entry.score = score;
            let parent = 0;
            for (;;) {
                let child = parent * 2 + 1;
                if (child >= heap.length) break;
                if (child + 1 < heap.length && heap[child + 1].score > heap[child].score) child++;
                if (score >= heap[child].score) break;
                heap[parent] = heap[child];
                parent = child;
            }
            heap[parent] = entry;
        }
    }

    select(viewer: ActorPose, previous: number[], actors: Map<number, ActorPose>, pins: number[] = [], limit = AOI_LIMIT): number[] {
        this.limit = Math.max(1, Math.min(AOI_LIMIT, Math.floor(limit) || AOI_LIMIT));
        this.ranked.length = 0;
        this.candidateVisits = 0;
        this.generation = (this.generation + 1) >>> 0;
        if (!this.generation) {
            this.seen.fill(0);
            this.generation = 1;
        }
        for (let i = 0; i < Math.min(8, pins.length); i++) {
            const p = actors.get(pins[i]);
            if (p) this.offer(p, viewer, true, true);
        }
        for (const id of previous) {
            const p = actors.get(id);
            if (p) this.offer(p, viewer, true);
        }
        const cx = Math.floor(viewer.x / CELL),
            cz = Math.floor(viewer.z / CELL);
        const seed = Math.imul(viewer.id, 2654435761) >>> 0;
        for (const [dx, dz] of offsets) {
            const bucket = this.cells.get(key(cx + dx, cz + dz));
            if (!bucket) continue;
            const count = Math.min(bucket.length, CANDIDATE_LIMIT - this.candidateVisits);
            const start = seed % bucket.length;
            for (let i = 0; i < count; i++) {
                this.candidateVisits++;
                const p = bucket[(start + i) % bucket.length];
                // Buckets are rebuilt less often than poses. Departed or replaced
                // actors must not take an interest slot before the next rebuild.
                if (actors.get(p.id) === p) this.offer(p, viewer, false);
            }
            if (this.candidateVisits >= CANDIDATE_LIMIT) break;
        }
        this.ranked.sort(compare);
        return this.ranked.map((rank) => rank.pose.id);
    }
}
