#!/usr/bin/env node
// `pnpm dev:local`: the whole app on your machine with no Firebase account
// and no keys. Starts the Firebase emulators (auth, Firestore, Realtime
// Database) with sample spaces, the local lobby server when it is installed,
// and the Next.js dev server pointed at all of them.
//
//   pnpm dev:local            keep what you changed last time
//   pnpm dev:local --reset    start again from the fixtures
//   pnpm dev:local --no-lobby skip the lobby server

import { spawn, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { connect } from "node:net";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureJava } from "./java.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const DATA = join(HERE, ".emulator-data");
const args = new Set(process.argv.slice(2));

// Pinned so every contributor runs the same emulators.
const FIREBASE_TOOLS = "firebase-tools@15.34.2";
const PROJECT_ID = "demo-oncyber";
const HOSTS = {
    auth: "127.0.0.1:9099",
    firestore: "127.0.0.1:8085",
    database: "127.0.0.1:9000",
};
const LOBBY = "127.0.0.1:2568";

const log = (msg) => console.log(`\x1b[36m[dev:local]\x1b[0m ${msg}`);

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
                    reject(new Error(`nothing listening on ${hostPort}`));
                else setTimeout(attempt, 500);
            });
        };
        attempt();
    });
}

const children = [];
function run(name, cmd, cmdArgs, options = {}) {
    const child = spawn(cmd, cmdArgs, {
        stdio: "inherit",
        cwd: ROOT,
        // Own process group, so stop() reaches everything it starts (npx ->
        // firebase -> the Java emulators), not just the first process.
        detached: process.platform !== "win32",
        ...options,
    });
    child.on("exit", (code, signal) => {
        if (!stopping) {
            log(`${name} stopped (${signal || code}); shutting down.`);
            stop(code || 1);
        }
    });
    children.push({ name, child });
    return child;
}

let stopping = false;
function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    // SIGINT lets the emulators save their data before they exit.
    for (const { child } of children) {
        if (child.exitCode != null) continue;
        try {
            process.kill(-child.pid, "SIGINT");
        } catch {
            child.kill("SIGINT");
        }
    }
    const exited = children.map(
        ({ child }) =>
            new Promise((resolve) =>
                child.exitCode != null ? resolve() : child.on("exit", resolve)
            )
    );
    Promise.race([
        Promise.all(exited),
        new Promise((resolve) => setTimeout(resolve, 20_000)),
    ]).then(() => process.exit(code));
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

