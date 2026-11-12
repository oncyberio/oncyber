import assert from "assert";
import { createHmac } from "crypto";
import { ColyseusTestServer } from "@colyseus/testing";
import { Server } from "colyseus";

import { CyberRoom } from "../src/rooms/cyber";
import { createWorldAdmission, parseWorldAccess, readWorldAccessProof, setWorldAccessLookup, worldAccessKey, WorldAccess, WorldAccessLookup } from "../src/identity/worldAccess";

process.env.MAX_PLAYERS = process.env.MAX_PLAYERS || "200";

const b64url = (value: Buffer) => value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Signs exactly as frontend/utils/worldPassword/proof.ts does.
function proofFor(key: Buffer, claims: { x: string; r: string; e: number }) {
    const body = `wa1.${b64url(Buffer.from(JSON.stringify(claims)))}`;
    return `${body}.${b64url(createHmac("sha256", key).update(body).digest())}`;
}

const gated = (rev: string): WorldAccess => ({ exists: true, id: "exhibit-1", password: true, rev });
const later = () => Math.floor(Date.now() / 1000) + 600;

describe("world access proofs", () => {
    const saved = { world: process.env.WORLD_ACCESS_SECRET, jwt: process.env.SECRET_JWT_KEY };
    afterEach(() => {
        for (const [name, value] of [
            ["WORLD_ACCESS_SECRET", saved.world],
            ["SECRET_JWT_KEY", saved.jwt],
        ] as const) {
            if (value === undefined) delete process.env[name];
            else process.env[name] = value;
        }
    });

    it("uses WORLD_ACCESS_SECRET, else a key derived from SECRET_JWT_KEY, else none", () => {
        assert.deepEqual(worldAccessKey({ WORLD_ACCESS_SECRET: "w", SECRET_JWT_KEY: "j" }), Buffer.from("w"));
        const derived = worldAccessKey({ SECRET_JWT_KEY: "j" });
        assert.deepEqual(derived, createHmac("sha256", "j").update("oncyber world access proof v1").digest());
        // The session key itself never signs proofs.
        assert.notDeepEqual(derived, Buffer.from("j"));
        assert.equal(worldAccessKey({}), null);
    });

    it("verifies what the web API signs (vector shared with frontend/utils/worldPassword/proof.test.ts)", () => {
        const proof = "wa1.eyJ4IjoiZXhoaWJpdC0xIiwiciI6InJldi0xIiwiZSI6NDEwMjQ0NDgwMH0.Du-2CWzGyBo2HbDnclFNkTjob1HSllgeeQxMZJ2Tdxc";
        const derived = "wa1.eyJ4IjoiZXhoaWJpdC0xIiwiciI6InJldi0xIiwiZSI6NDEwMjQ0NDgwMH0.8FA4AEb6JnNhB_xPQWX_2q7OTFS2XRvCZElMMbNjpCA";
        assert.deepEqual(readWorldAccessProof(proof, worldAccessKey({ WORLD_ACCESS_SECRET: "vector-secret" })), { exhibitId: "exhibit-1", rev: "rev-1", expiresAt: 4102444800 * 1000 });
        assert.equal(readWorldAccessProof(derived, worldAccessKey({ SECRET_JWT_KEY: "vector-jwt-key" }))?.rev, "rev-1");
        assert.equal(readWorldAccessProof(derived, worldAccessKey({ WORLD_ACCESS_SECRET: "vector-secret" })), null);
    });

    it("reads genuine unexpired proofs only", () => {
        const key = Buffer.from("k".repeat(32));
        const proof = proofFor(key, { x: "exhibit-1", r: "rev-1", e: later() });
        assert.deepEqual(readWorldAccessProof(proof, key)?.rev, "rev-1");
        assert.equal(readWorldAccessProof(proof, Buffer.from("other")), null);
        assert.equal(readWorldAccessProof(proofFor(key, { x: "exhibit-1", r: "rev-1", e: 1 }), key), null);
        assert.equal(readWorldAccessProof(proof.replace("wa1.", "wa2."), key), null);
        assert.equal(readWorldAccessProof(proof, null), null);
        assert.equal(readWorldAccessProof(undefined, key), null);
    });

    it("parses only well-formed API answers", () => {
        assert.deepEqual(parseWorldAccess({ exists: false }), { exists: false });
        assert.deepEqual(parseWorldAccess({ exists: true, id: "a", password: true, rev: "r" }), { exists: true, id: "a", password: true, rev: "r" });
        assert.equal(parseWorldAccess({ exists: true, password: true }), null);
        assert.equal(parseWorldAccess("<html>challenge</html>"), null);
    });
});

