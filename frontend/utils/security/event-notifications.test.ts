/** @jest-environment node */
import { getEvents } from "../../pages/api/_v2/eventScheduler/get";
import { cancelNotification } from "../../pages/api/_v2/eventScheduler/cancelNotification";
import { sendNotification } from "../../pages/api/_v2/eventScheduler/sendNotification";

const mockEvent = jest.fn();
const mockUnsubscribe = jest.fn();
const mockList = jest.fn();
const mockProfiles = jest.fn();
const mockSubscribe = jest.fn();
jest.mock("@utils/rpc/server", () => ({
    proc: (options) => Object.assign(options.handler, { _RPC_OPTS: options }),
    NoApi: () => {},
}));
jest.mock("@env", () => ({ nodeEnv: { ONESIGNAL_APP_ID: "test-app" } }));
jest.mock("../../pages/api/_v2/eventScheduler/utils/getEventById", () => ({ getEventSchedulerById: (...args) => mockEvent(...args) }), { virtual: true });
jest.mock("../../pages/api/_v2/eventScheduler/utils/subscription", () => ({
    unsubscribe: (...args) => mockUnsubscribe(...args),
    subscribe: (...args) => mockSubscribe(...args),
}), { virtual: true });
jest.mock("@utils/firestore/userProfiles", () => ({ getUserProfilesByWalletIds: (...args) => mockProfiles(...args) }));
jest.mock("@api/notifications/getNotificationId", () => ({ getUserNotificationId: (id) => `opaque-${id}` }), { virtual: true });
jest.mock("@utils/firebaseAdmin", () => ({
    db: {
        collection: (name) => {
            if (name === "event-scheduler") {
                return { where: () => ({ get: (...args) => mockList(...args) }) };
            }
            return {
                doc: () => ({
                    get: async () => ({ exists: true, data: () => ({ info: { headline: "Gallery", customLink: "gallery" } }) }),
                }),
            };
        },
    },
}));

const subscriptions = [
    { userId: "alice", notificationId: "alice-notification", internal: "alice-private" },
    { userId: "bob", notificationId: "bob-notification", internal: "bob-private" },
];
const payload = {
    userId: "organizer", title: "Event", date: 123, endDate: 456,
    exhibitId: "gallery", thumbnail: "/event.jpg", eventType: "ART",
    subscribedUsers: subscriptions, internalNotes: "private-notes",
};
let originalFetch: typeof fetch;
beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ ok: true })) as any;
    mockEvent.mockReset().mockResolvedValue(payload);
    mockUnsubscribe.mockReset().mockResolvedValue(undefined);
    mockList.mockReset().mockResolvedValue({ docs: [{ id: "event", data: () => payload }] });
    mockProfiles.mockReset().mockResolvedValue([{ walletId: "alice" }, { walletId: "bob" }]);
    mockSubscribe.mockReset().mockResolvedValue(undefined);
    jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

