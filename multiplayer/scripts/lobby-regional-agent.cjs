#!/usr/bin/env node
const { spawn } = require("node:child_process");
const { readFileSync } = require("node:fs");
// Hard timeout makes interrupted controller sessions stop billing compute.
setTimeout(() => process.exit(124), 360000).unref();
const delay = Math.max(0, Number(process.env.LOBBY_PROBE_START_AT || 0) - Date.now());
setTimeout(() => {
    const child = spawn(process.execPath, ["/app/scripts/lobby-fly-smoke.cjs", "--clients=32", "--duration=60", "--output=/tmp/probe.json"], { stdio: ["ignore", "ignore", "inherit"] });
    child.on("exit", (code) => {
        let result;
        try {
            result = JSON.parse(readFileSync("/tmp/probe.json", "utf8"));
        } catch {
            result = { passed: false, error: `Probe failed before writing results (exit ${code})` };
        }
        console.log("LOBBY_PROBE_RESULT " + JSON.stringify({ region: process.env.FLY_REGION, ...result }));
        // Give the controller time to collect logs; --rm removes this machine on exit.
        setTimeout(() => process.exit(code || 0), 30000);
    });
    child.on("error", (error) => {
        console.error(error.message);
        process.exit(1);
    });
}, delay);