async function main() {
    // The emulators need Java 21+; find one or download a private copy.
    const javaDir = await ensureJava(log).catch((err) => {
        console.error(
            `\nThe Firebase emulators need Java 21 or newer, and ${err.message}.` +
                "\nInstall it and run again:" +
                "\n  macOS:  brew install openjdk@21" +
                "\n  Linux:  sudo apt install openjdk-21-jre-headless" +
                "\n  Other:  https://adoptium.net\n"
        );
        process.exit(1);
    });
    if (javaDir) process.env.PATH = `${javaDir}${delimiter}${process.env.PATH}`;

    if (args.has("--reset") && existsSync(DATA)) {
        rmSync(DATA, { recursive: true, force: true });
        log("cleared saved emulator data");
    }

    const emulatorArgs = [
        "--yes",
        FIREBASE_TOOLS,
        "emulators:start",
        "--project",
        PROJECT_ID,
        "--config",
        join(HERE, "firebase.json"),
        "--only",
        "auth,firestore,database",
        "--export-on-exit",
        DATA,
    ];
    if (existsSync(DATA)) emulatorArgs.push("--import", DATA);

    const listening = await Promise.all(
        Object.values(HOSTS).map((h) =>
            waitForPort(h, 0).then(
                () => true,
                () => false
            )
        )
    );
    if (listening.every(Boolean)) {
        log("Firebase emulators already running; using them");
    } else if (listening.some(Boolean)) {
        const taken = Object.values(HOSTS).filter((_, i) => listening[i]);
        console.error(
            `\nPorts ${taken.join(", ")} are in use, most likely by emulators` +
                " left over from an earlier run. Stop them with:\n" +
                "  lsof -ti tcp:8085,9099,9000,4000,4400,4500,9150 | xargs kill\n"
        );
        process.exit(1);
    } else {
        log("starting the Firebase emulators (the first run downloads them)");
        // cwd here so their debug logs land in local-dev/ (ignored by git).
        run("Firebase emulators", "npx", emulatorArgs, { cwd: HERE });
        await Promise.all(Object.values(HOSTS).map((h) => waitForPort(h)));
    }

    process.env.FIRESTORE_EMULATOR_HOST = HOSTS.firestore;
    process.env.FIREBASE_AUTH_EMULATOR_HOST = HOSTS.auth;
    process.env.FIREBASE_DATABASE_EMULATOR_HOST = HOSTS.database;
    const { seed, isSeeded, DEMO_LOGIN } = await import("./seed.mjs");
    if (await isSeeded()) {
        log("using the data saved from your last run (--reset to start over)");
    } else {
        const n = await seed();
        log(
            `seeded ${n.exhibits} sample spaces, ${n.destinations} templates and ${n.users} demo users`
        );
    }

    const lobbySecret = "local-dev-lobby-identity-secret-not-for-production";
    if (!args.has("--no-lobby")) {
        // The lobby server is its own npm package; install it on first run.
        if (!existsSync(join(ROOT, "multiplayer/node_modules/ts-node"))) {
            log("installing the lobby server (first run only)");
            const install = spawnSync(
                "npm",
                ["--prefix", "multiplayer", "ci"],
                {
                    cwd: ROOT,
                    stdio: "inherit",
                }
            );
            if (install.status !== 0) {
                throw new Error(
                    "npm --prefix multiplayer ci failed; rerun with --no-lobby to skip the lobby"
                );
            }
        }
        log("starting the local lobby server");
        run(
            "Lobby server",
            "npm",
            ["--prefix", "multiplayer", "run", "lobby:dev"],
            {
                env: { ...process.env, LOBBY_IDENTITY_SECRET: lobbySecret },
            }
        );
        await waitForPort(LOBBY);
    }

    // Every value the app reads for Firebase, set here so they win over
    // anything in frontend/.env.local (Next never overrides a set variable).
    const env = {
        ...process.env,
        NEXT_PUBLIC_API: "http://localhost:13000",
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: PROJECT_ID,
        NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${PROJECT_ID}.firebaseapp.com`,
        NEXT_PUBLIC_FIREBASE_APP_ID: "1:000000000000:web:demo",
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: `${PROJECT_ID}.appspot.com`,
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
        NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "",
        NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL: "",
        NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: HOSTS.auth,
        NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST: HOSTS.firestore,
        NEXT_PUBLIC_FIREBASE_DATABASE_EMULATOR_HOST: HOSTS.database,
        FIREBASE_ADMIN_PROJECT_ID: PROJECT_ID,
        FIREBASE_ADMIN_PRIVATE_KEY: "",
        FIREBASE_ADMIN_CLIENT_EMAIL: "",
        FIREBASE_ADMIN_DATABASE_URL: `http://${HOSTS.database}?ns=${PROJECT_ID}-default-rtdb`,
        SECRET_JWT_KEY:
            process.env.SECRET_JWT_KEY ||
            "local-dev-session-signing-key-not-for-production",
        LOBBY_IDENTITY_SECRET: lobbySecret,
        NEXT_PUBLIC_LOBBY_REGIONS: JSON.stringify([
            {
                id: "local",
                httpUrl: `http://${LOBBY}`,
                wsUrl: `ws://${LOBBY}`,
                protocol: 1,
            },
        ]),
        NEXT_PUBLIC_LOBBY_REGION: "local",
    };

    log("starting Next.js on http://localhost:13000");
    log(
        `sign in with Email > ${DEMO_LOGIN.email}; the emulator prints the sign-in link here. Data browser: http://127.0.0.1:4000`
    );
    run("Next.js", "pnpm", ["-C", "frontend", "dev"], { env });
}

main().catch((err) => {
    console.error(err);
    stop(1);
});
