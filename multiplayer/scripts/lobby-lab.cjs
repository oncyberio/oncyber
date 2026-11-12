#!/usr/bin/env node
// An isolated loopback world + real multi-process moving clients. Never targets production.
const { createWorldServer } = require("../build/world/server");
const { spawn } = require("node:child_process");
const { readFileSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const args = Object.fromEntries(process.argv.slice(2).map((s) => s.replace(/^--/, "").split("=")));
const clients = Number(args.clients || 256),
    duration = Number(args.duration || 300);
if (!Number.isInteger(clients) || clients < 2 || clients > 2000 || !Number.isInteger(duration) || duration < 5 || duration > 1800) throw Error("Use 2–2000 clients and 5–1800 seconds");
const output = resolve(args.output || "/tmp/lobby-lab-latest.json");
(async () => {
    const world = await createWorldServer({ port: 2675, wsBase: 2676, bind: "127.0.0.1", workers: 4, capacity: clients + 16, singlePort: true, testMode: true, webtransport: false, region: "lab", origins: ["http://localhost:13000", "http://127.0.0.1:13000"] });
    console.log(`Live crowd: http://localhost:13000/dev/lobby-network?target=local\n${clients} real input-driven clients, ${duration}s. Ctrl-C stops the room and all generators.\nReport: ${output}`);
    const child = spawn(process.execPath, [resolve(__dirname, "../loadtest/world.cjs"), "--endpoint=http://127.0.0.1:2675", `--clients=${clients}`, "--processes=4", "--input=1", `--duration=${duration}`, `--output=${output}`], { stdio: ["ignore", "ignore", "inherit"] });
    let closing = false;
    const stop = async () => {
        if (closing) return;
        closing = true;
        child.kill("SIGTERM");
        await world.close();
    };
    process.once("SIGINT", () => void stop());
    process.once("SIGTERM", () => void stop());
    const code = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", resolve);
    }).finally(stop);
    if (closing && code === null) return;
    const report = JSON.parse(readFileSync(output, "utf8"));
    const workers = report.server?.workers || [];
    const gates = { connected: report.connected === clients && report.stillOpen === clients, noUnexpectedErrors: !report.failures && !report.errorEvents && !report.disconnects, crossWorker: report.crossWorkerVisibility === true, tickComputeP95: workers.length > 0 && workers.every((w) => w.tickMs.p95 < 25), tickIntervalP99: workers.length > 0 && workers.every((w) => w.tickIntervalMs?.p99 < 80) };
    report.gates = gates;
    report.passed = code === 0 && Object.values(gates).every(Boolean);
    writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ passed: report.passed, clients, ackRttMs: report.ackRttMs, snapshotGapMs: report.snapshotGapMs, gates, output }, null, 2));
    if (!report.passed) process.exitCode = 1;
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
