/** @jest-environment node */
import handler from "./[id]";
import { auth } from "@utils/middlewares/authMiddleware";

const mockUpdate = jest.fn(async () => undefined);
const mockSet = jest.fn(async () => undefined);
const mockStored = {
    username: "alice",
    email: "alice@example.com",
    linkedAccountsData: [{ id: "google", email: "alice@example.com" }],
};

jest.mock("@utils/middlewares/authMiddleware", () => ({ auth: jest.fn() }));
jest.mock("@utils/middlewares/corsMiddleware", () => ({
    corsMiddleware: jest.fn(async () => undefined),
}));
jest.mock("@utils/firestore/userProfiles", () =>
    jest.requireActual("@utils/firestore/userProfiles")
);
jest.mock("@utils/getContentByIds", () => ({ getContentByIds: jest.fn() }));
jest.mock("@utils/firebaseAdmin", () => ({
    db: {
        doc: () => ({
            update: mockUpdate,
            set: mockSet,
            get: async () => ({ data: () => mockStored }),
        }),
    },
}));

function response() {
    const res: any = { statusCode: 200, body: undefined };
    res.status = (code) => ((res.statusCode = code), res);
    res.json = (body) => ((res.body = body), res);
    return res;
}

const write = (metadata) => ({
    headers: {},
    query: { id: "0xalice" },
    body: JSON.stringify({ metadata }),
});
const read = { headers: {}, query: { id: "0xalice" }, body: "" };

beforeEach(() => jest.clearAllMocks());

test.each([
    ["nobody", () => Promise.reject("no token")],
    ["another account", async () => "0xmallory"],
])("a write signed in as %s is refused", async (_name, session) => {
    (auth as jest.Mock).mockImplementation(session);
    const res = response();
    await handler(write({ username: "taken" }), res);
    expect(res.statusCode).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
});

test("the owner may not write linked accounts here either", async () => {
    (auth as jest.Mock).mockResolvedValue("0xAlice");
    const res = response();
    await handler(write({ linkedAccounts: ["0xwhale"] }), res);
    expect(res.statusCode).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
});

test("the owner can write their own profile", async () => {
    (auth as jest.Mock).mockResolvedValue("0xAlice");
    const res = response();
    await handler(write({ description: "hi" }), res);
    expect(res.statusCode).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({ description: "hi" });
});

test("a read by anyone else leaves the e-mail addresses out", async () => {
    (auth as jest.Mock).mockRejectedValue("no token");
    const res = response();
    await handler(read, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.username).toBe("alice");
    expect(JSON.stringify(res.body)).not.toContain("alice@example.com");
});
