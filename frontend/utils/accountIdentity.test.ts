import { socialAccountIdentity, prepareSocialIdentityMerge, canonicalAccountId } from "./accountIdentity";
const mockRecords = new Map<string, any>();
const mockRef = (path: string) => ({ path, get: async () => ({ exists: mockRecords.has(path), data: () => mockRecords.get(path) }) });
const mockTx = { delete: (ref: any) => mockRecords.delete(ref.path), get: (ref: any) => ref.get(), set: (ref: any, value: any) => mockRecords.set(ref.path, value), create: (ref: any, value: any) => mockRecords.set(ref.path, value) };
jest.mock("@utils/firebaseAdmin", () => ({ db: { collection: (name: string) => mockCollection(name), runTransaction: (callback: any) => callback(mockTx) } }));
function mockCollection(name: string, filters: [string, any][] = []): any {
    return { doc: (id: string) => mockRef(`${name}/${id}`), where: (field: string, _op: string, value: any) => mockCollection(name, [...filters, [field, value]]), get: async () => ({ docs: [...mockRecords.entries()].filter(([path, data]) => path.startsWith(`${name}/`) && filters.every(([field, value]) => data[field] === value)).map(([path, data]) => ({ ref: mockRef(path), data: () => data })) }) };
}
const account = (id: string, walletId: string, linkedAccounts: string[] = []) => ({ id, data: () => ({ walletId, linkedAccounts }) });
beforeEach(() => mockRecords.clear());

test("linked wallets resolve to one account and keep its established save subject", async () => {
    const first = await socialAccountIdentity(account("account", "wallet-a", ["wallet-b"]));
    const next = await socialAccountIdentity(account("account", "wallet-b", ["wallet-a"]));
    expect(first.uid).toBe("account");
    expect(next.uid).toBe("account");
    expect(next.subjectUid).toBe("wallet-a");
    expect(next.legacySubjectUids).toEqual(expect.arrayContaining(["wallet-a", "wallet-b"]));
});

test("account merge retains source save aliases and canonical redirects", async () => {
    const source = account("source", "wallet-source"), destination = account("destination", "wallet-destination");
    await socialAccountIdentity(source); await socialAccountIdentity(destination);
    const commit = await prepareSocialIdentityMerge(mockTx, source, destination);
    commit();
    const next = await socialAccountIdentity(destination);
    expect(next.subjectUid).toBe("wallet-destination");
    expect(next.legacySubjectUids).toContain("wallet-source");
    expect(await canonicalAccountId("source")).toBe("destination");
});


test("account merge retains one party, moves leadership, and leaves invitations explicit", async () => {
    mockRecords.set("socialPartyMemberships/source", { partyId: "party" });
    mockRecords.set("socialParties/party", { id: "party", leaderId: "source", members: { source: { id: "source", name: "S", joinedAt: 1 }, peer: { id: "peer", joinedAt: 2 } }, version: 4, destination: { instanceId: "old-instance" }, pendingMove: { id: "old-move" } });
    mockRecords.set("socialPartyInvitations/incoming", { id: "incoming", partyId: "inviting-party", toId: "source", fromId: "peer", state: "pending" });
    mockRecords.set("socialPartyInvitations/self", { id: "self", partyId: "own-party", toId: "source", fromId: "destination", state: "pending" });
    const commit = await prepareSocialIdentityMerge(mockTx, account("source", "s"), account("destination", "d"));
    expect(mockRecords.get("socialParties/party").leaderId).toBe("source");
    commit();
    const party = mockRecords.get("socialParties/party");
    expect(party.leaderId).toBe("destination");
    expect(party.members.source).toBeUndefined();
    expect(party.members.destination.id).toBe("destination");
    expect(party.pendingMove).toBeUndefined();
    expect(party.destination.unavailableAt).toEqual(expect.any(Number));
    expect(party.version).toBe(5);
    expect(mockRecords.get("socialPartyMemberships/destination")).toEqual({ partyId: "party" });
    expect(mockRecords.has("socialPartyMemberships/source")).toBe(false);
    expect(mockRecords.has("socialPartyInvitations/incoming")).toBe(false);
    const invitations = [...mockRecords.entries()].filter(([path]) => path.startsWith("socialPartyInvitations/")).map(([, value]) => value);
    expect(invitations.find(value => value.partyId === "inviting-party")).toMatchObject({ toId: "destination", state: "pending" });
    expect(invitations.find(value => value.partyId === "own-party").state).toBe("declined");
});

test("merging into an account already in another party retains its membership and transfers the old leader", async () => {
    mockRecords.set("socialPartyMemberships/source", { partyId: "old" });
    mockRecords.set("socialPartyMemberships/destination", { partyId: "current" });
    mockRecords.set("socialParties/old", { id: "old", leaderId: "source", members: { source: { id: "source", joinedAt: 1 }, peer: { id: "peer", joinedAt: 2 } }, version: 1 });
    mockRecords.set("socialParties/current", { id: "current", leaderId: "destination", members: { destination: { id: "destination", joinedAt: 1 } }, version: 2 });
    (await prepareSocialIdentityMerge(mockTx, account("source", "s"), account("destination", "d")))();
    expect(mockRecords.get("socialPartyMemberships/destination")).toEqual({ partyId: "current" });
    expect(mockRecords.get("socialParties/old").leaderId).toBe("peer");
    expect(mockRecords.get("socialParties/old").members.source).toBeUndefined();
    expect(mockRecords.get("socialParties/current").version).toBe(2);
});
