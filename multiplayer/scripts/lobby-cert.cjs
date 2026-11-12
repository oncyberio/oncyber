#!/usr/bin/env node
// A dedicated short-lived P-256 certificate for browser WebTransport development.
// No trust store is modified. Pin only the returned SHA-256 leaf certificate hash.
const { mkdirSync, readFileSync, writeFileSync, chmodSync, existsSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { tmpdir } = require("node:os");
const { X509Certificate, createHash, createPrivateKey } = require("node:crypto");
const { execFileSync } = require("node:child_process");

function ensureLobbyCertificate(directory = join(tmpdir(), "oncyber-lobby-webtransport")) {
    directory = resolve(directory);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const certPath = join(directory, "cert.pem");
    const keyPath = join(directory, "key.pem");
    let reusable = false;
    if (existsSync(certPath) && existsSync(keyPath)) {
        try {
            const cert = new X509Certificate(readFileSync(certPath));
            reusable = Date.parse(cert.validTo) > Date.now() + 86400000 && Date.parse(cert.validFrom) <= Date.now() && Date.parse(cert.validTo) - Date.parse(cert.validFrom) <= 14 * 86400000 && cert.publicKey.asymmetricKeyType === "ec" && cert.publicKey.asymmetricKeyDetails?.namedCurve === "prime256v1" && cert.publicKey.export({ format: "der", type: "spki" }).length < 128 && cert.checkPrivateKey(createPrivateKey(readFileSync(keyPath)));
        } catch {}
    }
    if (!reusable) {
        const configPath = join(directory, "openssl.cnf");
        writeFileSync(configPath, "[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=localhost\n[ext]\nsubjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=serverAuth\n", { mode: 0o600 });
        execFileSync("openssl", ["req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-pkeyopt", "ec_param_enc:named_curve", "-nodes", "-keyout", keyPath, "-out", certPath, "-days", "13", "-sha256", "-config", configPath], { stdio: ["ignore", "ignore", "pipe"] });
    }
    chmodSync(keyPath, 0o600);
    const cert = new X509Certificate(readFileSync(certPath));
    const hash = createHash("sha256").update(cert.raw).digest();
    const result = { certPath, keyPath, expiresAt: new Date(cert.validTo).toISOString(), serverCertificateHashes: [{ algorithm: "sha-256", value: Array.from(hash) }] };
    writeFileSync(join(directory, "fingerprint.json"), JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
    return result;
}
module.exports = { ensureLobbyCertificate };
if (require.main === module) process.stdout.write(JSON.stringify(ensureLobbyCertificate(process.argv[2]), null, 2) + "\n");
