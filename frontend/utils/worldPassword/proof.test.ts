/** @jest-environment node */
import {
    provesWorldAccess,
    readWorldAccessProof,
    signWorldAccessProof,
    worldAccessKey,
    WORLD_ACCESS_PROOF_TTL_S,
} from "./proof";

// Shared with multiplayer/test/WorldAccess_test.ts: the room verifies what
// the web API signs.
const VECTOR = {
    secret: "vector-secret",
    jwtKey: "vector-jwt-key",
    exhibitId: "exhibit-1",
    rev: "rev-1",
    expiresAtS: 4102444800,
    proof: "wa1.eyJ4IjoiZXhoaWJpdC0xIiwiciI6InJldi0xIiwiZSI6NDEwMjQ0NDgwMH0.Du-2CWzGyBo2HbDnclFNkTjob1HSllgeeQxMZJ2Tdxc",
    derivedProof:
        "wa1.eyJ4IjoiZXhoaWJpdC0xIiwiciI6InJldi0xIiwiZSI6NDEwMjQ0NDgwMH0.8FA4AEb6JnNhB_xPQWX_2q7OTFS2XRvCZElMMbNjpCA",
};

const issuedAt = (VECTOR.expiresAtS - WORLD_ACCESS_PROOF_TTL_S) * 1000;

test("the proof format matches the multiplayer server's", () => {
    const key = worldAccessKey({ WORLD_ACCESS_SECRET: VECTOR.secret });
    const world = { exhibitId: VECTOR.exhibitId, rev: VECTOR.rev };
    expect(signWorldAccessProof(world, { now: issuedAt, key })).toBe(
        VECTOR.proof
    );
    const derived = worldAccessKey({ SECRET_JWT_KEY: VECTOR.jwtKey });
    expect(signWorldAccessProof(world, { now: issuedAt, key: derived })).toBe(
        VECTOR.derivedProof
    );
});

test("a proof names one world and one password revision, for a while", () => {
    const key = Buffer.from("k".repeat(32));
    const now = 1_700_000_000_000;
    const proof = signWorldAccessProof(
        { exhibitId: "a", rev: "rev-1" },
        { now, key }
    );
    expect(readWorldAccessProof(proof, { now, key })).toEqual({
        exhibitId: "a",
        rev: "rev-1",
        expiresAt: now + WORLD_ACCESS_PROOF_TTL_S * 1000,
    });
    const at = (ms: number) => ({ now: ms, key });
    expect(
        provesWorldAccess(proof, { exhibitId: "a", rev: "rev-1" }, at(now))
    ).toBe(true);
    expect(
        provesWorldAccess(proof, { exhibitId: "a", rev: "rev-2" }, at(now))
    ).toBe(false);
    expect(
        provesWorldAccess(proof, { exhibitId: "b", rev: "rev-1" }, at(now))
    ).toBe(false);
    expect(
        provesWorldAccess(proof, { exhibitId: "a", rev: null }, at(now))
    ).toBe(false);
    const expired = now + WORLD_ACCESS_PROOF_TTL_S * 1000;
    expect(
        provesWorldAccess(proof, { exhibitId: "a", rev: "rev-1" }, at(expired))
    ).toBe(false);
});

test.each([
    ["another key", (p: string) => p, Buffer.from("other")],
    ["a changed claim", (p: string) => p.replace(/\.[^.]+\./, ".e30."), null],
    ["a changed signature", (p: string) => p.slice(0, -2) + "AA", null],
    ["another prefix", (p: string) => p.replace("wa1", "wa2"), null],
    ["a session token shape", () => "a.b.c", null],
    ["no proof", () => undefined, null],
])("%s is refused", (_, change, otherKey) => {
    const key = Buffer.from("k".repeat(32));
    const proof = signWorldAccessProof({ exhibitId: "a", rev: "r" }, { key });
    expect(
        readWorldAccessProof(change(proof), { key: otherKey || key })
    ).toBeNull();
});

test("without a key nothing is issued and nothing verifies", () => {
    expect(worldAccessKey({})).toBeNull();
    expect(
        signWorldAccessProof({ exhibitId: "a", rev: "r" }, { key: null })
    ).toBeNull();
    expect(readWorldAccessProof(VECTOR.proof, { key: null })).toBeNull();
});
