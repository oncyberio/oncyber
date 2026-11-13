/**
 * A remote avatar seen through the legacy CyberRoom: the sender reports its
 * position on a timer, the room relays full-state schema patches on its own
 * 5Hz tick, and the viewer interpolates those patches. Measures what a second
 * browser shows: gait stalls while walking, how long a stop takes to reach
 * idle, overshoot past the resting point, and the jump when walking resumes.
 */
import { LobbyMotionStore } from "./LobbyMotionStore";
import { PatchClock } from "./patchClock";
import type { LobbyPlayer, LobbyPose } from "./LobbyConnection";
import {
    input,
    state,
    step,
    STEP,
} from "../../../multiplayer/protocol/movement";

type Options = {
    sendMs: number;
    improved: boolean;
    seed?: number;
    patchMs?: number;
    jitterMs?: number;
};
const player: LobbyPlayer = {
    id: "peer",
    name: "peer",
    avatar: "",
    isLocal: false,
    vrmUrl: "",
    scale: 1,
    x: 0,
    y: 0,
    z: 0,
    rotation: 0,
    animation: -1,
    floor: true,
};

/** Walk 3s, stand 1.5s, walk 2s while turning, stand 2s. */
const script = (t: number) =>
    input({
        forward: t < 3 || (t >= 4.5 && t < 6.5) ? -1 : 0,
        strafe: 0,
        yaw: t >= 4.5 ? (t - 4.5) * 0.8 : 0,
        running: false,
        jump: false,
        animation: -1,
    });

export function simulateLegacyRemote(options: Options) {
    const patchMs = options.patchMs ?? 200;
    const jitter = options.jitterMs ?? 30;
    let rng = options.seed ?? 7;
    const random = () => {
        rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
        return rng / 0x100000000;
    };
    const store = new LobbyMotionStore();
    store.upsert(player);
    const clock = new PatchClock();
    const sender = state({ x: 0, z: 0 });
    // Network events in virtual milliseconds.
    const events: { at: number; run: () => void }[] = [];
    const schedule = (at: number, run: () => void) => {
        events.push({ at, run });
        events.sort((a, b) => a.at - b.at);
    };
    let roomPose: LobbyPose = { ...sender, animation: -1, floor: true };
    let patchedPose = "";
    let lastServerTime = 0;
    let lastDelivery = 0;
    let tick = 0;
    let quiet: { at: number; stamp: number } | null = null;
    const deliver = (pose: LobbyPose) => {
        const arrival = performance.now();
        if (options.improved) {
            const stamp = clock.stamp(arrival);
            store.pushFrame(++tick, stamp, [["peer", pose]], arrival, true);
            quiet = { at: arrival + clock.intervalMs * 1.25, stamp };
        } else store.pushFrame(++tick, arrival, [["peer", pose]], arrival);
    };
    let virtual = 0;
    const realNow = performance.now;
    (performance as any).now = () => virtual;
    const frames: {
        t: number;
        senderSpeed: number;
        remoteSpeed: number;
        x: number;
        z: number;
        sx: number;
        sz: number;
    }[] = [];
    let lastSend = -Infinity;
    try {
        for (let frame = 0; frame < 8.5 * 60; frame++) {
            virtual = (frame * 1000) / 60;
            const t = virtual / 1000;
            step(sender, script(t), STEP);
            if (virtual - lastSend >= options.sendMs - 0.01) {
                lastSend = virtual;
                const sent = {
                    x: sender.x,
                    y: sender.y,
                    z: sender.z,
                    rotation: sender.rotation,
                    animation: -1,
                    floor: true,
                };
                schedule(virtual + 30 + (random() * 2 - 1) * 15, () => {
                    roomPose = sent;
                });
            }
            // Room patch ticks: a full-state patch whenever anything changed.
            if (
                Math.floor(virtual / patchMs) !==
                Math.floor((virtual - 1000 / 60) / patchMs)
            ) {
                const serverTimeDue = virtual - lastServerTime >= 1000;
                if (serverTimeDue) lastServerTime = virtual;
                const key = JSON.stringify(roomPose);
                if (key !== patchedPose || serverTimeDue) {
                    patchedPose = key;
                    const pose = { ...roomPose };
                    // TCP keeps patches in order.
                    const at = Math.max(
                        lastDelivery,
                        virtual + 35 + random() * jitter * 2
                    );
                    lastDelivery = at;
                    schedule(at, () => deliver(pose));
                }
            }
            while (events.length && events[0].at <= virtual) {
                const event = events.shift();
                const saved = virtual;
                virtual = event.at;
                event.run();
                virtual = saved;
            }
            if (quiet && virtual >= quiet.at) {
                const { stamp } = quiet;
                quiet = null;
                if (clock.lastStamp === stamp)
                    store.pushFrame(
                        ++tick,
                        stamp + clock.intervalMs,
                        [["peer", { ...roomPose }]],
                        virtual,
                        true
                    );
            }
            const [remote] = store.sample(virtual);
            if (!remote) continue;
            frames.push({
                t,
                senderSpeed: Math.hypot(sender.vx, sender.vz),
                remoteSpeed: remote.speed ?? 0,
                x: remote.x,
                z: remote.z,
                sx: sender.x,
                sz: sender.z,
            });
        }
    } finally {
        (performance as any).now = realNow;
    }
    // Steady walking, seen through the buffer: skip the first second.
    const walking = frames.filter(
        (f) => (f.t > 1.2 && f.t < 3) || (f.t > 5.2 && f.t < 6.5)
    );
    const stalls = walking.filter((f) => f.remoteSpeed < 0.3).length;
    const speeds = walking.map((f) => f.remoteSpeed);
    const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const sd = Math.sqrt(
        speeds.reduce((a, b) => a + (b - mean) ** 2, 0) / speeds.length
    );
    // Gait changes between moving and still while the sender walks steadily.
    let flickers = 0;
    for (let i = 1; i < walking.length; i++)
        if (
            walking[i].t - walking[i - 1].t < 0.02 &&
            walking[i].remoteSpeed < 0.04 !== walking[i - 1].remoteSpeed < 0.04
        )
            flickers++;
    const stopLatency = (stopAt: number, until: number) => {
        const senderStill = frames.find(
            (f) => f.t > stopAt && f.senderSpeed === 0
        ).t;
        const after = frames.filter((f) => f.t > senderStill && f.t < until);
        let settled = after.length ? after[after.length - 1].t : until;
        for (let i = after.length - 1; i >= 0; i--) {
            if (after[i].remoteSpeed > 0.04) break;
            settled = after[i].t;
        }
        return Math.round((settled - senderStill) * 1000);
    };
    const overshoot = (stopAt: number, until: number) => {
        const rest = frames.find((f) => f.t > stopAt + 0.5);
        let worst = 0;
        for (const f of frames)
            if (f.t > stopAt && f.t < until)
                worst = Math.max(
                    worst,
                    // Lobby forward is -z here for the first leg.
                    stopAt < 4 ? rest.sz - f.z : 0
                );
        return +worst.toFixed(3);
    };
    // Largest single-frame step right after walking resumes.
    let restartJump = 0;
    for (let i = 1; i < frames.length; i++)
        if (frames[i].t > 4.5 && frames[i].t < 5.4)
            restartJump = Math.max(
                restartJump,
                Math.hypot(
                    frames[i].x - frames[i - 1].x,
                    frames[i].z - frames[i - 1].z
                ) * 60
            );
    const cv = (list: typeof frames) => {
        const v = list.map((f) => f.remoteSpeed);
        const m = v.reduce((a, b) => a + b, 0) / v.length;
        return +(
            Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) / m
        ).toFixed(3);
    };
    return {
        cv1: cv(frames.filter((f) => f.t > 1.2 && f.t < 3)),
        cv2: cv(frames.filter((f) => f.t > 5.2 && f.t < 6.5)),
        stallPercent: +((100 * stalls) / walking.length).toFixed(1),
        gaitFlickers: flickers,
        walkSpeedCv: +(sd / mean).toFixed(3),
        stopToIdleMs: [stopLatency(3, 4.5), stopLatency(6.5, 8.5)],
        overshootMeters: overshoot(3, 4.5),
        restartPeakSpeed: +restartJump.toFixed(2),
    };
}

