#!/usr/bin/env node
// `pnpm dev:play`: the lobby on your machine with a play zone in it, to try
// games made from the chat. Starts the lobby's world server with a play
// zone that anyone may change, and the Next.js dev server pointed at it.
// No Firebase account is needed: you arrive as a guest.
//
//   pnpm dev:play
//   then open http://localhost:13000/?lobby=1 (in two tabs to play together)
//   and type in the chat:  /ai a ball pit with 200 small bouncy balls
//   F hits what is in front of you.
//
// `/ai` needs a language model. Put these in frontend/.env.local or in the
// environment; without them everything else still works and /ai says so:
//   PLAY_AUTHOR_URL    a chat-completions address
//   PLAY_AUTHOR_MODEL  the model to ask there
//   PLAY_AUTHOR_KEY    your key for it (server-only; never NEXT_PUBLIC_)
//
// LOBBY_PLAY_ORIGIN="x,z" moves the zone (default: just ahead of where
// people arrive).

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { connect } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORLD = "127.0.0.1:2575";
const log = (msg) => console.log(`\x1b[36m[dev:play]\x1b[0m ${msg}`);

/** The model settings, from the environment or from frontend/.env.local. */
function modelSettings() {
    const names = ["PLAY_AUTHOR_URL", "PLAY_AUTHOR_MODEL", "PLAY_AUTHOR_KEY"];
    const found = {};
    const file = join(ROOT, "frontend/.env.local");
    if (existsSync(file))
        for (const line of readFileSync(file, "utf8").split("\n")) {
            const match = /^\s*(PLAY_AUTHOR_[A-Z]+)\s*=\s*(.*?)\s*$/.exec(line);
            if (match && names.includes(match[1]))
                found[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
        }
    for (const name of names)
        if (process.env[name]) found[name] = process.env[name];
    return found;
}

function waitForPort(hostPort, timeoutMs = 120_000) {
    const [host, port] = hostPort.split(":");
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
        const attempt = () => {
            const socket = connect(Number(port), host);
            socket.once("connect", () => {
                socket.destroy();
                resolve();
            });
            socket.once("error", () => {
                socket.destroy();
                if (Date.now() > deadline)
                    reject(new Error(`Nothing answered at ${hostPort}.`));
                else setTimeout(attempt, 300);
            });
        };
        attempt();
    });
}

if (!existsSync(join(ROOT, "multiplayer/node_modules"))) {
    console.error(
        "The lobby server is not installed. Run: npm --prefix multiplayer ci"
    );
    process.exit(1);
}

const model = modelSettings();
const hasModel = Object.keys(model).length === 3;
const children = [];
const start = (command, args, env) => {
    const child = spawn(command, args, {
        cwd: ROOT,
        stdio: "inherit",
        env: { ...process.env, ...env },
    });
    children.push(child);
    child.on("exit", (code) => {
        // One part stopping ends the whole thing, so nothing is left half up.
        if (!stopping) stop(code || 0);
    });
    return child;
};
let stopping = false;
function stop(code = 0) {
    stopping = true;
    for (const child of children) child.kill("SIGTERM");
    setTimeout(() => process.exit(code), 500);
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

log("Starting the lobby's world server with a play zone…");
start("npm", ["--prefix", "multiplayer", "run", "lobby:world"], {
    ...model,
    LOBBY_PLAY: "1",
    // Local only: let anyone here change the game, not only admins.
    LOBBY_PLAY_OPEN: "1",
    LOBBY_PLAY_ORIGIN: process.env.LOBBY_PLAY_ORIGIN || "0,-14",
    // Plain sockets are enough on one machine, and need no certificate.
    LOBBY_WORLD_WEBTRANSPORT: "0",
});
await waitForPort(WORLD);

log("Starting the app…");
start("pnpm", ["-C", "frontend", "dev"], {
    NEXT_PUBLIC_LOBBY_REGIONS: JSON.stringify([
        { id: "local", httpUrl: `http://${WORLD}`, protocol: 2 },
    ]),
    NEXT_PUBLIC_LOBBY_REGION: "local",
});
await waitForPort("127.0.0.1:13000");

log("Ready: http://localhost:13000/?lobby=1");
log(
    hasModel
        ? "Type in the chat: /ai a ball pit with 200 small bouncy balls"
        : "No model is set, so /ai will say so. Set PLAY_AUTHOR_URL, PLAY_AUTHOR_MODEL and PLAY_AUTHOR_KEY to use it."
);
