import { X509Certificate, createPrivateKey } from "crypto";
import { mkdir, readFile, writeFile, rename } from "fs/promises";
import { join } from "path";
import * as acme from "acme-client";

export interface CertificatePair { cert: string; key: string; }
export function certificateValid(pair: CertificatePair, hostname: string, remainingMs = 0, now = Date.now()) {
    try {
        const cert = new X509Certificate(pair.cert);
        return !!cert.checkHost(hostname) && cert.checkPrivateKey(createPrivateKey(pair.key)) && Date.parse(cert.validFrom) <= now && Date.parse(cert.validTo) > now + remainingMs;
    } catch { return false; }
}

// One certificate owner per single-machine room. The volume retains account and
// certificate keys across deploys. Challenges are served by the existing HTTP
// listener; a failed issuance leaves the healthy WebSocket path available.
export function manageCertificate(options: { hostname: string; email: string; directory: string; challenges: Map<string, string>; activate: (pair: CertificatePair) => Promise<void>; staging?: boolean }) {
    if (!/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/i.test(options.hostname)) throw new Error("Invalid ACME hostname");
    let stopped = false, running = false, activeCert = "", retryAt = 0;
    const namespace = options.staging ? "staging" : "production";
    const base = join(options.directory, namespace, options.hostname);
    async function atomic(name: string, data: string | Buffer) {
        const file = join(base, name);
        await writeFile(file + ".next", data, { mode: 0o600 });
        await rename(file + ".next", file);
    }
    async function activate(pair: CertificatePair) {
        if (!stopped && activeCert !== pair.cert) {
            await options.activate(pair);
            activeCert = pair.cert;
            console.log("WebTransport certificate active", options.hostname, new X509Certificate(pair.cert).validTo);
        }
    }
    async function check() {
        if (stopped || running || Date.now() < retryAt) return;
        running = true;
        try {
            await mkdir(base, { recursive: true, mode: 0o700 });
            let pair: CertificatePair | undefined;
            try { pair = JSON.parse(await readFile(join(base, "certificate.json"), "utf8")); } catch (error: any) { if (error.code !== "ENOENT") throw error; }
            if (pair && certificateValid(pair, options.hostname)) {
                await activate(pair);
                if (certificateValid(pair, options.hostname, 30 * 86400000)) return;
            }
            let accountKey: Buffer;
            try { accountKey = await readFile(join(base, "account.pem")); }
            catch (error: any) {
                if (error.code !== "ENOENT") throw error;
                accountKey = await acme.crypto.createPrivateEcdsaKey();
                await atomic("account.pem", accountKey);
            }
            const client = new acme.Client({ directoryUrl: options.staging ? acme.directory.letsencrypt.staging : acme.directory.letsencrypt.production, accountKey, backoffAttempts: 10, backoffMin: 1000, backoffMax: 10000 });
            const key = await acme.crypto.createPrivateEcdsaKey();
            const [, csr] = await acme.crypto.createCsr({ commonName: options.hostname }, key);
            const cert = await client.auto({ csr, email: options.email, termsOfServiceAgreed: true, challengePriority: ["http-01"],
                challengeCreateFn: async (_auth, challenge, authorization) => { if (stopped) throw new Error("Certificate manager stopped"); options.challenges.set(challenge.token, authorization); },
                challengeRemoveFn: async (_auth, challenge) => { options.challenges.delete(challenge.token); },
            });
            pair = { cert, key: key.toString() };
            if (!certificateValid(pair, options.hostname, 86400000)) throw new Error("Issued certificate failed validation");
            await atomic("certificate.json", JSON.stringify(pair));
            await activate(pair);
        } catch (error: any) {
            // Retry slowly, without logging keys or challenge authorizations.
            retryAt = Date.now() + 3600000;
            console.error("WebTransport certificate renewal failed:", String(error.message).slice(0, 500));
        } finally { running = false; }
    }
    const timer = setInterval(() => void check(), 3600000);
    timer.unref();
    const ready = check();
    return { ready, close: () => { stopped = true; clearInterval(timer); options.challenges.clear(); } };
}
