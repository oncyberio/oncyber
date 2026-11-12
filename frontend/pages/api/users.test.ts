/** @jest-environment node */
import handler from "./users";
import { getUserProfilesByWalletIds } from "@utils/firestore/userProfiles";

jest.mock("@utils/middlewares/corsMiddleware", () => ({
    corsMiddleware: jest.fn(async () => undefined),
}));
jest.mock("@utils/firestore/userProfiles", () => ({
    ...jest.requireActual("@utils/firestore/userProfiles"),
    getUserProfilesByWalletIds: jest.fn(),
}));
jest.mock("@utils/getContentByIds", () => ({ getContentByIds: jest.fn() }));
jest.mock("@utils/firebaseAdmin", () => ({ db: {} }));

function response() {
    const res: any = { statusCode: 200, body: undefined };
    res.status = (code) => ((res.statusCode = code), res);
    res.json = (body) => ((res.body = body), res);
    return res;
}

test("the portal-owner lookup leaves out e-mail addresses", async () => {
    (getUserProfilesByWalletIds as jest.Mock).mockResolvedValue([
        { id: "0xAlice", username: "alice", email: "alice@example.com" },
    ]);
    const res = response();
    await handler({ body: { walletIds: ["0xalice"] } } as any, res);
    expect(res.body).toEqual({
        success: true,
        users: [{ id: "0xAlice", username: "alice" }],
    });
});
