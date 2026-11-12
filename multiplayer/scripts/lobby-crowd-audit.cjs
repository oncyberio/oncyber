#!/usr/bin/env node
// Rank every observed actor; never let a smooth average hide one hitching avatar.
const { resolve, dirname } = require("node:path");
const { readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { createHash } = require("node:crypto");
require("ts-node").register({ project: resolve(__dirname, "../tsconfig.json"), transpileOnly: true });
const { FeelSimulation, FEEL_PROFILES } = require("../../frontend/features/lobby/testing/feelSimulation");
const args = Object.fromEntries(process.argv.slice(2).map((s) => s.replace(/^--/, "").split("=")));
const counts = (args.clients || "64,128").split(",").map(Number);
const rates = (args.hz || "60,120").split(",").map(Number);
const seeds = (args.seeds || "42").split(",").map(Number);
const profiles = args.profiles === "all" ? Object.keys(FEEL_PROFILES) : (args.profiles || "regional").split(",");
const seconds = Number(args.duration || 60);
if (!counts.every((n) => Number.isInteger(n) && n >= 1 && n <= 512) || !rates.every((n) => [30, 60, 120].includes(n)) || !seeds.every(Number.isInteger) || !profiles.every((p) => p in FEEL_PROFILES) || !Number.isInteger(seconds) || seconds < 24 || seconds > 180) throw Error("Use clients=1–512, hz=30/60/120, integer seeds, supported profiles, duration=24–180 seconds");
function distribution(a) {
    a.sort((x, y) => x - y);
    return { min: a[0] || 0, p05: a[Math.floor(a.length * 0.05)] || 0, p50: a[Math.floor(a.length * 0.5)] || 0, p95: a[Math.floor(a.length * 0.95)] || 0, max: a.at(-1) || 0 };
}
const cases = [];
for (const profile of profiles)
    for (const count of counts)
        for (const hz of rates)
            for (const seed of seeds) {
                const sim = new FeelSimulation({ profile, count, seed }),
                    actors = new Map();
                for (let frame = 0; frame < hz * seconds; frame++) {
                    sim.advance(1 / hz);
                    const time = frame / hz,
                        phase = time % 12;
                    for (const actor of sim.participants()) {
                        let t = actors.get(actor.id);
                        if (!t) {
                            t = { last: { ...actor }, vx: 0, vz: 0, speeds: [], turns: [], accelerations: [], pauses: 0, samples: 0, groundMismatch: 0, maxSpeed: 0, maxVerticalSpeed: 0, stopTrail: [], stops: [], worst: { score: 0, time: 0 } };
                            actors.set(actor.id, t);
                            continue;
                        }
                        const vx = (actor.x - t.last.x) * hz,
                            vz = (actor.z - t.last.z) * hz,
                            speed = Math.hypot(vx, vz);
                        const turn = Math.abs(Math.atan2(Math.sin(actor.rotation - t.last.rotation), Math.cos(actor.rotation - t.last.rotation))) * hz;
                        if (time > 3) {
                            t.maxSpeed = Math.max(t.maxSpeed, speed);
                            t.maxVerticalSpeed = Math.max(t.maxVerticalSpeed, Math.abs(actor.y - t.last.y) * hz);
                            if (actor.floor && actor.y > 0.08) t.groundMismatch++;
                            // Measure the entire approach and settling window against
                            // the authoritative endpoint, not just the steady run.
                            if (phase >= 6 && phase < 7.8) t.stopTrail.push({ x: actor.x, z: actor.z });
                            else if (t.stopTrail.length) {
                                const end = sim.authorities[Number(actor.id)].state;
                                const start = t.stopTrail[0];
                                const dx = end.x - start.x,
                                    dz = end.z - start.z;
                                const length = Math.hypot(dx, dz) || 1;
                                let overshoot = 0,
                                    backtrack = 0,
                                    previous;
                                for (const point of t.stopTrail) {
                                    const along = ((point.x - end.x) * dx + (point.z - end.z) * dz) / length;
                                    overshoot = Math.max(overshoot, along);
                                    if (previous !== undefined) backtrack += Math.max(0, previous - along);
                                    previous = along;
                                }
                                t.stops.push({ time, overshoot, backtrack });
                                t.stopTrail.length = 0;
                            }
                            // Every scripted actor is in a settled 3.2m/s run here, even
                            // after the far tier's buffer. Exclude starts, stops and jumps.
                            if (phase > 1.8 && phase < 2.8) {
                                t.speeds.push(speed);
                                t.turns.push(turn);
                                t.accelerations.push(Math.hypot(vx - t.vx, vz - t.vz) * hz);
                                t.samples++;
                                if (speed < 0.3) t.pauses++;
                                const score = Math.abs(speed - 3.2) + Math.max(0, turn - 1.5);
                                if (score > t.worst.score) t.worst = { score, time };
                            }
                        }
                        t.last = { ...actor };
                        t.vx = vx;
                        t.vz = vz;
                    }
                }
                const rows = [...actors].map(([id, t]) => ({ id: Number(id), band: +id <= 16 ? "20Hz" : +id <= 48 ? "5Hz" : "2Hz", samples: t.samples, pauses: t.pauses, groundMismatch: t.groundMismatch, speed: distribution(t.speeds), turn: distribution(t.turns), acceleration: distribution(t.accelerations), maxSpeed: t.maxSpeed, maxVerticalSpeed: t.maxVerticalSpeed, stops: t.stops, stopOvershootMeters: Math.max(0, ...t.stops.map((s) => s.overshoot)), stopBacktrackMeters: Math.max(0, ...t.stops.map((s) => s.backtrack)), worst: t.worst })).sort((a, b) => b.worst.score - a.worst.score);
                const summary = {
                    unexpectedPauseFrames: rows.reduce((n, r) => n + r.pauses, 0),
                    airborneGroundedFrames: rows.reduce((n, r) => n + r.groundMismatch, 0),
                    steadySpeedMin: Math.min(...rows.map((r) => r.speed.min)),
                    steadySpeedMax: Math.max(...rows.map((r) => r.speed.max)),
                    maxSpeed: Math.max(...rows.map((r) => r.maxSpeed)),
                    maxVerticalSpeed: Math.max(...rows.map((r) => r.maxVerticalSpeed)),
                    stopOvershootMeters: Math.max(...rows.map((r) => r.stopOvershootMeters)),
                    stopBacktrackMeters: Math.max(...rows.map((r) => r.stopBacktrackMeters)),
                    stopReviewIds: rows.filter((r) => r.stopOvershootMeters > 0.1).map((r) => r.id),
                    worstStopIds: [...rows]
                        .sort((a, b) => b.stopOvershootMeters - a.stopOvershootMeters)
                        .slice(0, 8)
                        .map((r) => r.id),
                    worstIds: rows.slice(0, 8).map((r) => r.id),
                };
                const gates = { observed: rows.length === Math.min(128, count), boundedMotion: Number.isFinite(summary.maxSpeed) && summary.maxSpeed <= 8.001, boundedVerticalMotion: Number.isFinite(summary.maxVerticalSpeed) && summary.maxVerticalSpeed <= 12.001, groundedMatchesHeight: summary.airborneGroundedFrames === 0, noOrdinaryNetworkPauses: !["clean", "regional"].includes(profile) || summary.unexpectedPauseFrames === 0 };
                cases.push({ profile, count, hz, seed, seconds, summary, gates, passed: Object.values(gates).every(Boolean), actors: rows });
            }
const files = ["frontend/features/lobby/LobbyMotionStore.ts", "frontend/features/lobby/testing/feelSimulation.ts", "multiplayer/protocol/input-authority.js"];
const sources = Object.fromEntries(
    files.map((file) => [
        file,
        createHash("sha256")
            .update(readFileSync(resolve(__dirname, "../..", file)))
            .digest("hex"),
    ])
);
const report = { at: new Date().toISOString(), scope: "Every observed actor, with per-actor metrics. Virtual network; not GPU or server capacity. Zero-pause gate applies to clean/regional only; outages remain explicitly reported.", sources, passed: cases.every((c) => c.passed), needsStopReview: cases.some((c) => c.summary.stopReviewIds.length > 0), cases };
if (args.output) {
    const output = resolve(args.output);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify({ passed: report.passed, needsStopReview: report.needsStopReview, cases: cases.map(({ actors, ...c }) => c) }, null, 2));
if (!report.passed) process.exitCode = 1;
