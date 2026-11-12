/** @jest-environment node */
import identityHandler from "./lobby-identity";
import partyHandler from "./lobby-party";
import { partyService } from "@utils/partiesServer";
import { requireAccount } from "@utils/apiAccount";
import { mintLobbyIdentity, verifyLobbyIdentity, lobbyPartyIdentity } from "../../../../multiplayer/src/identity/lobby";
import { profile } from "../../../../multiplayer/src/rooms/crowd/protocol";
jest.mock("@utils/accountIdentity", () => ({ canonicalAccountId: async id => `canonical-${id}` }));
jest.mock("@utils/partiesServer", () => ({ partyService: jest.fn() }));
jest.mock("@utils/apiAccount", () => ({ requireAccount: jest.fn(), ApiHttpError: class extends Error { status: number; body: any; constructor(status, body) { super(body.error); this.status = status; this.body = body; } }, sendApiError: (res, error) => res.status(error.status || 503).json(error.body || { error: "UNAVAILABLE" }) }));
const secret = "fixture-lobby-identity-secret-at-least-32";
const response = () => { const res: any = { statusCode: 200, setHeader: jest.fn(), json: jest.fn(value => { res.body = value; return res; }), status: jest.fn(code => { res.statusCode = code; return res; }) }; return res; };
beforeEach(() => { process.env.LOBBY_IDENTITY_SECRET = secret; (requireAccount as jest.Mock).mockResolvedValue({ account: { id: "alice" } }); });

test("proof contains only a lobby-scoped pseudonym and fails after expiry, tampering or key mismatch", () => {
    const proof = mintLobbyIdentity("canonical-alice", secret, 100000);
    expect(verifyLobbyIdentity(proof.token, secret, 100001)).toBe(lobbyPartyIdentity("canonical-alice", secret));
    expect(Buffer.from(proof.token.split(".")[0], "base64url").toString()).not.toContain("canonical-alice");
    expect(verifyLobbyIdentity(proof.token, secret, 220000)).toBeUndefined();
    expect(verifyLobbyIdentity(proof.token + "x", secret, 100001)).toBeUndefined();
    expect(verifyLobbyIdentity(proof.token, "another-secret-that-is-at-least-32", 100001)).toBeUndefined();
    expect(profile("session", { partyIdentity: lobbyPartyIdentity("alice", secret), userId: "alice" }).partyIdentity).toBeUndefined();
    const verified = lobbyPartyIdentity("alice", secret);
    expect(profile("session", { partyIdentity: "forged" }, verified).partyIdentity).toBe(verified);
});

test("identity endpoint derives canonical actor and requires host origin, ignoring browser-selected identity", async () => {
    const req: any = { method: "POST", headers: { host: "oncyber.io", origin: "https://oncyber.io" }, body: { uid: "attacker" } };
    const res = response(); await identityHandler(req, res);
    expect(res.statusCode).toBe(200); expect(verifyLobbyIdentity(res.body.token)).toBe(lobbyPartyIdentity("canonical-alice"));
    const denied = response(); await identityHandler({ ...req, headers: { ...req.headers, origin: "https://world.example" } }, denied);
    expect(denied.statusCode).toBe(403);
    delete process.env.LOBBY_IDENTITY_SECRET; const missing = response(); await identityHandler(req, missing); expect(missing.statusCode).toBe(503);
});

test("party endpoint exports only current group pseudonyms and canonical destination, never account IDs or requests", async () => {
    (partyService as jest.Mock).mockResolvedValue({ party: { id: "party", leaderId: "canonical-alice", members: [{ id: "canonical-alice" }, { id: "canonical-bob" }], destination: { experienceId: "world", instanceId: "reserved" } }, invitations: [{ fromId: "private" }] });
    const res = response(); await partyHandler({ method: "GET", headers: {}, query: { uid: "attacker" } } as any, res);
    expect(partyService).toHaveBeenCalledWith("read", { actor: { uid: "canonical-alice" } });
    expect(res.body.memberIds).toEqual([lobbyPartyIdentity("canonical-alice"), lobbyPartyIdentity("canonical-bob")]);
    expect(res.body.destination.url).toBe("/s@world"); expect(res.body.isLeader).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/canonical-|private|invitations/);
    delete process.env.LOBBY_IDENTITY_SECRET;
    const missing = response(); await partyHandler({ method: "GET", headers: {} } as any, missing);
    expect(missing.body.memberIds).toEqual([]); expect(missing.body.identityAvailable).toBe(false);
});

test("LOBBY_OWNERS and LOBBY_ADMINS get a signed lobby role; nobody else does", async () => {
    const { lobbyRole } = await import("@utils/lobbyRoles");
    const { verifyLobbyClaims } = await import("../../../../multiplayer/src/identity/lobby");
    process.env.LOBBY_OWNERS = "0x00000000000000000000000000000000000000aa";
    expect(lobbyRole({ id: "uid", data: () => ({ walletId: "0x00000000000000000000000000000000000000AA" }) })).toBe("owner");
    expect(lobbyRole({ id: "0xABC", data: () => ({}) }, " 0xabc ,0xdef")).toBe("admin");
    expect(lobbyRole({ id: "bob", data: () => ({ walletId: "0x123" }) }, "0xabc")).toBeUndefined();
    (requireAccount as jest.Mock).mockResolvedValue({ account: { id: "alice", data: () => ({ walletId: "0x00000000000000000000000000000000000000aa" }) } });
    const res = response();
    await identityHandler({ method: "POST", headers: { host: "oncyber.io", origin: "https://oncyber.io" }, body: { role: "owner" } } as any, res);
    expect(verifyLobbyClaims(res.body.token)).toEqual({ sub: lobbyPartyIdentity("canonical-alice"), role: "owner" });
    (requireAccount as jest.Mock).mockResolvedValue({ account: { id: "mallory" } });
    const plain = response();
    await identityHandler({ method: "POST", headers: { host: "oncyber.io", origin: "https://oncyber.io" }, body: { role: "owner" } } as any, plain);
    expect(verifyLobbyClaims(plain.body.token)?.role).toBeUndefined();
    delete process.env.LOBBY_OWNERS;
});