test("anonymous event list preserves participant avatars without leaking notification IDs or internal fields", async () => {
    const setHeader = jest.fn();
    const [event] = await getEvents.call({ res: { setHeader } }, {});
    expect(event).toMatchObject({ id: "event", title: "Event", userId: "organizer", eventLocation: "Gallery", customLink: "gallery" });
    expect(event.subscribedUsers).toEqual([{ userId: "alice" }, { userId: "bob" }]);
    expect(event.subscriptionNotificationId).toBeNull();
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain("alice-notification");
    expect(serialized).not.toContain("bob-notification");
    expect(serialized).not.toContain("private");
    expect(setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
});

test("signed-in caller receives only their own cancellation receipt outside public subscriber entries", async () => {
    const [event] = await getEvents.call({ userId: "alice", res: { setHeader: jest.fn() } }, {});
    expect(event.subscriptionNotificationId).toBe("alice-notification");
    expect(event.subscribedUsers).toEqual([{ userId: "alice" }, { userId: "bob" }]);
    expect(JSON.stringify(event)).not.toContain("bob-notification");
});

test("legacy device subscription IDs stay private while the participant count is preserved", async () => {
    mockList.mockResolvedValue({ docs: [{ id: "event", data: () => ({
        ...payload,
        subscribedUsers: [...subscriptions, { userId: "legacy-device-id", notificationId: "legacy-notification" }],
    }) }] });
    const [event] = await getEvents.call({ res: { setHeader: jest.fn() } }, {});
    expect(mockProfiles).toHaveBeenCalledWith(["alice", "bob", "legacy-device-id"]);
    expect(event.subscribedUsers).toEqual([{ userId: "alice" }, { userId: "bob" }]);
    expect(event.subscriberCount).toBe(3);
    expect(JSON.stringify(event)).not.toContain("legacy-device-id");
    expect(JSON.stringify(event)).not.toContain("legacy-notification");
});

test("public identity resolution uses profile records rather than guessing identifier formats", async () => {
    const account = "00000000-0000-4000-8000-000000000001";
    mockList.mockResolvedValue({ docs: [{ id: "event", data: () => ({ ...payload, subscribedUsers: [{ userId: account, notificationId: "private-receipt" }] }) }] });
    mockProfiles.mockResolvedValue([{ walletId: account }]);
    const [event] = await getEvents.call({ res: { setHeader: jest.fn() } }, {});
    expect(event.subscribedUsers).toEqual([{ userId: account }]);
    expect(JSON.stringify(event)).not.toContain("private-receipt");
});

test("anonymous caller cannot schedule a push to an arbitrary device", async () => {
    await expect(sendNotification.call({}, { eventId: "event", currentDeviceId: "victim-device" })).rejects.toThrow("Unauthorized");
    expect((sendNotification as any)._RPC_OPTS.auth).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockSubscribe).not.toHaveBeenCalled();
});

test("signed-in push recipient is derived from the caller, never a supplied device ID", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ id: "new-notification" }) });
    await expect(sendNotification.call({ userId: "alice" }, { eventId: "event", currentDeviceId: "victim-device" })).resolves.toMatchObject({ success: true });
    const request = (global.fetch as jest.Mock).mock.calls[0][1];
    const body = JSON.parse(request.body);
    expect(body.include_aliases).toEqual({ external_id: ["opaque-alice"] });
    expect(body).not.toHaveProperty("include_subscription_ids");
    expect(request.body).not.toContain("victim-device");
    expect(mockSubscribe).toHaveBeenCalledWith({ eventId: "event", notificationId: "new-notification", userId: "alice" });
});

test.each([undefined, "mallory", "bob"])("caller %s cannot cancel Alice's subscription", async (userId) => {
    await expect(cancelNotification.call({ userId }, { eventId: "event", notificationId: "alice-notification" })).rejects.toThrow("Unauthorized");
    expect((cancelNotification as any)._RPC_OPTS.auth).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockUnsubscribe).not.toHaveBeenCalled();
});

test("owned notification is deleted remotely before removing its stored subscription", async () => {
    const effects: string[] = [];
    (global.fetch as jest.Mock).mockImplementation(async () => { effects.push("provider"); return { ok: true }; });
    mockUnsubscribe.mockImplementation(async () => { effects.push("database"); });
    await expect(cancelNotification.call({ userId: "alice" }, { eventId: "event", notificationId: "alice-notification" })).resolves.toEqual({ success: true });
    expect(global.fetch).toHaveBeenCalledWith("https://onesignal.com/api/v1/notifications/alice-notification?app_id=test-app", expect.objectContaining({ method: "DELETE" }));
    expect(mockUnsubscribe).toHaveBeenCalledWith({ eventId: "event", notificationId: "alice-notification", userId: "alice" });
    expect(effects).toEqual(["provider", "database"]);
});

test("provider failure leaves the owned subscription available for retry", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, text: async () => "Provider error" });
    await expect(cancelNotification.call({ userId: "alice" }, { eventId: "event", notificationId: "alice-notification" })).resolves.toMatchObject({ success: false });
    expect(mockUnsubscribe).not.toHaveBeenCalled();
});

test("missing event cannot authorize notification deletion", async () => {
    mockEvent.mockResolvedValue(null);
    await expect(cancelNotification.call({ userId: "alice" }, { eventId: "missing", notificationId: "alice-notification" })).rejects.toThrow("Unauthorized");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockUnsubscribe).not.toHaveBeenCalled();
});
