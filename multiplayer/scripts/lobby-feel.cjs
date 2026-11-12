#!/usr/bin/env node
// Uses only the standalone multiplayer dev dependencies, including in CI.
const { resolve, dirname } = require("node:path");
const { readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { createHash } = require("node:crypto");
require("ts-node").register({ project: resolve(__dirname, "../tsconfig.json"), transpileOnly: true });
const { FeelSimulation, FEEL_PROFILES } = require("../../frontend/features/lobby/testing/feelSimulation");
const args = Object.fromEntries(process.argv.slice(2).map((s) => s.replace(/^--/, "").split("=")));
const count = Number(args.clients || 32),
    seed = Number(args.seed || 42),
    seconds = Number(args.duration || 24);
if (!Number.isInteger(count) || count < 1 || count > 512 || !Number.isInteger(seed) || !Number.isInteger(seconds) || seconds < 12 || seconds > 120) throw Error("Use 1–512 clients, integer seed, and 12–120 seconds");
const reports = [];
for (const profile of Object.keys(FEEL_PROFILES)) {
    const variants = [false, true].map((smoothing) => {
        const simulation = new FeelSimulation({ profile, count, seed, smoothing });
        for (let i = 0; i < seconds * 60; i++) simulation.advance(1 / 60);
        return simulation.report();
    });
    const [before, after] = variants;
    const gates = {
        observed: after.observedActors === Math.min(count, 128),
        boundedMotion: after.remoteStepMeters.max <= 8 / 60 + 0.0001,
        boundedInputHistory: after.pendingInputs < 180,
        noCleanDrift: profile !== "clean" || after.correctionMeters.max < 0.00001,
        noExtraAuthorityCorrections: after.correctionMeters.max === before.correctionMeters.max,
        noAdditionalBufferFreezes: after.frozenPercent === before.frozenPercent,
        lowerExtremeAcceleration: after.remoteAcceleration.p99 <= Math.max(50, before.remoteAcceleration.p99),
        noPermanentOutage: after.lastAckAgeMs < 1000,
    };
    reports.push({ profile, before, after, gates, passed: Object.values(gates).every(Boolean) });
}
const files = ["frontend/features/lobby/LobbyMotionStore.ts", "frontend/features/lobby/LobbyInputPrediction.ts", "frontend/features/lobby/testing/feelSimulation.ts", "multiplayer/protocol/input-authority.js", "multiplayer/protocol/movement.js"];
const sources = Object.fromEntries(
    files.map((path) => [
        path,
        createHash("sha256")
            .update(readFileSync(resolve(__dirname, "../..", path)))
            .digest("hex"),
    ])
);
const report = { at: new Date().toISOString(), seed, count, seconds, sources, passed: reports.every((r) => r.passed), reports };
if (args.output) {
    const output = resolve(args.output);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify({ passed: report.passed, seed, count, seconds, scenarios: reports.map((r) => ({ profile: r.profile, passed: r.passed, gates: r.gates, stoppedPercent: [r.before.stoppedDuringMotionPercent, r.after.stoppedDuringMotionPercent], accelerationP95: [r.before.remoteAcceleration.p95, r.after.remoteAcceleration.p95], presentationOffsetP95: r.after.presentationErrorMeters.p95 })) }, null, 2));
if (!report.passed) process.exitCode = 1;
