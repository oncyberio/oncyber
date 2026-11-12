/** @jest-environment node */
import { contactPolicy, syncPresencePrivacy } from "./socialPolicyServer";
jest.mock("@utils/socialService", () => ({ socialServiceUrl: path => `https://service.example${path}`, socialServiceHeaders: () => ({ authorization: "Bearer service-secret", "content-type": "application/json" }) }));
let previousFetch: typeof fetch, previousSecret: string;
beforeEach(() => { previousFetch = global.fetch; previousSecret = process.env.SOCIAL_SERVICE_SECRET; process.env.SOCIAL_SERVICE_SECRET = "service-secret"; });
afterEach(() => { global.fetch = previousFetch; if (previousSecret === undefined) delete process.env.SOCIAL_SERVICE_SECRET; else process.env.SOCIAL_SERVICE_SECRET = previousSecret; });

test("requests only canonical host-owned identity and whitelists requested contact fields", async () => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ contacts: [{ uid: "bob", allowed: false, activityHidden: false, rawGraph: ["private"] }, { uid: "stranger", allowed: true, activityHidden: false }] }) })) as any;
    const policies = await contactPolicy("alice", ["bob", "bob", "missing"]);
    expect([...policies.values()]).toEqual([{ uid: "bob", allowed: false, activityHidden: true }, { uid: "missing", allowed: false, activityHidden: true }]);
    const request = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(JSON.parse(request.body)).toEqual({ identity: { uid: "alice" }, operation: "/friends/contact", input: { uids: ["bob", "missing"] } });
    expect(request.redirect).toBe("error");
    expect(request.headers.authorization).toBe("Bearer service-secret");
});

test("unavailable policy never becomes an allow decision", async () => {
    global.fetch = jest.fn(async () => ({ ok: false })) as any;
    await expect(contactPolicy("alice", ["bob"])).rejects.toThrow("SOCIAL_POLICY_UNAVAILABLE");
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({}) })) as any;
    await expect(contactPolicy("alice", ["bob"])).rejects.toThrow("SOCIAL_POLICY_UNAVAILABLE");
    delete process.env.SOCIAL_SERVICE_SECRET;
    await expect(contactPolicy("alice", ["bob"])).rejects.toThrow("SOCIAL_POLICY_NOT_CONFIGURED");
});

test("legacy privacy updates both graph presence fields and requires an effective response", async () => {
    global.fetch = jest.fn(async (_url, init: any) => ({ ok: true, json: async () => ({ privacy: JSON.parse(init.body).input }) })) as any;
    await syncPresencePrivacy("alice", "hidden");
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).input).toEqual({ presence: "nobody", activity: "nobody" });
    await syncPresencePrivacy("alice", "public");
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body).input).toEqual({ presence: "friends", activity: "friends" });
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })) as any;
    await expect(syncPresencePrivacy("alice", "hidden")).rejects.toThrow("SOCIAL_POLICY_UNAVAILABLE");
});
