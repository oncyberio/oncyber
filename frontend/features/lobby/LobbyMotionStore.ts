import type { LobbyPlayer, LobbyPose } from "./LobbyConnection";

export type LobbyMotionDiagnostics = {
    rttMs: number;
    jitterMs: number;
    interpolationMs: number;
    acceptedSnapshots: number;
    rejectedSnapshots: number;
    extrapolatedPlayers: number;
    frozenPlayers: number;
    bufferedPlayers: number;
    presentationErrorMeters: number;
};
type Point = LobbyPose & { time: number };
type Track = {
    player: LobbyPlayer;
    sampled: LobbyPlayer;
    points: Point[];
    sampledAt?: number;
    cadenceMs?: number;
    timeline?: number;
    playbackRate?: number;
    revision?: number;
    renderVx?: number;
    renderVz?: number;
};
const GRAVITY = 18;
/** Gravity only lowers vy in the air, so a rise above the ballistic
 * prediction between two samples is another launch. */
export function jumpCountAfter(previous: Point | undefined, point: Point) {
    if (!Number.isFinite(point.vy)) return undefined;
    if (point.y <= 0.001 && point.vy <= 0) return 0;
    const before = previous?.jumpCount ?? 0;
    if (!previous || !Number.isFinite(previous.vy) || before === 0) return 1;
    const dt = Math.max(0, point.time - previous.time) / 1000;
    const expected = previous.vy - GRAVITY * dt;
    return point.vy - expected > 2 ? Math.min(2, before + 1) : before;
}
const clamp = (x: number, min: number, max: number) =>
    Math.min(max, Math.max(min, x));
const angle = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));
const now = () => performance.now();

/** A bounded, imperative snapshot buffer. No frame or motion updates go through React. */
export class LobbyMotionStore {
    private tracks = new Map<string, Track>();
    private sampled: LobbyPlayer[] = [];
    private dirty = true;
    private sequence = -1;
    private serverTime = -Infinity;
    private lastArrival = 0;
    private effectiveDelay = 100;
    private clockOffset = 0;
    private clockKnown = false;
    private rtt = 0;
    private jitter = 0;
    private accepted = 0;
    private rejected = 0;
    private extrapolated = 0;
    private frozen = 0;
    private hasVelocity = false;
    private presentationError = 0;
    private lastSampleAt: number | undefined;
    constructor(private options: { smoothPresentation?: boolean } = {}) {}

