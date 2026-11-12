/** @jest-environment node */
import handler from "./update";
import { auth } from "@utils/middlewares/authMiddleware";
import { db } from "@utils/firebaseAdmin";

const mockUpdate = jest.fn(async () => undefined);
const mockSet = jest.fn(async () => undefined);

jest.mock("@utils/middlewares/authMiddleware", () => ({ auth: jest.fn() }));
jest.mock("@utils/middlewares/corsMiddleware", () => ({
    corsMiddleware: jest.fn(async () => undefined),
}));
jest.mock("@utils/firestore/userProfiles", () => ({
    invalidateUserProfile: jest.fn(),
}));
jest.mock("@utils/firebaseAdmin", () => ({
    db: {
        collection: jest.fn(() => {
            const query: any = {
                where: () => query,
                limit: () => query,
                get: async () => ({
                    empty: false,
                    docs: [{ id: "0xalice" }],
                }),
                doc: () => ({ update: mockUpdate, set: mockSet }),
            };
            return query;
        }),
    },
}));

function response() {
    const res: any = { statusCode: 200, body: undefined };
    res.status = (code) => ((res.statusCode = code), res);
    res.json = (body) => ((res.body = body), res);
    return res;
}

const request = (payload) => ({ headers: {}, body: { payload } });

beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue("0xalice");
});

test.each([
    ["linked accounts", { linkedAccounts: ["0xwhale"] }],
    ["their copy", { linkedAccountsData: [{ id: "0xwhale" }] }],
    ["a path into them", { description: "hi", "linkedAccounts.0": "0xw" }],
])("a profile update that writes %s is refused", async (_name, payload) => {
    const res = response();
    await handler(request(payload), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
});

test("an ordinary profile update is still written", async () => {
    const res = response();
    await handler(request({ description: "hello" }), res);
    expect(res.statusCode).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({ description: "hello" });
    expect(db.collection).toHaveBeenCalledWith("users");
});
