/** @jest-environment node */
import follows from "./follows";
import preferences from "./presence-preferences";
import { contactPolicy, syncPresencePrivacy } from "@utils/socialPolicyServer";

const mockValues = new Map<string, any>();
const mockList = jest.fn();
const mockSet = jest.fn();
const mockRef = (path: string): any => ({ id: path.split("/").pop(), path, collection: name => ({ doc: id => mockRef(`${path}/${name}/${id}`) }), get: async () => ({ id: path.split("/").pop(), exists: mockValues.has(path), data: () => mockValues.get(path), ref: mockRef(path) }) });
jest.mock("@utils/firebaseAdmin", () => ({ db: {
    collection: name => ({ doc: id => mockRef(`${name}/${id}`) }),
    batch: () => ({ set: (ref, value) => mockValues.set(ref.path, value), delete: ref => mockValues.delete(ref.path), commit: async () => {} }),
    runTransaction: async callback => callback({ get: ref => ref.get(), set: (ref, value) => mockValues.set(ref.path, value), delete: ref => mockValues.delete(ref.path) }),
} }));
jest.mock("@utils/middlewares/authMiddleware", () => ({ auth: async () => "subject" }));
jest.mock("@api/accounts/authenticate/utils/link", () => ({ getAccountDoc: async () => mockRef("users/alias").get() }), { virtual: true });
jest.mock("@utils/accountIdentity", () => ({ canonicalAccountId: async id => id === "alias" ? "alice" : id, socialAccountIdentity: async () => ({ uid: "alias", subjectUid: "legacy-subject" }) }));
jest.mock("@utils/follows", () => ({ ...jest.requireActual("@utils/follows"), DirectedFollows: class { list(...args) { return mockList(...args); } set(...args) { return mockSet(...args); } } }));
jest.mock("@utils/socialPolicyServer", () => ({ contactPolicy: jest.fn(), syncPresencePrivacy: jest.fn() }));
jest.mock("@utils/socialService", () => ({ socialServiceUrl: path => `https://service.example${path}`, socialServiceHeaders: () => ({ authorization: "Bearer service-secret" }) }));
const request = (method: string, body: any = {}, headers = { host: "oncyber.io", origin: "https://oncyber.io" }): any => ({ method, body, headers, query: {} });
function response(): any { const res: any = { statusCode: 200, setHeader: jest.fn(), status: code => { res.statusCode = code; return res; }, json: body => { res.body = body; return res; } }; return res; }
let originalFetch: typeof fetch;
beforeEach(() => {
    originalFetch = global.fetch;
    mockValues.clear(); mockValues.set("users/alias", { username: "Alice" }); mockValues.set("users/alice", { username: "Alice" }); mockValues.set("users/bob", { username: "Bob" });
    mockList.mockReset().mockResolvedValue(["bob"]); mockSet.mockReset().mockResolvedValue(undefined);
    (contactPolicy as jest.Mock).mockReset().mockResolvedValue(new Map([["bob", { uid: "bob", allowed: true, activityHidden: false }]]));
    (syncPresencePrivacy as jest.Mock).mockReset().mockResolvedValue(undefined);
});
afterEach(() => { global.fetch = originalFetch; });

test("blocked follows cannot be created or exposed while unfollow remains possible", async () => {
    (contactPolicy as jest.Mock).mockResolvedValue(new Map([["bob", { uid: "bob", allowed: false, activityHidden: true }]]));
    const add = response(); await follows(request("POST", { accountId: "bob", following: true }), add);
    expect(add.statusCode).toBe(403); expect(mockSet).not.toHaveBeenCalled();
    const list = response(); await follows(request("GET"), list); expect(list.body.following).toEqual([]);
    const remove = response(); await follows(request("POST", { accountId: "bob", following: false }), remove);
    expect(remove.statusCode).toBe(200); expect(mockSet).toHaveBeenCalledWith("alice", "bob", false);
});

test("following remains directed, but graph privacy hides its public activity projection", async () => {
    mockValues.set("socialPresence/bob", { experienceId: "gallery", worldId: "world", expiresAt: Date.now() + 60_000, updatedAt: 1 });
    mockValues.set("exhibits/gallery", { runtime: { kind: "web", worldId: "world" } });
    (contactPolicy as jest.Mock).mockResolvedValue(new Map([["bob", { uid: "bob", allowed: true, activityHidden: true }]]));
    const res = response(); await follows(request("GET"), res);
    expect(res.body.following).toHaveLength(1); expect(res.body.following[0].presence).toBeNull();
    expect(contactPolicy).toHaveBeenCalledWith("alice", ["bob"]);
});

test("privacy updates use canonical identity and clear existing visible presence", async () => {
    mockValues.set("socialPresence/alice", { worldId: "world" });
    const res = response(); await preferences(request("PUT", { visibility: "hidden" }), res);
    expect(res.statusCode).toBe(200); expect(syncPresencePrivacy).toHaveBeenCalledWith("alice", "hidden");
    expect(mockValues.get("users/alice/socialSettings/presence")).toEqual({ visibility: "hidden" });
    expect(mockValues.has("socialPresence/alice")).toBe(false);
});

test("cross-origin writes are rejected before social or presence changes", async () => {
    for (const [handler, method, body] of [[follows, "POST", { accountId: "bob", following: true }], [preferences, "PUT", { visibility: "hidden" }]] as const) {
        const res = response(); await handler(request(method, body, { host: "oncyber.io", origin: "https://world.example" }), res);
        expect(res.statusCode).toBe(403);
    }
    expect(contactPolicy).not.toHaveBeenCalled(); expect(syncPresencePrivacy).not.toHaveBeenCalled();
});
