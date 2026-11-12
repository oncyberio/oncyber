import { createWorldServer } from "./world/server";
import { manageCertificate } from "./world/certificate";
const acmeHostname = process.env.LOBBY_WORLD_ACME_HOST;
const acmeChallenges = acmeHostname ? new Map<string, string>() : undefined;
const number = (name: string, fallback: number) => {
    const value = process.env[name];
    if (!value) return fallback;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) throw new Error(`${name} must be a positive integer`);
    return n;
};
createWorldServer({
    port: number("LOBBY_WORLD_PORT", 2575),
    wsBase: number("LOBBY_WORLD_WS_BASE", 2576),
    wtBase: number("LOBBY_WORLD_WT_BASE", 2590),
    workers: process.env.LOBBY_WORLD_WORKERS ? number("LOBBY_WORLD_WORKERS", 8) : undefined,
    capacity: number("LOBBY_WORLD_CAPACITY", 10000),
    detailThreshold: number("LOBBY_WORLD_DETAIL_THRESHOLD", 4096),
    bind: process.env.LOBBY_WORLD_BIND || "127.0.0.1",
    wtBind: process.env.LOBBY_WORLD_WT_BIND,
    singlePort: process.env.LOBBY_WORLD_SINGLE_PORT === "1",
    trustFlyProxy: !!process.env.FLY_APP_NAME && process.env.LOBBY_WORLD_TRUST_FLY_PROXY === "1",
    adminPort: process.env.LOBBY_WORLD_ADMIN_PORT ? number("LOBBY_WORLD_ADMIN_PORT", 2574) : undefined,
    region: process.env.LOBBY_WORLD_REGION || "local",
    webtransport: !acmeHostname && process.env.LOBBY_WORLD_WEBTRANSPORT !== "0",
    acmeChallenges,
    // Fly restarts a failed process; do not leave a partially dead room running.
    onWorkerFailure: () => process.exit(1),
    testMode: process.env.LOBBY_WORLD_TEST_MODE === "1",
    publicHost: process.env.LOBBY_WORLD_PUBLIC_HOST,
    origins: process.env.LOBBY_WORLD_ORIGINS?.split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    certPath: process.env.LOBBY_WORLD_CERT,
    keyPath: process.env.LOBBY_WORLD_KEY,
})
    .then((world) => {
        console.log(`Shared world v2 ready ${JSON.stringify(world.address)}`);
        const certificates = acmeHostname ? manageCertificate({ hostname: acmeHostname, email: process.env.LOBBY_WORLD_ACME_EMAIL || "", directory: process.env.LOBBY_WORLD_TLS_DIR || "/data/tls", challenges: acmeChallenges!, activate: world.replaceWebTransportCertificate, staging: process.env.LOBBY_WORLD_ACME_STAGING === "1" }) : undefined;
        let stopping = false;
        const stop = () => {
            if (stopping) return;
            stopping = true;
            certificates?.close();
            void world.close().then(() => process.exit(0));
        };
        process.on("SIGINT", stop);
        process.on("SIGTERM", stop);
    })
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
