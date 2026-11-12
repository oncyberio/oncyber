import type {
    LobbyClipMetadata,
    LobbyLocomotionPose,
    LobbyMotionInput,
} from "./locomotion";
const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const finite = (n: number) => (Number.isFinite(n) ? n : 0);
const wrap = (n: number) => ((n % 1) + 1) % 1;
const phaseDistance = (a: number, b: number) =>
    Math.abs(((a - b + 1.5) % 1) - 0.5);
const ground = (n: string) =>
    n === "IDLE" || n === "WALK" || n === "RUN" || n === "SPRINT";
const SUPPORT_FEET = ["L", "R"] as const;
const smooth = (n: number) => n * n * (3 - 2 * n);

/** Small trajectory/stance chooser, inspired by Epic's filtered pose selection.
 * No database scan per crowd frame, no third sampled pose, no simulation changes.
 * A readiness gate lets instances keep walking while a shared turn bake loads.
 */
export function createMovingTurns(
    clips: Record<string, LobbyClipMetadata>,
    ready = (_name: string) => true
) {
    let previousSpeed = 0,
        rate = 0,
        side = 0,
        gait = "WALK";
    let mode: "free" | "collapse" | "blend" | "steady" | "release" = "free";
    let release = 0,
        a = "WALK",
        b = "WALK",
        weight = 0,
        collapseTo = 0;
    let cut = "",
        cutTime = 0,
        cutAge = 0,
        cutFrom = "RUN",
        cooldown = 0,
        cancel = 0;
    let armed = true,
        pending = 0,
        pendingAge = 0,
        pendingSide = 1,
        pendingAngle = 90;
    let interrupted = "",
        interruptedTime = 0,
        interruptedTarget = "";
    const reset = () => {
        interrupted = interruptedTarget = "";
        mode = "free";
        cut = "";
        pending = 0;
        side = 0;
        rate = 0;
        cancel = 0;
    };
    const write = (
        pose: LobbyLocomotionPose,
        first: string,
        second: string,
        blend: number,
        phase: number
    ) => {
        pose.primary.name = first;
        pose.secondary.name = second;
        pose.primary.time = phase * (clips[first]?.duration || 1);
        pose.secondary.time = phase * (clips[second]?.duration || 1);
        pose.blend = blend;
        pose.turnWeight =
            (clips[first]?.turn ? 1 - blend : 0) +
            (clips[second]?.turn ? blend : 0);
    };
    return {
        reset,
        update(
            dt: number,
            input: LobbyMotionInput,
            pose: LobbyLocomotionPose,
            phase: number
        ): number | undefined {
            pose.turnWeight = 0;
            const speed = Math.max(0, finite(input.speed));
            const approachSpeed = Math.max(previousSpeed, speed);
            previousSpeed = speed;
            const enabled =
                input.procedural !== false && input.quality !== "crowd";
            // Coarse avatars keep the original cheap gait controller.
            if (!enabled && mode === "free" && !cut) {
                pending = 0;
                rate = side = 0;
                return;
            }
            if (
                !input.grounded ||
                !ground(pose.primary.name) ||
                !ground(pose.secondary.name)
            ) {
                // Starts/stops and airborne states own selection, but their
                // incoming fade must leave the visible turn pose, not a fresh
                // straight gait. Retain only that outgoing sample for the fade.
                if (!interrupted) {
                    const outgoing =
                        cut || (mode !== "free" ? (weight >= 0.5 ? b : a) : "");
                    const outgoingTime = cut
                        ? cutTime
                        : phase * (clips[outgoing]?.duration || 1);
                    reset();
                    if (
                        clips[outgoing]?.turn &&
                        ground(pose.primary.name) &&
                        !ground(pose.secondary.name)
                    ) {
                        interrupted = outgoing;
                        interruptedTime = outgoingTime;
                        interruptedTarget = pose.secondary.name;
                    }
                }
                if (
                    interrupted &&
                    ground(pose.primary.name) &&
                    pose.secondary.name === interruptedTarget &&
                    pose.blend < 1
                ) {
                    pose.primary.name = interrupted;
                    pose.primary.time = interruptedTime;
                    pose.turnWeight =
                        (1 - pose.blend) *
                        (clips[interrupted].turn.kind === "cut"
                            ? Math.sin(
                                  (Math.PI * interruptedTime) /
                                      clips[interrupted].duration
                              ) ** 2
                            : 1);
                } else reset();
                return;
            }
            interrupted = interruptedTarget = "";
            cooldown = Math.max(0, cooldown - dt);
            rate +=
                (clamp(finite(input.turnRate), -6, 6) - rate) *
                (1 - Math.exp(-14 * dt));
            const intent = clamp(
                Number.isFinite(input.turnIntent)
                    ? input.turnIntent
                    : finite(input.headingError) + rate * 0.22,
                -Math.PI,
                Math.PI
            );
            if (Math.abs(intent) < 0.6) armed = true;
            const base =
                pose.blend < 0.5 ? pose.primary.name : pose.secondary.name;
            if (!enabled || speed < 0.2) {
                pending = 0;
                side = 0;
            } else if (Math.abs(rate) > 0.4) side = Math.sign(rate);
            else if (Math.abs(rate) < 0.2) side = 0;
            // Discrete gait choice uses hysteresis only while owning the turn.
            // Ordinary straight movement keeps its continuous gait blend.
            const run = clips.SPRINT ? 3.2 : 4.5;
            if (
                clips.SPRINT &&
                speed > (run + 5.4) / 2 + (gait === "SPRINT" ? -0.25 : 0.2)
            )
                gait = "SPRINT";
            else if (speed > (1.6 + run) / 2 + (gait !== "WALK" ? -0.2 : 0.2))
                gait = "RUN";
            else gait = "WALK";
            if (
                enabled &&
                approachSpeed > 2.1 &&
                armed &&
                cooldown === 0 &&
                Math.abs(intent) > 1.05 &&
                !cut
            ) {
                pending = 0.4;
                pendingAge = 0;
                pendingSide = Math.sign(intent);
                pendingAngle = Math.abs(intent) > 2.35 ? 180 : 90;
                armed = false;
            }
            if (pending > 0 && !cut) {
                pending = Math.max(0, pending - dt);
                pendingAge += dt;
                // Let a rapidly changing heading finish declaring a reversal;
                // otherwise a high-refresh frame can mistake its first 90° for a cut.
                if (Math.abs(intent) > 2.35) pendingAngle = 180;
                if (
                    pendingAngle === 180 &&
                    Math.abs(intent) > 1.05 &&
                    Math.abs(intent) < 2.8
                )
                    pendingSide = Math.sign(intent);
                let best = "",
                    error = 0.085;
                for (const foot of SUPPORT_FEET) {
                    const name = `CUT_${
                            pendingSide > 0 ? "L" : "R"
                        }${pendingAngle}_${foot}`,
                        turn = clips[name]?.turn;
                    if (!turn || !ready(name) || pendingAge < 0.035) continue;
                    const difference = phaseDistance(phase, turn.entryPhase);
                    if (difference < error) {
                        error = difference;
                        best = name;
                    }
                }
                if (best) {
                    cut = best;
                    cutTime = cutAge = cancel = 0;
                    cutFrom = mode === "free" ? base : weight >= 0.5 ? b : a;
                    mode = "free";
                    pending = 0;
                }
            }
            if (cut) {
                const clip = clips[cut],
                    turn = clip.turn;
                cutAge += dt;
                cutTime = Math.min(
                    clip.duration,
                    cutTime + dt * clamp(speed / 3.2, 0.5, 1.6)
                );
                if (
                    !enabled ||
                    speed < 0.6 ||
                    (Math.abs(intent) > 0.9 &&
                        Math.sign(intent) !== turn.direction)
                )
                    cancel += dt;
                const progress = cutTime / clip.duration;
                const matched = wrap(
                    turn.entryPhase + turn.phaseSpan * progress
                );
                if (progress >= 1 || cancel >= 0.1) {
                    cut = "";
                    cooldown = 0.45;
                    write(pose, base, base, 0, matched);
                    return matched;
                }
                const incoming = smooth(clamp(cutAge / 0.1));
                const outgoing =
                    smooth(clamp((clip.duration - cutTime) / 0.12)) *
                    (1 - smooth(clamp(cancel / 0.1)));
                if (outgoing < 1) {
                    write(pose, cut, base, 1 - outgoing, matched);
                    pose.primary.time = cutTime;
                    pose.turnWeight =
                        outgoing * Math.sin(Math.PI * progress) ** 2;
                } else {
                    write(pose, cutFrom, cut, incoming, matched);
                    pose.secondary.time = cutTime;
                    pose.turnWeight =
                        incoming * Math.sin(Math.PI * progress) ** 2;
                }
                // The foot phase clock follows the authored cut, then continues
                // from its exact exit phase; never restart the next gait at zero.
                return matched;
            }
            let target =
                side && enabled && speed > 0.2
                    ? `TURN_${gait}_${side > 0 ? "L" : "R"}`
                    : "";
            if (target && (!clips[target] || !ready(target))) target = "";
            if (mode === "free") {
                if (!target) return;
                // Remove the lesser ground sample smoothly before introducing a
                // turn. This preserves the two-pose budget without a 50/50 pop.
                a = pose.primary.name;
                b = pose.secondary.name;
                weight = pose.blend;
                collapseTo = weight < 0.5 ? 0 : 1;
                mode = "collapse";
            }
            if (mode === "collapse") {
                weight += clamp(collapseTo - weight, -dt / 0.1, dt / 0.1);
                write(pose, a, b, weight, phase);
                if (weight === collapseTo) {
                    a = collapseTo ? b : a;
                    b = a;
                    weight = 0;
                    mode = "steady";
                }
                return;
            }
            if (mode === "steady") {
                const destination = target || base;
                if (a === destination) {
                    if (!target) {
                        mode = "release";
                        release = 0;
                    } else {
                        write(pose, a, a, 0, phase);
                        return;
                    }
                }
                if (mode !== "release") {
                    b = destination;
                    weight = 0;
                    mode = "blend";
                }
            }
            if (mode === "release") {
                if (pose.primary.name !== a && pose.secondary.name !== a) {
                    b = base;
                    weight = 0;
                    mode = "blend";
                } else {
                    release = Math.min(1, release + dt / 0.1);
                    const start = pose.primary.name === a ? 0 : 1;
                    pose.blend = start + (pose.blend - start) * smooth(release);
                    if (release === 1) mode = "free";
                    return;
                }
            }
            if (mode === "blend") {
                weight = Math.min(1, weight + dt / 0.16);
                write(pose, a, b, smooth(weight), phase);
                if (weight === 1) {
                    a = b;
                    weight = 0;
                    mode = "steady";
                }
            }
        },
    };
}