    clear() {
        this.tracks.clear();
        this.lastSampleAt = undefined;
        this.hasVelocity = false;
        this.sampled.length = 0;
        this.dirty = true;
        this.effectiveDelay = 100;
        this.sequence = -1;
        this.serverTime = -Infinity;
        this.lastArrival = 0;
        this.clockKnown = false;
        this.clockOffset = 0;
        this.rtt = this.jitter = 0;
    }
    upsert(player: LobbyPlayer) {
        const track = this.tracks.get(player.id);
        if (track) {
            track.player = player;
            for (const key of [
                "name",
                "avatar",
                "isLocal",
                "partyIdentity",
                "flash",
                "vrmUrl",
                "scale",
            ] as const)
                (track.sampled as any)[key] = player[key];
        } else {
            this.tracks.set(player.id, {
                player,
                sampled: { ...player },
                points: [],
            });
            this.dirty = true;
        }
    }
    remove(id: string) {
        if (this.tracks.delete(id)) this.dirty = true;
    }
    observeClock(sent: number, received: number, serverTime: number) {
        const rtt = received - sent;
        if (
            ![sent, received, serverTime].every(Number.isFinite) ||
            rtt < 0 ||
            rtt > 10000
        )
            return;
        this.rtt = this.rtt ? this.rtt * 0.75 + rtt * 0.25 : rtt;
        const offset = serverTime - (sent + received) / 2;
        this.clockOffset =
            !this.clockKnown || Math.abs(offset - this.clockOffset) > 1000
                ? offset
                : this.clockOffset * 0.85 + offset * 0.15;
        this.clockKnown = true;
    }
    pushFrame(
        sequence: number,
        serverTime: number,
        poses: Array<[string, LobbyPose]>,
        received = now()
    ) {
        if (
            !Number.isSafeInteger(sequence) ||
            sequence <= this.sequence ||
            !Number.isFinite(serverTime) ||
            serverTime < this.serverTime
        ) {
            this.rejected++;
            return false;
        }
        if (!this.clockKnown) {
            this.clockOffset = serverTime - received;
            this.clockKnown = true;
        }
        if (this.lastArrival && Number.isFinite(this.serverTime)) {
            const variation = Math.abs(
                received - this.lastArrival - (serverTime - this.serverTime)
            );
            this.jitter = this.jitter * 0.85 + Math.min(500, variation) * 0.15;
        }
        this.sequence = sequence;
        this.serverTime = serverTime;
        this.lastArrival = received;
        this.accepted++;
        for (const [id, pose] of poses) {
            const track = this.tracks.get(id);
            if (
                !track ||
                track.player.isLocal ||
                ![pose.x, pose.y, pose.z, pose.rotation].every(Number.isFinite)
            )
                continue;
            if (
                Math.max(Math.abs(pose.x), Math.abs(pose.y), Math.abs(pose.z)) >
                100000
            )
                continue;
            this.append(track, { ...pose, time: serverTime });
        }
        return true;
    }
    /** Independent datagram chunks may share a tick, arrive out of order, or
     * be lost. Accept freshness per actor, never discard a whole late chunk. */
    pushChunk(
        tick: number,
        serverTime: number,
        poses: Array<[string, number, LobbyPose]>,
        received = now()
    ): Array<[string, LobbyPose]> {
        if (
            !Number.isSafeInteger(tick) ||
            tick < 0 ||
            !Number.isFinite(serverTime)
        ) {
            this.rejected++;
            return [];
        }
        const accepted: Array<[string, LobbyPose]> = [];
        for (const [id, revision, pose] of poses.slice(0, 256)) {
            const track = this.tracks.get(id);
            if (
                !track ||
                track.player.isLocal ||
                !Number.isInteger(revision) ||
                revision < 0 ||
                revision > 0xffffffff ||
                ![pose.x, pose.y, pose.z, pose.rotation].every(
                    Number.isFinite
                ) ||
                Math.max(Math.abs(pose.x), Math.abs(pose.y), Math.abs(pose.z)) >
                    100000
            )
                continue;
            const advance =
                track.revision === undefined
                    ? 1
                    : (revision - track.revision) >>> 0;
            if (
                !advance ||
                advance >= 0x80000000 ||
                serverTime < (track.points.at(-1)?.time ?? -Infinity)
            )
                continue;
            track.revision = revision;
            this.append(track, { ...pose, time: serverTime });
            accepted.push([id, pose]);
        }
        if (!accepted.length) {
            this.rejected++;
            return accepted;
        }
        if (!this.clockKnown) {
            this.clockOffset = serverTime - received;
            this.clockKnown = true;
        }
        // Only one arrival per advancing server tick contributes to jitter;
        // fragmented packets from the same tick must not inflate the delay.
        if (serverTime > this.serverTime) {
            if (this.lastArrival && Number.isFinite(this.serverTime)) {
                const variation = Math.abs(
                    received - this.lastArrival - (serverTime - this.serverTime)
                );
                this.jitter =
                    this.jitter * 0.85 + Math.min(500, variation) * 0.15;
            }
            this.serverTime = serverTime;
            this.lastArrival = received;
        }
        this.accepted++;
        return accepted;
    }
    private append(track: Track, point: Point) {
        if ([point.vx, point.vy, point.vz].every(Number.isFinite))
            this.hasVelocity = true;
        const previous = track.points.at(-1);
        const interval = previous ? point.time - previous.time : 0;
        // Stationary heartbeats do not describe active replication cadence.
        // The v2 far band deliberately moves at 2Hz, so a changed 500ms sample
        // must instead get a longer per-actor timeline for continuous playback.
        const moved =
            previous &&
            Math.abs(point.x - previous.x) +
                Math.abs(point.y - previous.y) +
                Math.abs(point.z - previous.z) +
                Math.abs(angle(point.rotation - previous.rotation)) >
                0.0001;
        if (interval > 0 && (interval < 400 || (interval <= 1200 && moved)))
            track.cadenceMs = track.cadenceMs
                ? track.cadenceMs * 0.75 + interval * 0.25
                : interval;
        if (!track.points.length) this.dirty = true;
        point.jumpCount = jumpCountAfter(
            previous?.time === point.time ? track.points.at(-2) : previous,
            point
        );
        if (track.points.at(-1)?.time === point.time)
            track.points[track.points.length - 1] = point;
        else track.points.push(point);
        while (
            track.points.length > 32 ||
            (track.points.length > 2 &&
                point.time - track.points[0].time > 1500)
        )
            track.points.shift();
    }
    sample = (at = now()): readonly LobbyPlayer[] => {
        // Metrics and rendering can read the same frame. A second pass must
        // not snap to the target or clear the velocity used by the next frame.
        if (
            !this.dirty &&
            this.lastSampleAt !== undefined &&
            Math.abs(at - this.lastSampleAt) < 0.00001
        )
            return this.sampled;
        this.lastSampleAt = at;
        if (this.dirty) {
            this.sampled.length = 0;
            for (const track of this.tracks.values())
                if (!track.player.isLocal && track.points.length)
                    this.sampled.push(track.sampled);
            this.dirty = false;
        }
        this.effectiveDelay = this.interpolationDelay;
        this.extrapolated = this.frozen = 0;
        this.presentationError = 0;
        for (const track of this.tracks.values()) {
            if (track.player.isLocal || !track.points.length) continue;
            const points = track.points;
            // Sparse crowd actors receive updates at 2–5Hz. A fixed 150ms
            // horizon expires between their packets (especially after one loss).
            // Cover one ordinary update interval, bounded to half a second.
            const extrapolationMs = this.hasVelocity
                ? clamp(track.cadenceMs ?? 50, 150, 500)
                : 150;
            const cadenceDelay =
                track.cadenceMs > 250
                    ? Math.min(650, track.cadenceMs + 50)
                    : track.cadenceMs > 125
                    ? Math.min(220, track.cadenceMs + 20)
                    : this.hasVelocity
                    ? 60
                    : 100;
            const delay = Math.max(this.interpolationDelay, cadenceDelay);
            this.effectiveDelay = Math.max(this.effectiveDelay, delay);
            const desiredTime = at + this.clockOffset - delay;
            const elapsed = at - track.sampledAt;
            let target = Math.max(track.timeline ?? -Infinity, desiredTime);
            if (
                this.hasVelocity &&
                points.length > 1 &&
                track.timeline !== undefined &&
                elapsed > 0 &&
                elapsed < 250
            ) {
                // Buffer/clock changes alter playback speed gradually, never its phase.
                // Ordinary jitter uses a narrow rate range; AOI changes can recover faster.
                const error = desiredTime - (track.timeline + elapsed);
                const wide = Math.abs(error) > 150;
                const wanted = clamp(
                    1 + error / 300,
                    wide ? 0.5 : 0.9,
                    wide ? 1.5 : 1.1
                );
                const previousRate = track.playbackRate ?? 1;
                track.playbackRate =
                    previousRate +
                    clamp(wanted - previousRate, -elapsed / 500, elapsed / 500);
                target = track.timeline + elapsed * track.playbackRate;
            }
            track.timeline =
                points.length === 1 ? Math.min(target, points[0].time) : target;
            let a = points[0],
                b = a;
            for (let i = 1; i < points.length; i++) {
                b = points[i];
                if (b.time >= target) break;
                a = b;
            }
            let x: number, y: number, z: number, rotation: number;
            if (target <= a.time || points.length === 1) {
                ({ x, y, z, rotation } = a);
            } else if (target <= b.time && b.time > a.time) {
                const t = clamp((target - a.time) / (b.time - a.time), 0, 1);
                x = a.x + (b.x - a.x) * t;
                y = a.y + (b.y - a.y) * t;
                z = a.z + (b.z - a.z) * t;
                if (
                    [a.vx, a.vy, a.vz, b.vx, b.vy, b.vz].every(Number.isFinite)
                ) {
                    const seconds = (b.time - a.time) / 1000;
                    const curve = (
                        start: number,
                        end: number,
                        v0: number,
                        v1: number
                    ) => {
                        const d = end - start;
                        // Monotone tangents prevent overshoot on abrupt direction changes.
                        const tangent = (v: number) =>
                            Math.sign(v) === Math.sign(d)
                                ? Math.sign(d) *
                                  Math.min(
                                      Math.abs(v * seconds),
                                      3 * Math.abs(d)
                                  )
                                : 0;
                        return (
                            (2 * t * t * t - 3 * t * t + 1) * start +
                            (t * t * t - 2 * t * t + t) * tangent(v0) +
                            (-2 * t * t * t + 3 * t * t) * end +
                            (t * t * t - t * t) * tangent(v1)
                        );
                    };
                    x = curve(a.x, b.x, a.vx, b.vx);
                    z = curve(a.z, b.z, a.vz, b.vz);
                    // Authored vertical velocities reproduce jump arcs, bounded by the void controller.
                    y = clamp(
                        (2 * t * t * t - 3 * t * t + 1) * a.y +
                            (t * t * t - 2 * t * t + t) * a.vy * seconds +
                            (-2 * t * t * t + 3 * t * t) * b.y +
                            (t * t * t - t * t) * b.vy * seconds,
                        0,
                        3
                    );
                }
                rotation = a.rotation + angle(b.rotation - a.rotation) * t;
            } else {
                b = points[points.length - 1];
                a = points[Math.max(0, points.length - 2)];
                const seconds = clamp(
                    (target - b.time) / 1000,
                    0,
                    extrapolationMs / 1000
                );
                const duration = Math.max(0.001, (b.time - a.time) / 1000);
                const vx = Number.isFinite(b.vx)
                        ? b.vx
                        : (b.x - a.x) / duration,
                    vz = Number.isFinite(b.vz) ? b.vz : (b.z - a.z) / duration;
                const speedScale = Math.min(1, 8 / (Math.hypot(vx, vz) || 1));
                x = b.x + vx * speedScale * seconds;
                z = b.z + vz * speedScale * seconds;
                const verticalVelocity = clamp(
                    Number.isFinite(b.vy) ? b.vy : (b.y - a.y) / duration,
                    -12,
                    12
                );
                // The collision-free lobby controller uses 18m/s² gravity.
                // Longer crowd prediction must follow a falling arc, not float
                // at the last upward velocity until the next packet arrives.
                y = clamp(
                    b.y +
                        verticalVelocity * seconds -
                        (Number.isFinite(b.vy) ? 9 * seconds * seconds : 0),
                    0,
                    3
                );
                rotation =
                    b.rotation +
                    clamp(angle(b.rotation - a.rotation) / duration, -8, 8) *
                        seconds;
                if (target - b.time > extrapolationMs) this.frozen++;
                else if (seconds > 0) this.extrapolated++;
            }
            const targetX = x,
                targetZ = z;
            const renderDt = (at - track.sampledAt) / 1000;
            if (renderDt > 0 && renderDt < 0.25) {
                if (
                    this.hasVelocity &&
                    this.options.smoothPresentation !== false
                ) {
                    const dx = targetX - track.sampled.x,
                        dz = targetZ - track.sampled.z;
                    const distance = Math.hypot(dx, dz);
                    const stopped = (point: Point) =>
                        Number.isFinite(point.vx) &&
                        Number.isFinite(point.vz) &&
                        Math.hypot(point.vx, point.vz) < 0.01;
                    if (stopped(b)) {
                        // A sparse pair may cover 500ms although the actor stopped
                        // just after its first sample. Blending its old velocity
                        // across the whole pair carries the avatar past the known
                        // endpoint, then pulls it back. Brake toward that endpoint
                        // as soon as this pair is presented, including before b.time.
                        const stopDx = b.x - track.sampled.x,
                            stopDz = b.z - track.sampled.z;
                        const remaining = Math.hypot(stopDx, stopDz);
                        const approachSpeed = Math.min(
                            8,
                            Math.max(
                                Math.hypot(a.vx || 0, a.vz || 0),
                                Math.hypot(
                                    track.renderVx || 0,
                                    track.renderVz || 0
                                )
                            ) || 8
                        );
                        const blend = Math.min(
                            1 - Math.exp(-18 * renderDt),
                            (approachSpeed * renderDt) / (remaining || 1)
                        );
                        x = track.sampled.x + stopDx * blend;
                        z = track.sampled.z + stopDz * blend;
                        if (Math.hypot(b.x - x, b.z - z) < 0.002) {
                            x = b.x;
                            z = b.z;
                        }
                    } else {
                        const span = b.time - a.time;
                        const fraction =
                            span > 0
                                ? clamp((target - a.time) / span, 0, 1)
                                : 1;
                        const knownVelocity = [a.vx, a.vz, b.vx, b.vz].every(
                            Number.isFinite
                        );
                        const alive = target - b.time <= extrapolationMs;
                        const rate = track.playbackRate ?? 1;
                        const vx =
                            alive && knownVelocity
                                ? (a.vx + (b.vx - a.vx) * fraction) * rate
                                : 0;
                        const vz =
                            alive && knownVelocity
                                ? (a.vz + (b.vz - a.vz) * fraction) * rate
                                : 0;
                        // Authority input batches may advance six steps, then zero,
                        // while the physical velocity stays constant. Follow that
                        // velocity and remove position error over time instead of
                        // accelerating/decelerating to chase each packet's position.
                        const fallbackSpeed = Math.min(
                            8,
                            distance * 30,
                            Math.sqrt(80 * distance)
                        );
                        const desiredVx = knownVelocity
                            ? vx + (dx - vx * renderDt) * 2
                            : (dx * fallbackSpeed) / (distance || 1);
                        const desiredVz = knownVelocity
                            ? vz + (dz - vz * renderDt) * 2
                            : (dz * fallbackSpeed) / (distance || 1);
                        const lastVx = track.renderVx ?? 0,
                            lastVz = track.renderVz ?? 0;
                        const changeX = desiredVx - lastVx,
                            changeZ = desiredVz - lastVz;
                        const amount = Math.min(
                            1,
                            (40 * renderDt) /
                                (Math.hypot(changeX, changeZ) || 1)
                        );
                        x =
                            track.sampled.x +
                            (lastVx + changeX * amount) * renderDt;
                        z =
                            track.sampled.z +
                            (lastVz + changeZ * amount) * renderDt;
                    }
                }
                // Limit the final rendered step, not the filter's input: limiting
                // its input also accidentally limits sustained running speed.
                const dx = x - track.sampled.x,
                    dz = z - track.sampled.z;
                const amount = Math.min(
                    1,
                    (8 * renderDt) / (Math.hypot(dx, dz) || 1)
                );
                x = track.sampled.x + dx * amount;
                z = track.sampled.z + dz * amount;
            }
            if (
                this.hasVelocity &&
                this.options.smoothPresentation !== false &&
                renderDt > 0 &&
                renderDt < 0.25
            ) {
                // A late jump packet can replace extrapolation with a different
                // arc. Reconcile its height over ~33ms instead of teleporting;
                // keep correction speed within the controller's vertical limit.
                const heightError = y - track.sampled.y;
                const heightStep = heightError * (1 - Math.exp(-30 * renderDt));
                const targetY = y;
                y =
                    track.sampled.y +
                    clamp(heightStep, -12 * renderDt, 12 * renderDt);
                if (targetY === 0 && y < 0.001) y = 0;
                // Packet catch-up also changes heading in bursts. Smooth the actual
                // displayed orientation so its derivative cannot request a fake cut.
                rotation =
                    track.sampled.rotation +
                    angle(rotation - track.sampled.rotation) *
                        (1 - Math.exp(-14 * renderDt));
            }
            this.presentationError = Math.max(
                this.presentationError,
                Math.hypot(x - targetX, z - targetZ)
            );
            const presentedSpeed =
                renderDt > 0 && renderDt < 0.25
                    ? Math.hypot(x - track.sampled.x, z - track.sampled.z) /
                      renderDt
                    : undefined;
            track.renderVx =
                renderDt > 0 && renderDt < 0.25
                    ? (x - track.sampled.x) / renderDt
                    : 0;
            track.renderVz =
                renderDt > 0 && renderDt < 0.25
                    ? (z - track.sampled.z) / renderDt
                    : 0;
            track.sampledAt = at;
            const state = target >= b.time ? b : a;
            const latest = points[points.length - 1];
            const span = b.time - a.time;
            const speed =
                target - b.time > extrapolationMs || span <= 0
                    ? 0
                    : Math.min(
                          8,
                          [a.vx, a.vz, b.vx, b.vz].every(Number.isFinite)
                              ? Math.hypot(
                                    a.vx +
                                        (b.vx - a.vx) *
                                            clamp(
                                                (target - a.time) / span,
                                                0,
                                                1
                                            ),
                                    a.vz +
                                        (b.vz - a.vz) *
                                            clamp(
                                                (target - a.time) / span,
                                                0,
                                                1
                                            )
                                )
                              : (Math.hypot(b.x - a.x, b.z - a.z) * 1000) / span
                      );
            Object.assign(track.sampled, {
                x,
                y,
                z,
                rotation,
                speed:
                    this.hasVelocity && Number.isFinite(presentedSpeed)
                        ? Math.min(8, presentedSpeed)
                        : speed,
                animation: state.animation ?? -1,
                restConfirmed: this.hasVelocity
                    ? Math.hypot(latest.vx, latest.vz) < 0.01 &&
                      Math.abs(latest.vy) < 0.01 &&
                      latest.y <= 0.001 &&
                      latest.floor !== false
                    : state.moving === false
                    ? true
                    : undefined,
                // Animation must agree with the interpolated/extrapolated body,
                // rather than hold the previous packet's grounded flag mid-jump.
                floor: Number.isFinite(b.vy)
                    ? y <= 0.001
                    : state.floor !== false,
            });
            // Snapshots carry no jump count; the store infers it from vy so
            // a remote double jump plays its own clip instead of a plain arc.
            track.sampled.jumpCount =
                state.jumpCount === undefined
                    ? undefined
                    : track.sampled.floor
                    ? 0
                    : Math.max(1, state.jumpCount);
        }
        return this.sampled;
    };
    private get interpolationDelay() {
        return clamp(
            (this.hasVelocity ? 60 : 100) + this.jitter * 2,
            this.hasVelocity ? 60 : 100,
            220
        );
    }
    diagnostics(): LobbyMotionDiagnostics {
        return {
            rttMs: this.rtt,
            jitterMs: this.jitter,
            interpolationMs: Math.max(
                this.interpolationDelay,
                this.effectiveDelay
            ),
            acceptedSnapshots: this.accepted,
            rejectedSnapshots: this.rejected,
            extrapolatedPlayers: this.extrapolated,
            frozenPlayers: this.frozen,
            bufferedPlayers: this.sampled.length,
            presentationErrorMeters: this.presentationError,
        };
    }
}
