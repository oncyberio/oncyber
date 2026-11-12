import { completeFeelReport } from "../../../public/lobby/feel-metrics-worker";
import { LobbyInputPrediction } from "../LobbyInputPrediction";
import { LobbyPrediction } from "../LobbyPrediction";
import { LobbyMotionStore } from "../LobbyMotionStore";
import { InputAuthority } from "../../../../multiplayer/protocol/input-authority";
import {
    input,
    step,
    encodeInputs,
    decodeInputs,
    STEP,
    MovementInput,
} from "../../../../multiplayer/protocol/movement";
import type { LobbyPlayer } from "../LobbyConnection";

export const FEEL_PROFILES = {
    clean: { label: "Clean · 40 ms RTT", latency: 20, jitter: 0, loss: 0 },
    regional: {
        label: "Regional · 100 ms RTT",
        latency: 50,
        jitter: 20,
        loss: 0.01,
    },
    mobile: {
        label: "Mobile · 180 ms RTT / 5% loss",
        latency: 90,
        jitter: 65,
        loss: 0.05,
    },
    distant: {
        label: "Distant · 300 ms RTT",
        latency: 150,
        jitter: 40,
        loss: 0.02,
    },
    serverstall: {
        label: "100 ms RTT + 200 ms server stalls",
        latency: 50,
        jitter: 10,
        loss: 0,
    },
    outage: {
        label: "Mobile + 900 ms outage every 10 s",
        latency: 90,
        jitter: 45,
        loss: 0.03,
    },
} as const;
export type FeelProfile = keyof typeof FEEL_PROFILES;
type Distribution = { p50: number; p95: number; p99: number; max: number };
export function scriptedInput(seconds: number, actor = 0): MovementInput {
    const phase = seconds % 12;
    return input({
        strafe: phase >= 8 && phase < 10 ? 1 : 0,
        forward: phase >= 6 && phase < 8 ? 0 : -1,
        yaw: seconds * 0.65 + actor * 2.39996,
        running: phase >= 3 && phase < 6,
        jump: (phase > 4 && phase < 4.1) || (phase > 4.35 && phase < 4.45),
        animation: -1,
    });
}
/** Virtual time, real production prediction/authority/interpolation and input codec.
 * Application packets are impaired; this does NOT model QUIC congestion or certify capacity. */