describe("world admission", () => {
    const key = "admission-test-secret-" + "x".repeat(20);
    let previous: string | undefined;
    before(() => {
        previous = process.env.WORLD_ACCESS_SECRET;
        process.env.WORLD_ACCESS_SECRET = key;
    });
    after(() => {
        if (previous === undefined) delete process.env.WORLD_ACCESS_SECRET;
        else process.env.WORLD_ACCESS_SECRET = previous;
    });
    const proof = (rev: string, x = "exhibit-1") => proofFor(Buffer.from(key), { x, r: rev, e: later() });

    it("admits worlds without a password, and unknown labels", async () => {
        const answers: Record<string, WorldAccess> = { open: { exists: true, id: "o", password: false, rev: null }, gone: { exists: false } };
        const { admit } = createWorldAdmission(async (space) => answers[space] ?? null);
        assert.deepEqual(await admit("open", undefined), { ok: true });
        assert.deepEqual(await admit("gone", undefined), { ok: true });
        // The API never answered for this label: joins go on as before.
        assert.deepEqual(await admit("unreachable", undefined), { ok: true });
    });

    it("asks a password-gated world for a proof of its current password", async () => {
        const { admit } = createWorldAdmission(async () => gated("rev-1"));
        assert.deepEqual(await admit("w", undefined), { ok: false, reason: "password" });
        assert.deepEqual(await admit("w", "not-a-proof"), { ok: false, reason: "password" });
        assert.deepEqual(await admit("w", proof("rev-0")), { ok: false, reason: "password" });
        assert.deepEqual(await admit("w", proof("rev-1", "another-world")), { ok: false, reason: "password" });
        assert.deepEqual(await admit("w", proof("rev-1")), { ok: true });
    });

    it("fails closed without a key", async () => {
        process.env.WORLD_ACCESS_SECRET = "";
        const jwt = process.env.SECRET_JWT_KEY;
        delete process.env.SECRET_JWT_KEY;
        try {
            const { admit } = createWorldAdmission(async () => gated("rev-1"));
            assert.deepEqual(await admit("w", proof("rev-1")), { ok: false, reason: "no-secret" });
        } finally {
            process.env.WORLD_ACCESS_SECRET = key;
            if (jwt !== undefined) process.env.SECRET_JWT_KEY = jwt;
        }
    });

    it("remembers a gated world through an API outage", async () => {
        let answer: WorldAccess | null = gated("rev-1");
        let calls = 0;
        let now = 1_000_000;
        const lookup: WorldAccessLookup = async () => (calls++, answer);
        const { admit } = createWorldAdmission(lookup, () => now);
        assert.deepEqual(await admit("w", proof("rev-1")), { ok: true });
        now += 60_000;
        answer = null; // unreachable
        assert.deepEqual(await admit("w", undefined), { ok: false, reason: "password" });
        assert.deepEqual(await admit("w", proof("rev-1")), { ok: true });
    });

    it("does not hold back a proof for a password changed since the cached answer", async () => {
        let answer: WorldAccess = gated("rev-1");
        let calls = 0;
        const { admit } = createWorldAdmission(async () => (calls++, answer));
        assert.deepEqual(await admit("w", proof("rev-1")), { ok: true });
        assert.equal(calls, 1);
        answer = gated("rev-2");
        assert.deepEqual(await admit("w", proof("rev-2")), { ok: true });
        assert.equal(calls, 2);
        assert.deepEqual(await admit("w", proof("rev-1")), { ok: false, reason: "password" });
        // Without a genuine proof there is nothing to reread for.
        assert.deepEqual(await admit("w", "forged"), { ok: false, reason: "password" });
        assert.equal(calls, 3);
    });
});

describe("cyber room join of a password-gated world", () => {
    let colyseus: ColyseusTestServer;
    const key = "room-join-test-secret-" + "x".repeat(20);
    let previousKey: string | undefined;
    let previousLookup: WorldAccessLookup;
    const joinOpts = (accessProof?: string) => ({
        userId: "0xvisitor",
        username: "u",
        avatar: "a",
        currentSpace: "exhibit-1",
        position: { x: 0, y: 0, z: 0 },
        rotationY: 0,
        VRM: "",
        token: "",
        label: "gated-world",
        ...(accessProof ? { accessProof } : {}),
    });

    before(async () => {
        previousKey = process.env.WORLD_ACCESS_SECRET;
        process.env.WORLD_ACCESS_SECRET = key;
        previousLookup = setWorldAccessLookup(async (space) => (space === "gated-world" ? gated("rev-1") : { exists: false }));
        const gameServer = new Server();
        gameServer.define("cyber", CyberRoom);
        await gameServer.listen(2573, "127.0.0.1");
        colyseus = new ColyseusTestServer(gameServer);
    });
    after(async () => {
        setWorldAccessLookup(previousLookup);
        if (previousKey === undefined) delete process.env.WORLD_ACCESS_SECRET;
        else process.env.WORLD_ACCESS_SECRET = previousKey;
        await colyseus.shutdown();
    });
    beforeEach(async () => await colyseus.cleanup());

    it("refuses a join without the proof and admits one with it", async () => {
        const room = await colyseus.createRoom("cyber", { label: "gated-world", currentSpace: "exhibit-1" });
        await assert.rejects(colyseus.connectTo(room, joinOpts()));
        await assert.rejects(colyseus.connectTo(room, joinOpts(proofFor(Buffer.from(key), { x: "exhibit-1", r: "rev-0", e: later() }))));
        assert.equal(room.clients.length, 0);
        const client = await colyseus.connectTo(room, joinOpts(proofFor(Buffer.from(key), { x: "exhibit-1", r: "rev-1", e: later() })));
        assert.ok(client.sessionId);
        assert.equal(room.clients.length, 1);
    });

    it("checks the room's world, not the one a join names", async () => {
        const room = await colyseus.createRoom("cyber", { label: "gated-world", currentSpace: "exhibit-1" });
        await assert.rejects(colyseus.connectTo(room, { ...joinOpts(), label: "open-world" }));
    });
});
