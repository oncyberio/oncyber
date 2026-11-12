import {
    forgetWorldAccess,
    heldWorldAccessProof,
    PROOF_REFRESH_MARGIN_MS,
    readWorldAccessProof,
    rememberWorldAccess,
    renewWorldAccess,
    worldAccessProofExpiring,
} from "./accessProofs";

// The client never checks a proof; it only reads when it expires.
const proofExpiringAt = (ms: number) =>
    `wa1.${btoa(JSON.stringify({ x: "w", r: "r", e: ms / 1000 }))
        .replace(/=+$/, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")}.sig`;

const NOW = 1_700_000_000_000;

beforeEach(() => forgetWorldAccess());

test("only a successful check's proof is kept, by space", () => {
    const proof = proofExpiringAt(NOW + 3_600_000);
    rememberWorldAccess("world", { type: "password-error", proof });
    rememberWorldAccess("world", { type: "success" });
    expect(readWorldAccessProof("world", NOW)).toBeUndefined();
    rememberWorldAccess("world", { type: "success", proof });
    expect(readWorldAccessProof("world", NOW)).toBe(proof);
    expect(readWorldAccessProof("other", NOW)).toBeUndefined();
});

test("an expired proof is dropped, an expiring one is renewed", async () => {
    const soon = Date.now() + PROOF_REFRESH_MARGIN_MS - 1000;
    rememberWorldAccess("world", {
        type: "success",
        proof: proofExpiringAt(soon),
    });
    expect(worldAccessProofExpiring("world")).toBe(true);
    expect(
        worldAccessProofExpiring("world", soon - 2 * PROOF_REFRESH_MARGIN_MS)
    ).toBe(false);
    const renewed = proofExpiringAt(Date.now() + 3_600_000);
    const check = jest.fn(async () => ({ type: "success", proof: renewed }));
    await renewWorldAccess("world", check);
    expect(check).toHaveBeenCalledWith(proofExpiringAt(soon));
    expect(readWorldAccessProof("world")).toBe(renewed);
    // Fresh: no second round trip.
    await renewWorldAccess("world", check);
    expect(check).toHaveBeenCalledTimes(1);
    expect(
        readWorldAccessProof("world", Date.now() + 3_600_001)
    ).toBeUndefined();
});

test("an expired proof is held a day for renewal, never for a join", async () => {
    const expired = proofExpiringAt(Date.now() - 60_000);
    rememberWorldAccess("world", { type: "success", proof: expired });
    expect(readWorldAccessProof("world")).toBeUndefined();
    expect(heldWorldAccessProof("world")).toBe(expired);
    const renewed = proofExpiringAt(Date.now() + 3_600_000);
    await renewWorldAccess("world", async () => ({
        type: "success",
        proof: renewed,
    }));
    expect(readWorldAccessProof("world")).toBe(renewed);
    const day = 24 * 60 * 60 * 1000;
    expect(heldWorldAccessProof("world", Date.now() + 3_600_000 + day)).toBe(
        undefined
    );
});

test("nothing held, nothing renewed; a failed renewal keeps what is held", async () => {
    const check = jest.fn(async () => {
        throw new Error("offline");
    });
    await renewWorldAccess("world", check);
    expect(check).not.toHaveBeenCalled();
    const held = proofExpiringAt(Date.now() + 60_000);
    rememberWorldAccess("world", { type: "success", proof: held });
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await renewWorldAccess("world", check);
    expect(readWorldAccessProof("world")).toBe(held);
});
