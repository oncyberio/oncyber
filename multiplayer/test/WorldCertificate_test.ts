import assert from "assert";
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { generateKeyPairSync, X509Certificate } from "crypto";
import { certificateValid, manageCertificate } from "../src/world/certificate";

describe("World certificate lifecycle", function () {
    this.timeout(20000);
    let directory: string, pair: { cert: string; key: string };
    before(() => {
        directory = mkdtempSync(join(tmpdir(), "world-tls-test-"));
        execFileSync("openssl", ["req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:P-256", "-nodes", "-days", "365", "-subj", "/CN=room.example", "-addext", "subjectAltName=DNS:room.example", "-keyout", join(directory, "key.pem"), "-out", join(directory, "cert.pem")], { stdio: "ignore" });
        pair = { cert: readFileSync(join(directory, "cert.pem"), "utf8"), key: readFileSync(join(directory, "key.pem"), "utf8") };
    });
    after(() => rmSync(directory, { recursive: true, force: true }));
    it("checks domain, private key, validity dates and renewal horizon", () => {
        assert(certificateValid(pair, "room.example", 30 * 86400000));
        assert(!certificateValid(pair, "other.example"));
        assert(!certificateValid(pair, "room.example", 400 * 86400000));
        const certificate = new X509Certificate(pair.cert);
        assert(!certificateValid(pair, "room.example", 0, Date.parse(certificate.validFrom) - 1));
        assert(!certificateValid(pair, "room.example", 0, Date.parse(certificate.validTo) + 1));
        const key = generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
        assert(!certificateValid({ ...pair, key }, "room.example"));
        assert(!certificateValid({ cert: "bad", key: "bad" }, "room.example"));
    });
    it("uses persisted valid certificates without contacting the CA and clears challenges on stop", async () => {
        const cache = join(directory, "production", "room.example");
        mkdirSync(cache, { recursive: true });
        writeFileSync(join(cache, "certificate.json"), JSON.stringify(pair), { mode: 0o600 });
        const challenges = new Map([["example-token", "example-value"]]);
        let activations = 0;
        const manager = manageCertificate({ hostname: "room.example", email: "test@example.com", directory, challenges, activate: async (value) => { assert.deepEqual(value, pair); activations++; } });
        await manager.ready;
        assert.equal(activations, 1);
        manager.close();
        assert.equal(challenges.size, 0);
    });
    it("does not activate an asynchronously read certificate after shutdown", async () => {
        let activations = 0;
        const manager = manageCertificate({ hostname: "room.example", email: "test@example.com", directory, challenges: new Map(), activate: async () => { activations++; } });
        manager.close();
        await manager.ready;
        assert.equal(activations, 0);
    });
});
