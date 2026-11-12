/** @jest-environment node */
import { isOwnOrLinkedAccount, publicUserProfile } from "./userProfiles";

let mockUsers: Record<string, any>[] = [];

jest.mock("../getContentByIds", () => ({ getContentByIds: jest.fn() }));
jest.mock("../firebaseAdmin", () => ({
    db: {
        collection: () => {
            const filters: [string, any][] = [];
            const query: any = {
                where: (field, _op, value) => (
                    filters.push([field, value]), query
                ),
                limit: () => query,
                get: async () => {
                    const docs = mockUsers
                        .filter((u) => filters.every(([f, v]) => u[f] === v))
                        .map((u) => ({ id: u.walletId, data: () => u }));
                    return { empty: docs.length === 0, docs };
                },
            };
            return query;
        },
    },
}));

describe("isOwnOrLinkedAccount", () => {
    beforeEach(() => {
        mockUsers = [{ walletId: "0xalice", linkedAccounts: ["0xsecond"] }];
    });

    test.each([
        ["the account itself", "0xAlice", "0xalice", true],
        ["an account linked to it", "0xalice", "0xSecond", true],
        ["someone else's account", "0xalice", "0xvictim", false],
        ["no session", undefined, "0xsecond", false],
        ["no account named", "0xalice", "", false],
    ])("%s", async (_name, session, accountId, expected) => {
        await expect(isOwnOrLinkedAccount(session, accountId)).resolves.toBe(
            expected
        );
    });

    test("a session with no user document has no linked accounts", async () => {
        mockUsers = [];
        await expect(
            isOwnOrLinkedAccount("0xnobody", "0xsecond")
        ).resolves.toBe(false);
    });
});

describe("publicUserProfile", () => {
    test("leaves out the account's and its linked sign-ins' e-mails", () => {
        const user = {
            id: "0xalice",
            username: "alice",
            email: "a@example.com",
            linkedAccountsData: [
                { id: "google", providerId: "google", email: "a@example.com" },
                null,
            ],
            linkedAccounts: [{ id: "google", email: "a@example.com" }],
        };
        const shown = publicUserProfile(user);
        expect(shown).toEqual({
            id: "0xalice",
            username: "alice",
            linkedAccountsData: [{ id: "google", providerId: "google" }, null],
            linkedAccounts: [{ id: "google" }],
        });
        expect(user.email).toBe("a@example.com");
    });

    test("keeps the string list of linked account ids", () => {
        const user = { id: "0xalice", linkedAccounts: ["0xsecond"] };
        expect(publicUserProfile(user)).toEqual(user);
    });

    test("passes through what is not a document", () => {
        expect(publicUserProfile(null)).toBe(null);
    });
});