export class FeelSimulation {
    private presentation = new LobbyPrediction();
    readonly predictor = new LobbyInputPrediction();
    readonly motion: LobbyMotionStore;
    readonly smoothing: boolean;
    private presentationErrors: number[] = [];
    readonly authorities: InputAuthority[];
    private histories: any[][];
    private events: { at: number; order: number; run: () => void }[] = [];
    private order = 0;
    private rng: number;
    private frame = 0;
    private accumulator = 0;
    private ackOrderedAt = 0;
    private ackRtts: number[] = [];
    private correctionSizes: number[] = [];
    private remoteSteps: number[] = [];
    private remoteAcceleration: number[] = [];
    private previous = new Map<
        string,
        { x: number; z: number; vx: number; vz: number }
    >();
    private frozenFrames = 0;
    private actorFrames = 0;
    private zeroMotionFrames = 0;
    private packets = 0;
    private lostPackets = 0;
    private queueMax = 0;
    private controls = scriptedInput(0);
    private sampled: readonly LobbyPlayer[] = [];
    private lastAck = 0;
    readonly seed: number;
    readonly count: number;
    readonly profile: FeelProfile;
    constructor(
        options: {
            profile?: FeelProfile;
            count?: number;
            seed?: number;
            smoothing?: boolean;
        } = {}
    ) {
        this.smoothing = options.smoothing !== false;
        this.motion = new LobbyMotionStore({
            smoothPresentation: this.smoothing,
        });
        this.profile = options.profile || "regional";
        this.count = Math.min(
            512,
            Math.max(1, Math.floor(options.count || 64))
        );
        this.seed = this.rng = options.seed ?? 42;
        this.authorities = Array.from({ length: this.count + 1 }, (_, i) => {
            const radius = i ? 3 + Math.sqrt(i) * 1.8 : 0;
            const pose = {
                x: Math.cos(i * 2.39996) * radius,
                z: Math.sin(i * 2.39996) * radius,
            };
            if (i)
                this.motion.upsert({
                    id: String(i),
                    name: `Guest ${i}`,
                    avatar: "",
                    vrmUrl: "",
                    scale: 1,
                    ...pose,
                    y: 0,
                    rotation: 0,
                    animation: -1,
                    floor: true,
                    isLocal: false,
                });
            return new InputAuthority(pose, 1000);
        });
        this.histories = this.authorities.map(() => []);
        this.presentation.pose = { ...this.predictor.state };
        this.motion.observeClock(
            0,
            2 * FEEL_PROFILES[this.profile].latency,
            1000 + FEEL_PROFILES[this.profile].latency
        );
    }
    get timeMs() {
        return (this.frame * 1000) / 60;
    }
    private random() {
        this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0;
        return this.rng / 0x100000000;
    }
    private send(run: () => void, reliable = false) {
        const p = FEEL_PROFILES[this.profile],
            now = this.timeMs;
        const outageEnd =
            this.profile === "outage" &&
            now % 10000 >= 5000 &&
            now % 10000 < 5900
                ? now - (now % 10000) + 5900
                : 0;
        this.packets++;
        const lost = this.random() < p.loss || !!outageEnd;
        if (lost && !reliable) {
            this.lostPackets++;
            return;
        }
        let at = Math.max(
            now + Math.max(0, p.latency + (this.random() * 2 - 1) * p.jitter),
            outageEnd
        );
        // Reliable acknowledgements cannot overtake each other; loss adds a retry delay.
        if (reliable) {
            at = Math.max(at + (lost ? 2 * p.latency : 0), this.ackOrderedAt);
            this.ackOrderedAt = at;
        }
        const event = { at, order: this.order++, run };
        // Binary insertion keeps virtual delivery deterministic without re-sorting every packet.
        let lo = 0,
            hi = this.events.length;
        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            if (this.events[mid].at <= at) lo = mid + 1;
            else hi = mid;
        }
        this.events.splice(lo, 0, event);
        this.queueMax = Math.max(this.queueMax, this.events.length);
    }
    advance(dt: number, controls?: MovementInput) {
        this.controls = controls || scriptedInput(this.timeMs / 1000);
        this.accumulator += Math.min(0.1, Math.max(0, dt));
        while (this.accumulator + 1e-9 >= STEP) {
            this.accumulator -= STEP;
            this.tick(!!controls);
        }
        const movementInput = input(
            controls ||
                scriptedInput((this.timeMs + this.accumulator * 1000) / 1000)
        );
        return {
            ...step(
                { ...this.predictor.state },
                movementInput,
                this.accumulator
            ),
            movementInput,
        };
    }
    private tick(manual: boolean) {
        this.frame++;
        const now = this.timeMs;
        const command = manual ? this.controls : scriptedInput(now / 1000);
        this.predictor.advance(STEP, command);
        this.presentation.pose = { ...this.predictor.state };
        for (let i = 1; i <= this.count; i++) {
            this.histories[i].push({
                ...scriptedInput(now / 1000, i),
                sequence: this.frame,
            });
            if (this.histories[i].length > 12) this.histories[i].shift();
        }
        if (this.frame % 3 === 0) {
            for (let i = 0; i <= this.count; i++) {
                const batch = decodeInputs(
                    encodeInputs(
                        i ? this.histories[i] : this.predictor.packet()
                    )
                );
                this.send(() => this.authorities[i].receive(batch));
            }
        }
        while (this.events[0]?.at <= now) this.events.shift().run();
        const serverStalled =
            this.profile === "serverstall" &&
            now % 10000 >= 5000 &&
            now % 10000 < 5200;
        if (this.frame % 3 === 0 && !serverStalled) {
            for (let i = 0; i <= this.count; i++) {
                const ack = this.authorities[i].advance(1000 + now);
                if (!i && ack && this.frame % 12 === 0) {
                    this.send(() => {
                        const before = { ...this.predictor.state };
                        if (!this.predictor.acknowledge(ack)) return;
                        this.presentation.reconcileState(
                            this.predictor.state,
                            ack.seq
                        );
                        this.lastAck = this.timeMs;
                        this.ackRtts.push(this.timeMs - (ack.seq * 1000) / 60);
                        this.correctionSizes.push(
                            Math.hypot(
                                before.x - this.predictor.state.x,
                                before.y - this.predictor.state.y,
                                before.z - this.predictor.state.z
                            )
                        );
                    }, true);
                }
            }
            // A bounded observer sees the same near/mid/far replication cadence as the room.
            const poses: Array<[string, number, any]> = [];
            for (let i = 1; i <= Math.min(128, this.count); i++) {
                const tick = this.frame / 3;
                if (i > 48 ? tick % 10 !== 0 : i > 16 && tick % 4 !== 0)
                    continue;
                const a = this.authorities[i],
                    s = a.state;
                poses.push([
                    String(i),
                    this.frame,
                    {
                        ...s,
                        vx: Math.cos(a.yaw) * s.vx + Math.sin(a.yaw) * s.vz,
                        vz: -Math.sin(a.yaw) * s.vx + Math.cos(a.yaw) * s.vz,
                    },
                ]);
            }
            // Independent chunks, including isolated loss and out-of-order arrival.
            for (let start = 0; start < poses.length; start += 24) {
                const chunk = poses.slice(start, start + 24),
                    frame = this.frame;
                this.send(() =>
                    this.motion.pushChunk(frame, 1000 + now, chunk, this.timeMs)
                );
            }
        }
        this.sampled = this.motion.sample(now);
        for (const actor of this.sampled) {
            const last = this.previous.get(actor.id);
            let vx = 0,
                vz = 0;
            if (last && now > 2000) {
                const distance = Math.hypot(actor.x - last.x, actor.z - last.z);
                vx = (actor.x - last.x) / STEP;
                vz = (actor.z - last.z) / STEP;
                this.remoteSteps.push(distance);
                this.remoteAcceleration.push(
                    Math.hypot(vx - last.vx, vz - last.vz) / STEP
                );
                if (distance < 0.00001 && now % 12000 < 5800)
                    this.zeroMotionFrames++;
                this.actorFrames++;
            }
            this.previous.set(actor.id, { x: actor.x, z: actor.z, vx, vz });
        }
        if (now > 2000) {
            this.frozenFrames += this.motion.diagnostics().frozenPlayers;
            this.presentationErrors.push(
                this.motion.diagnostics().presentationErrorMeters
            );
        }
        // Bounded samples during interactive sessions.
        for (const list of [
            this.ackRtts,
            this.correctionSizes,
            this.remoteSteps,
            this.remoteAcceleration,
            this.presentationErrors,
        ])
            if (list.length > 60000) list.splice(0, 30000);
    }
    participants = () =>
        this.motion.sample(this.timeMs + this.accumulator * 1000);
    consumeCorrection = () => this.presentation.consume();
    report() {
        return completeFeelReport(this.reportSnapshot()) as Omit<
            ReturnType<FeelSimulation["reportSnapshot"]>,
            "samples"
        > & {
            presentationErrorMeters: Distribution;
            ackAgeMs: Distribution;
            correctionMeters: Distribution;
            remoteStepMeters: Distribution;
            remoteAcceleration: Distribution;
        };
    }
    /** Copy bounded samples for transfer; percentile work runs off the rendering thread. */
    reportSnapshot() {
        return {
            smoothing: this.smoothing,
            samples: {
                presentationErrorMeters: Float64Array.from(
                    this.presentationErrors
                ),
                ackAgeMs: Float64Array.from(this.ackRtts),
                correctionMeters: Float64Array.from(this.correctionSizes),
                remoteStepMeters: Float64Array.from(this.remoteSteps),
                remoteAcceleration: Float64Array.from(this.remoteAcceleration),
            },
            seed: this.seed,
            profile: this.profile,
            simulatedActors: this.count,
            observedActors: this.sampled.length,
            seconds: this.timeMs / 1000,
            corrections: this.predictor.corrections,
            frozenPercent: +(
                (100 * this.frozenFrames) /
                Math.max(1, this.actorFrames)
            ).toFixed(3),
            stoppedDuringMotionPercent: +(
                (100 * this.zeroMotionFrames) /
                Math.max(1, this.actorFrames)
            ).toFixed(3),
            pendingInputs: this.predictor.pending,
            lastAckAgeMs: this.timeMs - this.lastAck,
            missingInputs: this.authorities.reduce(
                (sum, a) => sum + a.missing,
                0
            ),
            packets: this.packets,
            lostPackets: this.lostPackets,
            queueMax: this.queueMax,
            motion: this.motion.diagnostics(),
            limits: [
                "Virtual time/application-packet impairment, not real QUIC",
                "Real prediction/authority/interpolation; simplified AOI scheduling",
                "No network-capacity claim; rendering measured separately",
            ],
        };
    }
}
