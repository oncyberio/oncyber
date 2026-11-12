/** @jest-environment node */
import { getUserByDoc } from "./index";

jest.mock(
    "@api/accounts/authenticate/utils/link",
    () => ({ getAccountDoc: jest.fn(), getAccountDocCached: jest.fn() }),
    { virtual: true }
);
jest.mock("pages/api/exhibit", () => ({ getExhibitById: jest.fn() }), {
    virtual: true,
});
jest.mock("@utils/firestore/destinations", () => ({
    countDestinationsByUserId: jest.fn(),
}));
jest.mock("@utils/getContentByIds", () => ({ getContentByIds: jest.fn() }));
jest.mock("@utils/firebaseAdmin", () => ({ db: {} }));

const doc = (data) => ({ id: "0xAlice", data: () => ({ ...data }) });
const stored = {
    walletId: "0xalice",
    username: "alice",
    email: "alice@example.com",
    linkedAccounts: ["google-uid"],
    linkedAccountsData: [
        { id: "google-uid", providerId: "google", email: "alice@example.com" },
    ],
};

test("another user's profile leaves out every e-mail address", async () => {
    const user: any = await getUserByDoc(doc(stored), false);
    expect(user.username).toBe("alice");
    expect(user.linkedAccounts).toEqual([
        { id: "google-uid", providerId: "google" },
    ]);
    expect(JSON.stringify(user)).not.toContain("alice@example.com");
});

test("the account's own profile keeps them", async () => {
    const user: any = await getUserByDoc(doc(stored), "self");
    expect(user.email).toBe("alice@example.com");
    expect(user.linkedAccounts[0].email).toBe("alice@example.com");
});
