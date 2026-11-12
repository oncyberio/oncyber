/** @jest-environment node */
import handler from "./me";
import { getUserProfileByWalletId } from "@utils/firestore/userProfiles";

jest.mock("@utils/middlewares/authMiddleware", () => ({ auth: jest.fn() }));
jest.mock("@utils/middlewares/corsMiddleware", () => ({
    corsMiddleware: jest.fn(async () => undefined),
}));
jest.mock("@utils/firestore/userProfiles", () => ({
    ...jest.requireActual("@utils/firestore/userProfiles"),
    getUserProfileByWalletId: jest.fn(),
}));
jest.mock("@utils/getContentByIds", () => ({ getContentByIds: jest.fn() }));
jest.mock("@utils/firebaseAdmin", () => ({ db: {} }));

function response() {
    const res: any = { statusCode: 200, body: undefined, headers: {} };
    res.status = (code) => ((res.statusCode = code), res);
    res.json = (body) => ((res.body = body), res);
    res.setHeader = (name, value) => void (res.headers[name] = value);
    return res;
}

test("the public, CDN-cached profile leaves out e-mail addresses", async () => {
    (getUserProfileByWalletId as jest.Mock).mockResolvedValue({
        id: "0xAlice",
        username: "alice",
        email: "alice@example.com",
        linkedAccountsData: [{ id: "g", email: "alice@example.com" }],
    });
    const res = response();
    await handler({ headers: {}, query: { walletId: "0xAlice" } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.user.username).toBe("alice");
    expect(JSON.stringify(res.body)).not.toContain("alice@example.com");
});