const summarize = (options: Omit<Options, "seed">) => {
    const runs = Array.from({ length: 12 }, (_, seed) =>
        simulateLegacyRemote({ ...options, seed: seed * 977 + 3 })
    );
    const mean = (f: (r: (typeof runs)[number]) => number) =>
        runs.reduce((a, r) => a + f(r), 0) / runs.length;
    return {
        walkSpeedCv: mean((r) => r.cv1),
        stopToIdleMs: mean((r) => (r.stopToIdleMs[0] + r.stopToIdleMs[1]) / 2),
        worstStopToIdleMs: Math.max(...runs.flatMap((r) => r.stopToIdleMs)),
        overshootMeters: Math.max(...runs.map((r) => r.overshootMeters)),
        restartPeakSpeed: Math.max(...runs.map((r) => r.restartPeakSpeed)),
        gaitFlickers: mean((r) => r.gaitFlickers),
    };
};

test("other players reach idle sooner and walk more evenly than before", () => {
    const before = summarize({ sendMs: 100, improved: false });
    const after = summarize({ sendMs: 33.34, improved: true });
    // eslint-disable-next-line no-console
    console.log({ before, after });
    expect(after.stopToIdleMs).toBeLessThan(before.stopToIdleMs - 80);
    expect(after.worstStopToIdleMs).toBeLessThan(650);
    expect(after.walkSpeedCv).toBeLessThan(before.walkSpeedCv);
    expect(after.overshootMeters).toBeLessThan(0.06);
    // Walking resumes without a jump: never faster than a brisk walk.
    expect(after.restartPeakSpeed).toBeLessThan(4.5);
    expect(after.gaitFlickers).toBe(0);
});
