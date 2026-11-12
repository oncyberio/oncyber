/** One writer per actor slot. Even/odd stamps prevent readers observing torn poses. */
export const STRIDE = 11;
export const FLAGS = 4;
export interface SharedWorldData {
    capacity: number;
    state: SharedArrayBuffer;
    poses: SharedArrayBuffer;
    voice: SharedArrayBuffer;
}
export interface ActorPose {
    id: number;
    slot: number;
    owner: number;
    sequence: number;
    x: number;
    y: number;
    z: number;
    yaw: number;
    animation: number;
    floor: boolean;
    revision: number;
    vx: number;
    vy: number;
    vz: number;
}
export function createSharedWorld(capacity: number): SharedWorldData {
    return { capacity, state: new SharedArrayBuffer(capacity * FLAGS * 4), poses: new SharedArrayBuffer(capacity * STRIDE * 8), voice: new SharedArrayBuffer(capacity * 9 * 4) };
}
export class SharedWorld {
    readonly flags: Int32Array;
    readonly values: Float64Array;
    readonly voice: Int32Array;
    constructor(readonly data: SharedWorldData) {
        this.flags = new Int32Array(data.state);
        this.values = new Float64Array(data.poses);
        this.voice = new Int32Array(data.voice);
    }
    write(p: ActorPose) {
        const f = p.slot * FLAGS,
            v = p.slot * STRIDE;
        Atomics.add(this.flags, f, 1);
        this.values[v] = p.sequence;
        this.values[v + 1] = p.x;
        this.values[v + 2] = p.y;
        this.values[v + 3] = p.z;
        this.values[v + 4] = p.yaw;
        this.values[v + 5] = p.animation;
        this.values[v + 6] = Number(p.floor);
        this.values[v + 7] = p.revision;
        this.values[v + 8] = p.vx || 0;
        this.values[v + 9] = p.vy || 0;
        this.values[v + 10] = p.vz || 0;
        Atomics.store(this.flags, f + 1, p.id);
        Atomics.store(this.flags, f + 2, p.owner);
        Atomics.add(this.flags, f, 1);
    }
    remove(slot: number, id: number) {
        const f = slot * FLAGS;
        if (Atomics.load(this.flags, f + 1) !== id) return;
        Atomics.add(this.flags, f, 1);
        Atomics.store(this.flags, f + 1, 0);
        this.voice.fill(0, slot * 9, slot * 9 + 9);
        Atomics.add(this.flags, f, 1);
    }
    /** Only the coordinator may call this after the owning worker has exited. */
    reclaimAfterWriterExit(slot: number) {
        const f = slot * FLAGS;
        Atomics.store(this.flags, f + 1, 0);
        Atomics.store(this.flags, f + 2, 0);
        this.voice.fill(0, slot * 9, slot * 9 + 9);
        const stamp = Atomics.load(this.flags, f);
        // Advance the generation instead of resetting to zero: a reader that
        // began before a crash must not mistake a reused slot for its old pose.
        Atomics.store(this.flags, f, (stamp | 1) + 1);
    }
    read(slot: number, out: ActorPose): boolean {
        const f = slot * FLAGS,
            v = slot * STRIDE,
            before = Atomics.load(this.flags, f);
        if (before & 1) return false;
        const id = Atomics.load(this.flags, f + 1);
        if (!id) return false;
        const owner = Atomics.load(this.flags, f + 2),
            sequence = this.values[v],
            x = this.values[v + 1],
            y = this.values[v + 2],
            z = this.values[v + 3],
            yaw = this.values[v + 4],
            animation = this.values[v + 5],
            floor = !!this.values[v + 6],
            revision = this.values[v + 7],
            vx = this.values[v + 8],
            vy = this.values[v + 9],
            vz = this.values[v + 10];
        if (before !== Atomics.load(this.flags, f)) return false;
        out.id = id;
        out.slot = slot;
        out.owner = owner;
        out.sequence = sequence;
        out.x = x;
        out.y = y;
        out.z = z;
        out.yaw = yaw;
        out.animation = animation;
        out.floor = floor;
        out.revision = revision;
        out.vx = vx;
        out.vy = vy;
        out.vz = vz;
        return true;
    }
}
export const blankPose = (slot: number): ActorPose => ({ id: 0, slot, owner: 0, sequence: 0, x: 0, y: 0, z: 0, yaw: 0, animation: -1, floor: true, revision: 0, vx: 0, vy: 0, vz: 0 });
